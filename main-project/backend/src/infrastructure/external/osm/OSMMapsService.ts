/**
 * OSMMapsService — production-grade OpenStreetMap integration.
 *
 * Primary data sources:
 *   Nominatim   https://nominatim.openstreetmap.org   (geocoding + text-search fallback)
 *   Overpass v0.6 https://overpass-api.de/api/interpreter  (structured category search)
 *
 * Flow for searchPlaces(query):
 *   1. Parse query → { keyword, location }
 *   2. Geocode location with Nominatim → { lat, lon }
 *   3. Map keyword to OSM tag filters (KEYWORD_TO_OSM_TAGS table)
 *   4a. Known niche → Overpass structured search
 *   4b. Unknown niche → Nominatim free-text search
 *   5. Map Overpass/Nominatim elements → PlaceResult[]
 *   6. Cache results for getPlaceDetails (same session, no second API call)
 *
 * Flow for getPlaceDetails(placeId):
 *   1. Hot path: session cache populated by searchPlaces → O(1) return
 *   2. Cold path: parse "osm-{type}-{id}", query Overpass for that element
 *
 * API compliance:
 *   - User-Agent header required on every Nominatim request (ToS §2)
 *   - Max 1 req/s for Nominatim; pipeline makes ≤ 2 calls per run (well within limits)
 *   - Overpass: polite timeout=30, exponential backoff on 429 / 503
 *   - No auth headers required for either public API
 */

import type { IMapsService, PlaceResult } from "@/application/ports/IMapsService";
import { ExternalServiceError } from "@/domain/errors";
import { logger } from "@/utils/logger";

// ─── Constants ────────────────────────────────────────────────────────────────

const NOMINATIM_BASE   = "https://nominatim.openstreetmap.org";
const OVERPASS_BASE    = "https://overpass-api.de/api/interpreter";
/** Nominatim ToS requires identifying the application in User-Agent. */
const USER_AGENT       = "SiftBot/1.0 (contact@sift.ai; lead-generation platform)";
const FETCH_TIMEOUT_MS = 25_000;
/** Maximum number of businesses returned per search. */
const MAX_RESULTS      = 15;
/** Search radius in metres around the geocoded city centre. */
const SEARCH_RADIUS_M  = 20_000;
/** Max Overpass retries on transient errors before giving up. */
const MAX_RETRIES      = 3;

// ─── Types ────────────────────────────────────────────────────────────────────

interface OsmTagSet {
  readonly key: string;
  readonly values: readonly string[];
}

interface OverpassTags {
  name?: string;
  amenity?: string;
  shop?: string;
  craft?: string;
  healthcare?: string;
  leisure?: string;
  office?: string;
  tourism?: string;
  phone?: string;
  "contact:phone"?: string;
  website?: string;
  "contact:website"?: string;
  url?: string;
  "addr:housenumber"?: string;
  "addr:street"?: string;
  "addr:city"?: string;
  "addr:town"?: string;
  "addr:village"?: string;
  "addr:suburb"?: string;
  "addr:state"?: string;
  "addr:postcode"?: string;
  [key: string]: string | undefined;
}

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: OverpassTags;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

interface NominatimGeocode {
  lat: string;
  lon: string;
  display_name: string;
}

interface NominatimSearchResult {
  osm_type: string;
  osm_id: string;
  display_name: string;
  lat: string;
  lon: string;
  class?: string;
  type?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    suburb?: string;
    state?: string;
    postcode?: string;
    road?: string;
    house_number?: string;
  };
  extratags?: {
    phone?: string;
    website?: string;
    "contact:phone"?: string;
    "contact:website"?: string;
  };
}

// ─── Niche ↔ OSM tag mappings ─────────────────────────────────────────────────

/**
 * Maps our internal niche labels and common search keywords to OSM tag filters.
 * Keys are lower-cased and space/hyphen-normalised before lookup.
 * A single keyword can map to multiple tag sets — all are unioned in Overpass.
 */
const KEYWORD_TO_OSM_TAGS: Readonly<Record<string, OsmTagSet[]>> = {
  // Automotive
  auto_repair:    [{ key: "shop",  values: ["car_repair"] },
                   { key: "amenity", values: ["car_repair"] }],
  "auto repair":  [{ key: "shop",  values: ["car_repair"] },
                   { key: "amenity", values: ["car_repair"] }],
  auto_dealer:    [{ key: "shop",  values: ["car", "car_dealer"] }],
  "car repair":   [{ key: "shop",  values: ["car_repair"] }],
  car_repair:     [{ key: "shop",  values: ["car_repair"] }],

  // Trades
  plumbing:       [{ key: "craft", values: ["plumber"] },
                   { key: "shop",  values: ["plumber", "plumbing"] }],
  plumber:        [{ key: "craft", values: ["plumber"] }],
  electrical:     [{ key: "craft", values: ["electrician"] }],
  electrician:    [{ key: "craft", values: ["electrician"] }],
  roofing:        [{ key: "craft", values: ["roofer", "roofing"] }],
  roofer:         [{ key: "craft", values: ["roofer"] }],
  painting:       [{ key: "craft", values: ["painter"] }],
  hvac:           [{ key: "craft", values: ["hvac", "heating_engineer"] },
                   { key: "shop",  values: ["hvac"] }],
  landscaping:    [{ key: "craft", values: ["gardener", "landscaper"] }],
  pest_control:   [{ key: "craft", values: ["pest_control"] }],
  locksmith:      [{ key: "craft", values: ["locksmith"] },
                   { key: "shop",  values: ["locksmith"] }],
  cleaning:       [{ key: "craft", values: ["cleaning"] }],
  "home repair":  [{ key: "craft", values: ["carpenter", "builder"] }],

  // Food & Drink
  restaurant:     [{ key: "amenity", values: ["restaurant"] }],
  fast_food:      [{ key: "amenity", values: ["fast_food"] }],
  cafe:           [{ key: "amenity", values: ["cafe"] }],
  bar:            [{ key: "amenity", values: ["bar", "pub"] }],
  pub:            [{ key: "amenity", values: ["pub", "bar"] }],
  bakery:         [{ key: "shop",    values: ["bakery"] }],

  // Health & Medical
  dentist:        [{ key: "amenity", values: ["dentist"] }],
  dental:         [{ key: "amenity", values: ["dentist"] }],
  medical:        [{ key: "amenity", values: ["doctors", "clinic"] },
                   { key: "healthcare", values: ["clinic"] }],
  doctor:         [{ key: "amenity", values: ["doctors", "clinic"] }],
  pharmacy:       [{ key: "amenity", values: ["pharmacy"] }],
  health_wellness:[{ key: "amenity", values: ["pharmacy", "doctors"] },
                   { key: "leisure", values: ["fitness_centre"] }],
  hospital:       [{ key: "amenity", values: ["hospital"] }],
  optician:       [{ key: "shop",    values: ["optician"] }],
  physiotherapy:  [{ key: "amenity", values: ["physiotherapist"] },
                   { key: "healthcare", values: ["physiotherapist"] }],

  // Fitness & Wellness
  gym:            [{ key: "leisure", values: ["fitness_centre", "sports_centre"] }],
  spa:            [{ key: "leisure", values: ["spa"] },
                   { key: "amenity", values: ["spa"] }],
  yoga:           [{ key: "leisure", values: ["fitness_centre"] }],

  // Beauty
  hair_salon:     [{ key: "shop", values: ["hairdresser", "barber"] }],
  hairdresser:    [{ key: "shop", values: ["hairdresser"] }],
  barber:         [{ key: "shop", values: ["barber"] }],
  beauty_salon:   [{ key: "shop",    values: ["beauty"] },
                   { key: "amenity", values: ["beauty_salon"] }],
  nail_salon:     [{ key: "shop", values: ["beauty", "nail_salon"] }],

  // Floristry
  florist:        [{ key: "shop", values: ["florist"] }],

  // Pets & Animals
  veterinary:     [{ key: "amenity", values: ["veterinary"] }],
  pet_services:   [{ key: "shop",    values: ["pet", "pet_grooming"] },
                   { key: "amenity", values: ["veterinary"] }],
  pet_grooming:   [{ key: "shop",    values: ["pet_grooming"] }],

  // Professional Services
  real_estate:    [{ key: "office", values: ["estate_agent"] }],
  legal:          [{ key: "office", values: ["lawyer", "notary"] }],
  accounting:     [{ key: "office", values: ["accountant", "tax_advisor"] }],
  insurance:      [{ key: "office", values: ["insurance"] }],
  photography:    [{ key: "shop",   values: ["photo", "photography"] }],

  // Home & Retail
  hardware:       [{ key: "shop", values: ["hardware"] }],
  furniture:      [{ key: "shop", values: ["furniture"] }],
  laundry:        [{ key: "shop", values: ["laundry", "dry_cleaning"] }],
  storage:        [{ key: "shop", values: ["storage_rental"] }],
  moving:         [{ key: "shop", values: ["moving"] }],

  // Hospitality
  hotel:          [{ key: "tourism", values: ["hotel", "motel"] }],
  hospitality:    [{ key: "tourism", values: ["hotel", "motel", "guest_house"] }],

  // Miscellaneous
  travel_agency:  [{ key: "shop", values: ["travel_agency"] }],
  education:      [{ key: "amenity", values: ["school", "college", "university"] }],
};

/**
 * Reverse mapping: given OSM tags on an element, returns our niche label.
 * Evaluated top-to-bottom; first match wins.
 */
const OSM_TAG_TO_NICHE: ReadonlyArray<{ key: string; value: string; niche: string }> = [
  { key: "shop",      value: "car_repair",        niche: "auto_repair"    },
  { key: "amenity",   value: "car_repair",         niche: "auto_repair"    },
  { key: "shop",      value: "car",                niche: "auto_dealer"    },
  { key: "craft",     value: "plumber",            niche: "plumbing"       },
  { key: "shop",      value: "plumber",            niche: "plumbing"       },
  { key: "craft",     value: "electrician",        niche: "electrical"     },
  { key: "craft",     value: "roofer",             niche: "roofing"        },
  { key: "craft",     value: "roofing",            niche: "roofing"        },
  { key: "craft",     value: "painter",            niche: "painting"       },
  { key: "craft",     value: "hvac",               niche: "hvac"           },
  { key: "craft",     value: "heating_engineer",   niche: "hvac"           },
  { key: "craft",     value: "gardener",           niche: "landscaping"    },
  { key: "craft",     value: "landscaper",         niche: "landscaping"    },
  { key: "craft",     value: "pest_control",       niche: "pest_control"   },
  { key: "craft",     value: "locksmith",          niche: "locksmith"      },
  { key: "craft",     value: "cleaning",           niche: "cleaning"       },
  { key: "craft",     value: "carpenter",          niche: "home_repair"    },
  { key: "amenity",   value: "restaurant",         niche: "restaurant"     },
  { key: "amenity",   value: "fast_food",          niche: "restaurant"     },
  { key: "amenity",   value: "cafe",               niche: "cafe"           },
  { key: "amenity",   value: "bar",                niche: "bar"            },
  { key: "amenity",   value: "pub",                niche: "bar"            },
  { key: "shop",      value: "bakery",             niche: "bakery"         },
  { key: "amenity",   value: "dentist",            niche: "dentist"        },
  { key: "amenity",   value: "doctors",            niche: "medical"        },
  { key: "amenity",   value: "clinic",             niche: "medical"        },
  { key: "amenity",   value: "hospital",           niche: "medical"        },
  { key: "amenity",   value: "pharmacy",           niche: "health_wellness"},
  { key: "shop",      value: "optician",           niche: "optician"       },
  { key: "leisure",   value: "fitness_centre",     niche: "gym"            },
  { key: "leisure",   value: "sports_centre",      niche: "gym"            },
  { key: "leisure",   value: "spa",                niche: "spa"            },
  { key: "shop",      value: "hairdresser",        niche: "hair_salon"     },
  { key: "shop",      value: "barber",             niche: "hair_salon"     },
  { key: "shop",      value: "beauty",             niche: "beauty_salon"   },
  { key: "shop",      value: "florist",            niche: "florist"        },
  { key: "amenity",   value: "veterinary",         niche: "veterinary"     },
  { key: "shop",      value: "pet",                niche: "pet_services"   },
  { key: "shop",      value: "pet_grooming",       niche: "pet_services"   },
  { key: "office",    value: "estate_agent",       niche: "real_estate"    },
  { key: "office",    value: "lawyer",             niche: "legal"          },
  { key: "office",    value: "notary",             niche: "legal"          },
  { key: "office",    value: "accountant",         niche: "accounting"     },
  { key: "office",    value: "tax_advisor",        niche: "accounting"     },
  { key: "shop",      value: "photo",              niche: "photography"    },
  { key: "shop",      value: "photography",        niche: "photography"    },
  { key: "shop",      value: "laundry",            niche: "laundry"        },
  { key: "shop",      value: "dry_cleaning",       niche: "laundry"        },
  { key: "shop",      value: "travel_agency",      niche: "travel_agency"  },
  { key: "tourism",   value: "hotel",              niche: "hospitality"    },
  { key: "tourism",   value: "motel",              niche: "hospitality"    },
  { key: "amenity",   value: "school",             niche: "education"      },
];

function nicheFromOsmTags(tags: OverpassTags): string {
  for (const { key, value, niche } of OSM_TAG_TO_NICHE) {
    if (tags[key] === value) return niche;
  }
  // Best-effort: use the first recognised tag value as the niche label
  for (const key of ["amenity", "shop", "craft", "office", "tourism", "leisure", "healthcare"]) {
    const val = tags[key];
    if (val) return val;
  }
  return "local_business";
}

// ─── Query parser ─────────────────────────────────────────────────────────────

interface ParsedQuery {
  keyword: string;
  location: string;
}

/**
 * Splits a free-text search query into a niche keyword and a location string.
 *
 * Supported input formats (all case-insensitive):
 *   "auto repair in Chicago IL"   → { keyword: "auto repair", location: "Chicago IL" }
 *   "plumbing Chicago IL"         → { keyword: "plumbing",    location: "Chicago IL" }
 *   "restaurant Austin"           → { keyword: "restaurant",  location: "Austin"     }
 *   "dental"                      → { keyword: "dental",      location: "dental"     }
 */
function parseQuery(raw: string): ParsedQuery {
  const q = raw.trim();

  // Explicit "X in Y" separator
  const inMatch = q.match(/^(.+?)\s+in\s+(.+)$/i);
  if (inMatch?.[1] && inMatch?.[2]) {
    return { keyword: inMatch[1].trim(), location: inMatch[2].trim() };
  }

  const words = q.split(/\s+/);

  // "keyword City ST" — last token is a 2-letter US state abbreviation
  if (words.length >= 3) {
    const last = words[words.length - 1]!;
    if (/^[A-Z]{2}$/.test(last)) {
      const keyword = words.slice(0, -2).join(" ");
      const location = words.slice(-2).join(" ");
      if (keyword) return { keyword, location };
    }
  }

  // "keyword City" — last token is the location
  if (words.length >= 2) {
    return {
      keyword:  words.slice(0, -1).join(" "),
      location: words[words.length - 1]!,
    };
  }

  // Single word — use as both (likely a niche with no location)
  return { keyword: q, location: q };
}

/**
 * Normalise a keyword for map lookup:
 *   "Auto Repair" → "auto_repair"
 *   "HVAC"        → "hvac"
 */
function normaliseKeyword(kw: string): string {
  return kw.toLowerCase().trim().replace(/[\s\-]+/g, "_");
}

/**
 * Find OSM tag sets for a keyword with progressive fallback:
 *   1. Exact normalised match   ("auto_repair")
 *   2. Raw lower-cased match    ("auto repair")
 *   3. First word match         ("auto" from "auto_repair")
 */
function findOsmTagSets(keyword: string): OsmTagSet[] | null {
  const norm = normaliseKeyword(keyword);
  if (KEYWORD_TO_OSM_TAGS[norm])             return KEYWORD_TO_OSM_TAGS[norm];
  if (KEYWORD_TO_OSM_TAGS[keyword.toLowerCase()]) return KEYWORD_TO_OSM_TAGS[keyword.toLowerCase()];

  const firstWord = norm.split("_")[0];
  if (firstWord && firstWord !== norm && KEYWORD_TO_OSM_TAGS[firstWord]) {
    return KEYWORD_TO_OSM_TAGS[firstWord];
  }
  return null;
}

// ─── Address utilities ────────────────────────────────────────────────────────

interface BuiltAddress { address: string; city: string }

function buildAddress(tags: OverpassTags, fallbackCity: string): BuiltAddress {
  const street = [tags["addr:housenumber"], tags["addr:street"]]
    .filter(Boolean)
    .join(" ");

  const city =
    tags["addr:city"]    ??
    tags["addr:town"]    ??
    tags["addr:village"] ??
    tags["addr:suburb"]  ??
    fallbackCity;

  const parts = [street, city, tags["addr:state"], tags["addr:postcode"]].filter(Boolean);
  return {
    address: parts.length > 0 ? parts.join(", ") : city,
    city,
  };
}

function extractPhone(tags: OverpassTags): string | undefined {
  const raw = tags.phone ?? tags["contact:phone"];
  if (!raw) return undefined;
  const cleaned = raw.replace(/[^\d\s+\-()]/g, "").trim();
  return cleaned || undefined;
}

function extractWebsite(tags: OverpassTags): string | undefined {
  const raw = tags.website ?? tags["contact:website"] ?? tags.url;
  if (!raw) return undefined;
  try {
    const href = raw.startsWith("http") ? raw : `https://${raw}`;
    new URL(href); // validates format — throws if malformed
    return href;
  } catch {
    return undefined;
  }
}

// ─── HTTP utilities ───────────────────────────────────────────────────────────

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Fetch JSON with User-Agent, timeout, and error normalisation.
 * Throws `ExternalServiceError` — retryable=true on 429/503, false on other 4xx.
 */
async function fetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
        ...(init.headers ?? {}),
      },
    });

    if (res.status === 429 || res.status === 503) {
      throw new ExternalServiceError(
        `Rate limited (HTTP ${res.status}) from ${new URL(url).host}`,
        true,
        { status: res.status, host: new URL(url).host }
      );
    }
    if (!res.ok) {
      throw new ExternalServiceError(
        `HTTP ${res.status} from ${new URL(url).host}`,
        res.status >= 500,
        { status: res.status, host: new URL(url).host }
      );
    }
    return res.json() as Promise<T>;
  } catch (err) {
    if ((err as { name?: string }).name === "AbortError") {
      throw new ExternalServiceError(
        `Request timed out after ${FETCH_TIMEOUT_MS}ms`,
        true,
        { url: url.split("?")[0] }
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Wraps an async function with exponential backoff retry.
 * Only retries when the thrown error is a retryable `ExternalServiceError`.
 */
async function withRetry<T>(fn: () => Promise<T>, baseDelayMs = 1_200): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (err instanceof ExternalServiceError && !err.retryable) throw err;
      if (attempt < MAX_RETRIES) {
        const delay = baseDelayMs * 2 ** attempt + Math.random() * 300;
        logger.warn(
          { attempt: attempt + 1, maxRetries: MAX_RETRIES, delayMs: Math.round(delay) },
          "OSMMapsService: transient error — retrying"
        );
        await sleep(delay);
      }
    }
  }
  throw lastErr;
}

// ─── Overpass query builder ───────────────────────────────────────────────────

/**
 * Builds an Overpass QL union query for multiple tag sets, all element types,
 * within `radiusM` metres of (lat, lon).
 *
 * Output: up to `limit` elements with tags + centroid coordinates.
 */
function buildOverpassQuery(
  tagSets: readonly OsmTagSet[],
  lat: number,
  lon: number,
  radiusM: number,
  limit: number
): string {
  const body: string[] = ["[out:json][timeout:30];", "("];

  for (const { key, values } of tagSets) {
    // Escape regex metacharacters in each value, then join with |
    const regex = values
      .map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|");
    const filter = `["${key}"~"^(${regex})$"]["name"]`;
    const bbox   = `(around:${radiusM},${lat},${lon})`;

    for (const osmType of ["node", "way", "relation"] as const) {
      body.push(`  ${osmType}${filter}${bbox};`);
    }
  }

  body.push(");", `out center ${limit};`);
  return body.join("\n");
}

// ─── Service implementation ───────────────────────────────────────────────────

export class OSMMapsService implements IMapsService {
  /**
   * In-process session cache: placeId → PlaceResult.
   *
   * Populated during searchPlaces so that the DiscoverBusinesses use-case can
   * call getPlaceDetails(placeId) without a second network round-trip in the
   * same pipeline run.
   */
  private readonly sessionCache = new Map<string, PlaceResult>();

  // ── Public: searchPlaces ────────────────────────────────────────────────────

  async searchPlaces(query: string): Promise<readonly PlaceResult[]> {
    logger.info({ service: "OSMMapsService", query }, "searchPlaces — start");

    const { keyword, location } = parseQuery(query);
    logger.info({ service: "OSMMapsService", keyword, location }, "Query parsed");

    // Step 1 — Geocode the location string to lat/lon
    const { lat, lon, resolvedCity } = await this.geocodeLocation(location);
    logger.info({ service: "OSMMapsService", lat, lon, resolvedCity }, "Location geocoded");

    // Step 2 — Attempt Overpass structured search (requires known niche)
    const tagSets = findOsmTagSets(keyword);
    let places: PlaceResult[];

    if (tagSets && tagSets.length > 0) {
      logger.info({ service: "OSMMapsService", tagSetCount: tagSets.length }, "Using Overpass structured search");
      places = await this.overpassSearch(tagSets, keyword, lat, lon, resolvedCity);

      if (places.length === 0) {
        logger.info({ service: "OSMMapsService" }, "Overpass returned 0 results — falling back to Nominatim text search");
        places = await this.nominatimTextSearch(query, resolvedCity);
      }
    } else {
      logger.info({ service: "OSMMapsService", keyword }, "No OSM tag mapping found — using Nominatim text search");
      places = await this.nominatimTextSearch(query, resolvedCity);
    }

    // Cache every result for getPlaceDetails
    for (const p of places) this.sessionCache.set(p.placeId, p);

    logger.info(
      { service: "OSMMapsService", total: places.length, withWebsite: places.filter((p) => p.website).length },
      "searchPlaces — complete"
    );
    return places;
  }

  // ── Public: getPlaceDetails ─────────────────────────────────────────────────

  async getPlaceDetails(placeId: string): Promise<PlaceResult> {
    // Hot path: session cache hit (the common case for in-pipeline calls)
    const cached = this.sessionCache.get(placeId);
    if (cached) {
      logger.debug({ placeId }, "OSMMapsService: getPlaceDetails — session cache hit");
      return cached;
    }

    // Cold path: placeId from a previous run or external caller
    logger.info({ placeId }, "OSMMapsService: getPlaceDetails — cache miss, fetching from Overpass");
    return this.fetchElementById(placeId);
  }

  // ── Private: geocoding ──────────────────────────────────────────────────────

  private async geocodeLocation(
    location: string,
  ): Promise<{ lat: number; lon: number; resolvedCity: string }> {
    const url =
      `${NOMINATIM_BASE}/search?` +
      new URLSearchParams({
        q:           location,
        format:      "json",
        limit:       "1",
        featuretype: "settlement,country,state",
      }).toString();

    let results: NominatimGeocode[];
    try {
      results = await withRetry(() => fetchJson<NominatimGeocode[]>(url));
    } catch (err) {
      throw new ExternalServiceError(
        `Nominatim geocode failed for "${location}": ${String(err)}`,
        true,
        { location }
      );
    }

    if (!results.length) {
      logger.warn({ service: "OSMMapsService", location }, "Nominatim returned no geocode match");
      throw new ExternalServiceError(
        `Could not geocode location "${location}" — no results from Nominatim`,
        false,
        { location }
      );
    }

    const hit  = results[0]!;
    const city = hit.display_name.split(",")[0]?.trim() ?? location;
    return { lat: parseFloat(hit.lat), lon: parseFloat(hit.lon), resolvedCity: city };
  }

  // ── Private: Overpass structured search ────────────────────────────────────

  private async overpassSearch(
    tagSets: readonly OsmTagSet[],
    keyword: string,
    lat:     number,
    lon:     number,
    city:    string,
  ): Promise<PlaceResult[]> {
    const oql = buildOverpassQuery(tagSets, lat, lon, SEARCH_RADIUS_M, MAX_RESULTS);

    let response: OverpassResponse;
    try {
      response = await withRetry(() =>
        fetchJson<OverpassResponse>(OVERPASS_BASE, {
          method:  "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body:    `data=${encodeURIComponent(oql)}`,
        })
      );
    } catch (err) {
      throw new ExternalServiceError(
        `Overpass search failed: ${String(err)}`,
        true,
        { keyword, lat, lon }
      );
    }

    const elements = (response.elements ?? []).slice(0, MAX_RESULTS);
    logger.info({ service: "OSMMapsService", count: elements.length, keyword }, "Overpass elements received");

    return elements
      .filter((el): el is OverpassElement & { tags: OverpassTags } =>
        el.tags?.name !== undefined
      )
      .map((el) => this.elementToPlaceResult(el, city, keyword));
  }

  // ── Private: Nominatim free-text fallback ───────────────────────────────────

  private async nominatimTextSearch(
    query: string,
    city:  string,
  ): Promise<PlaceResult[]> {
    const url =
      `${NOMINATIM_BASE}/search?` +
      new URLSearchParams({
        q:              query,
        format:         "json",
        limit:          String(MAX_RESULTS),
        addressdetails: "1",
        extratags:      "1",
      }).toString();

    let results: NominatimSearchResult[];
    try {
      results = await withRetry(() => fetchJson<NominatimSearchResult[]>(url));
    } catch (err) {
      logger.warn({ service: "OSMMapsService", err: String(err) }, "Nominatim text search failed — returning empty");
      return [];
    }

    logger.info({ service: "OSMMapsService", count: results.length }, "Nominatim text search results");
    return results
      .filter((r) => r.osm_type && r.osm_id)
      .map((r)    => this.nominatimResultToPlaceResult(r, city));
  }

  // ── Private: fetch single element by placeId ────────────────────────────────

  private async fetchElementById(placeId: string): Promise<PlaceResult> {
    // placeId format: "osm-{node|way|relation}-{numericId}"
    const match = placeId.match(/^osm-(node|way|relation)-(\d+)$/);
    if (!match) {
      throw new ExternalServiceError(
        `Invalid OSM placeId format: "${placeId}" (expected osm-{type}-{id})`,
        false,
        { placeId }
      );
    }

    const osmType = match[1] as "node" | "way" | "relation";
    const osmId   = match[2]!;
    // Ways and relations need "out center" to get a coordinate; nodes use "out"
    const outMode = osmType === "node" ? "out tags;" : "out tags center;";
    const oql     = `[out:json][timeout:15];\n${osmType}(${osmId});\n${outMode}`;

    let response: OverpassResponse;
    try {
      response = await withRetry(() =>
        fetchJson<OverpassResponse>(OVERPASS_BASE, {
          method:  "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body:    `data=${encodeURIComponent(oql)}`,
        })
      );
    } catch (err) {
      throw new ExternalServiceError(
        `Overpass fetch by ID failed for "${placeId}": ${String(err)}`,
        true,
        { placeId }
      );
    }

    const el = response.elements?.[0];
    if (!el?.tags?.name) {
      throw new ExternalServiceError(
        `OSM element "${placeId}" not found or has no name tag`,
        false,
        { placeId }
      );
    }

    const result = this.elementToPlaceResult(
      el as OverpassElement & { tags: OverpassTags },
      "",
      nicheFromOsmTags(el.tags!)
    );
    this.sessionCache.set(placeId, result);
    return result;
  }

  // ── Private: mapping helpers ─────────────────────────────────────────────────

  private elementToPlaceResult(
    el:          OverpassElement & { tags: OverpassTags },
    fallbackCity: string,
    nicheHint:   string
  ): PlaceResult {
    const tags           = el.tags;
    const { address, city } = buildAddress(tags, fallbackCity);
    const placeId        = `osm-${el.type}-${el.id}`;
    const phone          = extractPhone(tags);
    const website        = extractWebsite(tags);
    const niche          = nicheFromOsmTags(tags) || normaliseKeyword(nicheHint) || "local_business";

    return {
      placeId,
      businessName: tags.name!,
      address,
      city:        city || fallbackCity,
      niche,
      reviewCount: 0,                         // OSM has no review data
      ...(phone   !== undefined && { phone }),
      ...(website !== undefined && { website }),
      source: "osm_fallback" as const,        // closest valid union member
    };
  }

  private nominatimResultToPlaceResult(
    r:           NominatimSearchResult,
    fallbackCity: string
  ): PlaceResult {
    const addr = r.address ?? {};
    const city = addr.city ?? addr.town ?? addr.village ?? addr.suburb ?? fallbackCity;

    const streetPart = [addr.house_number, addr.road].filter(Boolean).join(" ");
    const address    = [streetPart, city, addr.state, addr.postcode]
      .filter(Boolean)
      .join(", ") || r.display_name;

    const ext     = r.extratags ?? {};
    const phone   = ext.phone ?? ext["contact:phone"];
    const website = ext.website ?? ext["contact:website"];

    // Derive niche from Nominatim's class + type fields
    const fakeTags: OverpassTags = {};
    if (r.class && r.type) fakeTags[r.class] = r.type;
    const niche = nicheFromOsmTags(fakeTags) || r.type || "local_business";

    // Sanitise the website URL
    let sanitisedWebsite: string | undefined;
    if (website) {
      try {
        const href = website.startsWith("http") ? website : `https://${website}`;
        new URL(href);
        sanitisedWebsite = href;
      } catch {
        sanitisedWebsite = undefined;
      }
    }

    return {
      placeId:      `osm-${r.osm_type}-${r.osm_id}`,
      businessName: r.display_name.split(",")[0]?.trim() ?? "Unknown",
      address,
      city,
      niche,
      reviewCount:  0,
      ...(phone              !== undefined && { phone }),
      ...(sanitisedWebsite   !== undefined && { website: sanitisedWebsite }),
      source: "osm_fallback" as const,
    };
  }
}
