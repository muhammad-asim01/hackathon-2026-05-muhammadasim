/**
 * OSMMapsService — production-grade OpenStreetMap integration.
 *
 * Data sources:
 *   Nominatim   https://nominatim.openstreetmap.org   (geocoding + text-search)
 *   Overpass v0.6 https://overpass-api.de/api/interpreter  (structured + name-based search)
 *
 * Search strategy (applied in order, first non-empty result wins):
 *   1. Structured tag search  — keyword mapped to OSM tags via KEYWORD_TO_OSM_TAGS
 *   2. Name-based search      — Overpass ["name"~"keyword",i] for any commercial POI
 *   3. Nominatim text search  — free-text fallback for completely unknown inputs
 *
 * This triple-strategy means the service works for:
 *   • Known niches  ("plumber in Austin TX")         → structured tags, most accurate
 *   • Unknown niches ("escape rooms in Denver")      → name search finds anything named "escape room"
 *   • Ambiguous queries ("pizza Chicago")            → all three layers tried in order
 *
 * Keyword matching is intentionally permissive — plurals, variants, and partial
 * words all resolve to the correct tag set before falling through to name search.
 */

import type { IMapsService, PlaceResult } from "@/application/ports/IMapsService";
import { ExternalServiceError } from "@/domain/errors";
import { logger } from "@/utils/logger";

// ─── Constants ────────────────────────────────────────────────────────────────

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const OVERPASS_BASE  = "https://overpass-api.de/api/interpreter";
const USER_AGENT     = "SiftBot/1.0 (contact@sift.ai; lead-generation platform)";
const MAX_RESULTS    = 15;
const SEARCH_RADIUS_M = 20_000;

// Separate timeouts: Overpass is a free public service that can be slow or
// overloaded; a shorter HTTP cap ensures we bail out and fall through to the
// next strategy quickly rather than blocking the pipeline for 25+ seconds.
const OVERPASS_TIMEOUT_MS  = 10_000;   // hard HTTP abort for each Overpass attempt
const NOMINATIM_TIMEOUT_MS = 20_000;   // Nominatim is generally faster
const OVERPASS_QUERY_TIMEOUT_S = 8;    // Overpass QL [timeout:N] — must be < HTTP cap
const OVERPASS_MAX_RETRIES =  1;       // retry once on transient errors, then move on
const NOMINATIM_MAX_RETRIES = 3;       // Nominatim is more reliable — allow more retries

// Commercial POI tag categories used to filter out streets/boundaries in the
// name-based Overpass search. Kept short — each entry becomes a separate union
// clause so fewer = faster query on the free public endpoint.
const BUSINESS_TAG_KEYS = ["amenity", "shop", "craft", "office", "leisure", "tourism"] as const;

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
  sport?: string;
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
//
// Keys are matched case-insensitively after normalisation (spaces/hyphens → _).
// Entries deliberately include the most common plural forms, abbreviations,
// and synonyms so that user prompts don't need to match exactly.
// Any keyword NOT found here falls through to the Overpass name-based search,
// then to Nominatim — so this table is an optimisation, not a gate.

const KEYWORD_TO_OSM_TAGS: Readonly<Record<string, OsmTagSet[]>> = {

  // ── Automotive ──────────────────────────────────────────────────────────────
  auto_repair:        [{ key: "shop",    values: ["car_repair"] },
                       { key: "amenity", values: ["car_repair"] }],
  "auto repair":      [{ key: "shop",    values: ["car_repair"] },
                       { key: "amenity", values: ["car_repair"] }],
  auto_repairs:       [{ key: "shop",    values: ["car_repair"] }],
  auto_shop:          [{ key: "shop",    values: ["car_repair"] }],
  "auto shop":        [{ key: "shop",    values: ["car_repair"] }],
  mechanic:           [{ key: "shop",    values: ["car_repair"] }],
  mechanics:          [{ key: "shop",    values: ["car_repair"] }],
  garage:             [{ key: "shop",    values: ["car_repair"] }],
  garages:            [{ key: "shop",    values: ["car_repair"] }],
  "car repair":       [{ key: "shop",    values: ["car_repair"] }],
  car_repair:         [{ key: "shop",    values: ["car_repair"] }],
  "car service":      [{ key: "shop",    values: ["car_repair"] }],
  "car services":     [{ key: "shop",    values: ["car_repair"] }],
  "auto service":     [{ key: "shop",    values: ["car_repair"] }],
  towing:             [{ key: "shop",    values: ["car_repair"] },
                       { key: "amenity", values: ["car_repair"] }],
  "tow truck":        [{ key: "shop",    values: ["car_repair"] }],
  car_wash:           [{ key: "amenity", values: ["car_wash"] }],
  "car wash":         [{ key: "amenity", values: ["car_wash"] }],
  "car washes":       [{ key: "amenity", values: ["car_wash"] }],
  "tire shop":        [{ key: "shop",    values: ["tyres"] }],
  "tire shops":       [{ key: "shop",    values: ["tyres"] }],
  tires:              [{ key: "shop",    values: ["tyres"] }],
  tyres:              [{ key: "shop",    values: ["tyres"] }],
  auto_dealer:        [{ key: "shop",    values: ["car", "car_dealer"] }],
  "auto dealer":      [{ key: "shop",    values: ["car", "car_dealer"] }],
  dealership:         [{ key: "shop",    values: ["car", "car_dealer"] }],
  dealerships:        [{ key: "shop",    values: ["car", "car_dealer"] }],
  "car dealer":       [{ key: "shop",    values: ["car", "car_dealer"] }],
  "car dealership":   [{ key: "shop",    values: ["car", "car_dealer"] }],
  "gas station":      [{ key: "amenity", values: ["fuel"] }],
  "gas stations":     [{ key: "amenity", values: ["fuel"] }],
  "petrol station":   [{ key: "amenity", values: ["fuel"] }],
  fuel:               [{ key: "amenity", values: ["fuel"] }],

  // ── Trades ──────────────────────────────────────────────────────────────────
  plumbing:           [{ key: "craft",   values: ["plumber"] },
                       { key: "shop",    values: ["plumber", "plumbing"] }],
  plumber:            [{ key: "craft",   values: ["plumber"] }],
  plumbers:           [{ key: "craft",   values: ["plumber"] }],
  "plumbing service": [{ key: "craft",   values: ["plumber"] }],
  electrical:         [{ key: "craft",   values: ["electrician"] }],
  electrician:        [{ key: "craft",   values: ["electrician"] }],
  electricians:       [{ key: "craft",   values: ["electrician"] }],
  "electrical service": [{ key: "craft", values: ["electrician"] }],
  roofing:            [{ key: "craft",   values: ["roofer", "roofing"] }],
  roofer:             [{ key: "craft",   values: ["roofer"] }],
  roofers:            [{ key: "craft",   values: ["roofer"] }],
  painting:           [{ key: "craft",   values: ["painter"] }],
  painter:            [{ key: "craft",   values: ["painter"] }],
  painters:           [{ key: "craft",   values: ["painter"] }],
  "painting service": [{ key: "craft",   values: ["painter"] }],
  hvac:               [{ key: "craft",   values: ["hvac", "heating_engineer"] },
                       { key: "shop",    values: ["hvac"] }],
  "air conditioning": [{ key: "craft",   values: ["hvac", "heating_engineer"] }],
  "heating cooling":  [{ key: "craft",   values: ["hvac"] }],
  landscaping:        [{ key: "craft",   values: ["gardener", "landscaper"] }],
  landscaper:         [{ key: "craft",   values: ["landscaper"] }],
  landscapers:        [{ key: "craft",   values: ["landscaper"] }],
  "lawn care":        [{ key: "craft",   values: ["gardener", "landscaper"] }],
  "lawn service":     [{ key: "craft",   values: ["gardener"] }],
  pest_control:       [{ key: "craft",   values: ["pest_control"] }],
  "pest control":     [{ key: "craft",   values: ["pest_control"] }],
  "pest control service": [{ key: "craft", values: ["pest_control"] }],
  exterminator:       [{ key: "craft",   values: ["pest_control"] }],
  locksmith:          [{ key: "craft",   values: ["locksmith"] },
                       { key: "shop",    values: ["locksmith"] }],
  locksmiths:         [{ key: "craft",   values: ["locksmith"] },
                       { key: "shop",    values: ["locksmith"] }],
  cleaning:           [{ key: "craft",   values: ["cleaning"] }],
  cleaners:           [{ key: "craft",   values: ["cleaning"] }],
  "cleaning service": [{ key: "craft",   values: ["cleaning"] }],
  "house cleaning":   [{ key: "craft",   values: ["cleaning"] }],
  "carpet cleaning":  [{ key: "craft",   values: ["cleaning"] }],
  "window cleaning":  [{ key: "craft",   values: ["cleaning"] }],
  "home repair":      [{ key: "craft",   values: ["carpenter", "builder"] }],
  handyman:           [{ key: "craft",   values: ["carpenter", "builder"] }],
  handymen:           [{ key: "craft",   values: ["carpenter", "builder"] }],
  carpenter:          [{ key: "craft",   values: ["carpenter"] }],
  carpenters:         [{ key: "craft",   values: ["carpenter"] }],
  carpenter_shop:     [{ key: "craft",   values: ["carpenter"] }],
  "moving company":   [{ key: "shop",    values: ["moving"] }],
  moving:             [{ key: "shop",    values: ["moving"] }],
  movers:             [{ key: "shop",    values: ["moving"] }],

  // ── Food & Drink ─────────────────────────────────────────────────────────────
  restaurant:         [{ key: "amenity", values: ["restaurant"] }],
  restaurants:        [{ key: "amenity", values: ["restaurant"] }],
  pizza:              [{ key: "amenity", values: ["restaurant", "fast_food"] }],
  "pizza restaurant": [{ key: "amenity", values: ["restaurant"] }],
  "pizza place":      [{ key: "amenity", values: ["restaurant", "fast_food"] }],
  fast_food:          [{ key: "amenity", values: ["fast_food"] }],
  "fast food":        [{ key: "amenity", values: ["fast_food"] }],
  "fast food restaurant": [{ key: "amenity", values: ["fast_food"] }],
  cafe:               [{ key: "amenity", values: ["cafe"] }],
  cafes:              [{ key: "amenity", values: ["cafe"] }],
  "coffee shop":      [{ key: "amenity", values: ["cafe"] }],
  "coffee shops":     [{ key: "amenity", values: ["cafe"] }],
  coffee:             [{ key: "amenity", values: ["cafe"] }],
  "coffee house":     [{ key: "amenity", values: ["cafe"] }],
  bar:                [{ key: "amenity", values: ["bar", "pub"] }],
  bars:               [{ key: "amenity", values: ["bar", "pub"] }],
  pub:                [{ key: "amenity", values: ["pub", "bar"] }],
  pubs:               [{ key: "amenity", values: ["pub", "bar"] }],
  "cocktail bar":     [{ key: "amenity", values: ["bar"] }],
  nightclub:          [{ key: "amenity", values: ["nightclub"] }],
  nightclubs:         [{ key: "amenity", values: ["nightclub"] }],
  "night club":       [{ key: "amenity", values: ["nightclub"] }],
  bakery:             [{ key: "shop",    values: ["bakery"] }],
  bakeries:           [{ key: "shop",    values: ["bakery"] }],
  "ice cream":        [{ key: "amenity", values: ["ice_cream"] },
                       { key: "shop",    values: ["ice_cream"] }],
  "ice cream shop":   [{ key: "amenity", values: ["ice_cream"] }],
  "food truck":       [{ key: "amenity", values: ["fast_food", "restaurant"] }],

  // ── Health & Medical ─────────────────────────────────────────────────────────
  dentist:            [{ key: "amenity", values: ["dentist"] }],
  dentists:           [{ key: "amenity", values: ["dentist"] }],
  dental:             [{ key: "amenity", values: ["dentist"] }],
  "dental office":    [{ key: "amenity", values: ["dentist"] }],
  "dental clinic":    [{ key: "amenity", values: ["dentist"] }],
  medical:            [{ key: "amenity", values: ["doctors", "clinic"] },
                       { key: "healthcare", values: ["clinic"] }],
  doctor:             [{ key: "amenity", values: ["doctors", "clinic"] }],
  doctors:            [{ key: "amenity", values: ["doctors", "clinic"] }],
  clinic:             [{ key: "amenity", values: ["clinic"] }],
  clinics:            [{ key: "amenity", values: ["clinic"] }],
  "urgent care":      [{ key: "amenity", values: ["clinic", "doctors"] }],
  pharmacy:           [{ key: "amenity", values: ["pharmacy"] }],
  pharmacies:         [{ key: "amenity", values: ["pharmacy"] }],
  drugstore:          [{ key: "amenity", values: ["pharmacy"] }],
  health_wellness:    [{ key: "amenity", values: ["pharmacy", "doctors"] },
                       { key: "leisure", values: ["fitness_centre"] }],
  hospital:           [{ key: "amenity", values: ["hospital"] }],
  hospitals:          [{ key: "amenity", values: ["hospital"] }],
  optician:           [{ key: "shop",    values: ["optician"] }],
  opticians:          [{ key: "shop",    values: ["optician"] }],
  "eye care":         [{ key: "shop",    values: ["optician"] }],
  "eye doctor":       [{ key: "shop",    values: ["optician"] }],
  "eye clinic":       [{ key: "shop",    values: ["optician"] }],
  physiotherapy:      [{ key: "amenity",    values: ["physiotherapist"] },
                       { key: "healthcare", values: ["physiotherapist"] }],
  physiotherapist:    [{ key: "amenity",    values: ["physiotherapist"] }],
  chiropractor:       [{ key: "amenity",    values: ["doctors", "clinic"] },
                       { key: "healthcare", values: ["alternative"] }],
  chiropractors:      [{ key: "amenity",    values: ["doctors", "clinic"] }],
  "chiropractic":     [{ key: "amenity",    values: ["doctors", "clinic"] }],
  acupuncture:        [{ key: "healthcare", values: ["alternative"] }],
  "mental health":    [{ key: "amenity",    values: ["doctors", "clinic"] },
                       { key: "healthcare", values: ["counselling"] }],
  therapist:          [{ key: "healthcare", values: ["counselling", "psychotherapist"] }],
  therapists:         [{ key: "healthcare", values: ["counselling"] }],
  counseling:         [{ key: "healthcare", values: ["counselling"] }],
  counselling:        [{ key: "healthcare", values: ["counselling"] }],
  "physical therapy": [{ key: "amenity",    values: ["physiotherapist"] }],

  // ── Fitness & Wellness ───────────────────────────────────────────────────────
  gym:                [{ key: "leisure", values: ["fitness_centre", "sports_centre"] }],
  gyms:               [{ key: "leisure", values: ["fitness_centre", "sports_centre"] }],
  "fitness center":   [{ key: "leisure", values: ["fitness_centre"] }],
  "fitness centre":   [{ key: "leisure", values: ["fitness_centre"] }],
  "fitness club":     [{ key: "leisure", values: ["fitness_centre"] }],
  spa:                [{ key: "leisure", values: ["spa"] },
                       { key: "amenity", values: ["spa"] }],
  spas:               [{ key: "leisure", values: ["spa"] },
                       { key: "amenity", values: ["spa"] }],
  massage:            [{ key: "leisure", values: ["spa"] },
                       { key: "amenity", values: ["spa"] }],
  "massage therapy":  [{ key: "leisure", values: ["spa"] }],
  "massage parlor":   [{ key: "leisure", values: ["spa"] }],
  yoga:               [{ key: "leisure", values: ["fitness_centre"] }],
  "yoga studio":      [{ key: "leisure", values: ["fitness_centre"] }],
  "yoga studios":     [{ key: "leisure", values: ["fitness_centre"] }],
  pilates:            [{ key: "leisure", values: ["fitness_centre"] }],
  "pilates studio":   [{ key: "leisure", values: ["fitness_centre"] }],
  crossfit:           [{ key: "leisure", values: ["fitness_centre"] }],
  boxing:             [{ key: "leisure", values: ["sports_centre", "fitness_centre"] }],
  "martial arts":     [{ key: "leisure", values: ["fitness_centre", "sports_centre"] }],
  "martial arts studio": [{ key: "leisure", values: ["fitness_centre"] }],
  "karate":           [{ key: "leisure", values: ["fitness_centre"] }],
  "jiu jitsu":        [{ key: "leisure", values: ["fitness_centre"] }],
  "personal training": [{ key: "leisure", values: ["fitness_centre"] }],
  swimming:           [{ key: "leisure", values: ["swimming_pool"] }],
  "swimming pool":    [{ key: "leisure", values: ["swimming_pool"] }],
  "swim school":      [{ key: "leisure", values: ["swimming_pool"] }],

  // ── Beauty ───────────────────────────────────────────────────────────────────
  hair_salon:         [{ key: "shop", values: ["hairdresser", "barber"] }],
  "hair salon":       [{ key: "shop", values: ["hairdresser", "barber"] }],
  "hair salons":      [{ key: "shop", values: ["hairdresser", "barber"] }],
  "hair stylist":     [{ key: "shop", values: ["hairdresser"] }],
  hairdresser:        [{ key: "shop", values: ["hairdresser"] }],
  hairdressers:       [{ key: "shop", values: ["hairdresser"] }],
  barber:             [{ key: "shop", values: ["barber"] }],
  barbers:            [{ key: "shop", values: ["barber"] }],
  barbershop:         [{ key: "shop", values: ["barber"] }],
  barbershops:        [{ key: "shop", values: ["barber"] }],
  "barber shop":      [{ key: "shop", values: ["barber"] }],
  beauty_salon:       [{ key: "shop",    values: ["beauty"] },
                       { key: "amenity", values: ["beauty_salon"] }],
  "beauty salon":     [{ key: "shop",    values: ["beauty"] }],
  "beauty salons":    [{ key: "shop",    values: ["beauty"] }],
  nail_salon:         [{ key: "shop", values: ["beauty", "nail_salon"] }],
  "nail salon":       [{ key: "shop", values: ["beauty", "nail_salon"] }],
  "nail salons":      [{ key: "shop", values: ["beauty", "nail_salon"] }],
  nails:              [{ key: "shop", values: ["beauty", "nail_salon"] }],
  "nail care":        [{ key: "shop", values: ["nail_salon", "beauty"] }],
  tattoo:             [{ key: "shop", values: ["tattoo"] }],
  tattoos:            [{ key: "shop", values: ["tattoo"] }],
  "tattoo shop":      [{ key: "shop", values: ["tattoo"] }],
  "tattoo parlor":    [{ key: "shop", values: ["tattoo"] }],
  "tattoo studio":    [{ key: "shop", values: ["tattoo"] }],
  tanning:            [{ key: "shop", values: ["beauty"] }],
  "tanning salon":    [{ key: "shop", values: ["beauty"] }],
  esthetics:          [{ key: "shop", values: ["beauty"] }],
  aesthetics:         [{ key: "shop", values: ["beauty"] }],
  "skin care":        [{ key: "shop", values: ["beauty"] }],
  "eyebrow threading": [{ key: "shop", values: ["beauty"] }],

  // ── Florist ──────────────────────────────────────────────────────────────────
  florist:            [{ key: "shop", values: ["florist"] }],
  florists:           [{ key: "shop", values: ["florist"] }],
  "flower shop":      [{ key: "shop", values: ["florist"] }],

  // ── Pets ─────────────────────────────────────────────────────────────────────
  veterinary:         [{ key: "amenity", values: ["veterinary"] }],
  vet:                [{ key: "amenity", values: ["veterinary"] }],
  vets:               [{ key: "amenity", values: ["veterinary"] }],
  veterinarian:       [{ key: "amenity", values: ["veterinary"] }],
  veterinarians:      [{ key: "amenity", values: ["veterinary"] }],
  "animal hospital":  [{ key: "amenity", values: ["veterinary"] }],
  "pet clinic":       [{ key: "amenity", values: ["veterinary"] }],
  pet_services:       [{ key: "shop",    values: ["pet", "pet_grooming"] },
                       { key: "amenity", values: ["veterinary"] }],
  "pet services":     [{ key: "shop",    values: ["pet", "pet_grooming"] }],
  pet_grooming:       [{ key: "shop",    values: ["pet_grooming"] }],
  "pet grooming":     [{ key: "shop",    values: ["pet_grooming"] }],
  "dog grooming":     [{ key: "shop",    values: ["pet_grooming"] }],
  "dog groomers":     [{ key: "shop",    values: ["pet_grooming"] }],
  "pet store":        [{ key: "shop",    values: ["pet"] }],
  "pet shop":         [{ key: "shop",    values: ["pet"] }],
  "dog training":     [{ key: "shop",    values: ["pet", "pet_grooming"] }],
  "dog daycare":      [{ key: "shop",    values: ["pet", "pet_grooming"] }],

  // ── Professional Services ────────────────────────────────────────────────────
  real_estate:        [{ key: "office", values: ["estate_agent"] }],
  "real estate":      [{ key: "office", values: ["estate_agent"] }],
  "real estate agent": [{ key: "office", values: ["estate_agent"] }],
  "real estate agents": [{ key: "office", values: ["estate_agent"] }],
  "real estate office": [{ key: "office", values: ["estate_agent"] }],
  realtor:            [{ key: "office", values: ["estate_agent"] }],
  realtors:           [{ key: "office", values: ["estate_agent"] }],
  "property management": [{ key: "office", values: ["estate_agent"] }],
  legal:              [{ key: "office", values: ["lawyer", "notary"] }],
  lawyer:             [{ key: "office", values: ["lawyer"] }],
  lawyers:            [{ key: "office", values: ["lawyer"] }],
  attorney:           [{ key: "office", values: ["lawyer"] }],
  attorneys:          [{ key: "office", values: ["lawyer"] }],
  "law firm":         [{ key: "office", values: ["lawyer"] }],
  "law firms":        [{ key: "office", values: ["lawyer"] }],
  "law office":       [{ key: "office", values: ["lawyer"] }],
  accounting:         [{ key: "office", values: ["accountant", "tax_advisor"] }],
  accountant:         [{ key: "office", values: ["accountant"] }],
  accountants:        [{ key: "office", values: ["accountant"] }],
  "tax preparer":     [{ key: "office", values: ["tax_advisor"] }],
  "tax preparation":  [{ key: "office", values: ["tax_advisor"] }],
  "tax service":      [{ key: "office", values: ["tax_advisor"] }],
  "cpa":              [{ key: "office", values: ["accountant"] }],
  insurance:          [{ key: "office", values: ["insurance"] }],
  "insurance agent":  [{ key: "office", values: ["insurance"] }],
  photography:        [{ key: "shop",   values: ["photo", "photography"] }],
  photographer:       [{ key: "shop",   values: ["photo", "photography"] }],
  photographers:      [{ key: "shop",   values: ["photo", "photography"] }],
  "photo studio":     [{ key: "shop",   values: ["photography"] }],
  "financial advisor": [{ key: "office", values: ["financial"] }],
  "financial planning": [{ key: "office", values: ["financial"] }],
  "mortgage broker":  [{ key: "office", values: ["financial"] }],
  "marketing agency": [{ key: "office", values: ["company"] }],
  "web design":       [{ key: "office", values: ["company"] }],
  "it company":       [{ key: "office", values: ["it"] }],
  "consulting":       [{ key: "office", values: ["consulting"] }],

  // ── Home, Retail & Other ─────────────────────────────────────────────────────
  hardware:           [{ key: "shop", values: ["hardware"] }],
  "hardware store":   [{ key: "shop", values: ["hardware"] }],
  furniture:          [{ key: "shop", values: ["furniture"] }],
  "furniture store":  [{ key: "shop", values: ["furniture"] }],
  laundry:            [{ key: "shop", values: ["laundry", "dry_cleaning"] }],
  laundromat:         [{ key: "shop", values: ["laundry"] }],
  "dry cleaning":     [{ key: "shop", values: ["dry_cleaning"] }],
  "dry cleaner":      [{ key: "shop", values: ["dry_cleaning"] }],
  "dry cleaners":     [{ key: "shop", values: ["dry_cleaning"] }],
  storage:            [{ key: "shop", values: ["storage_rental"] }],
  "self storage":     [{ key: "shop", values: ["storage_rental"] }],
  printing:           [{ key: "shop", values: ["copyshop"] }],
  "print shop":       [{ key: "shop", values: ["copyshop"] }],
  "copy shop":        [{ key: "shop", values: ["copyshop"] }],
  jewelry:            [{ key: "shop", values: ["jewelry", "jewellery"] }],
  jeweler:            [{ key: "shop", values: ["jewelry", "jewellery"] }],
  jewellers:          [{ key: "shop", values: ["jewellery", "jewelry"] }],
  "jewelry store":    [{ key: "shop", values: ["jewelry"] }],
  clothing:           [{ key: "shop", values: ["clothes"] }],
  "clothing store":   [{ key: "shop", values: ["clothes"] }],
  apparel:            [{ key: "shop", values: ["clothes"] }],
  bookstore:          [{ key: "shop", values: ["books"] }],
  bookshop:           [{ key: "shop", values: ["books"] }],
  bookstores:         [{ key: "shop", values: ["books"] }],
  grocery:            [{ key: "shop", values: ["supermarket", "grocery"] }],
  "grocery store":    [{ key: "shop", values: ["supermarket", "grocery"] }],
  supermarket:        [{ key: "shop", values: ["supermarket"] }],
  supermarkets:       [{ key: "shop", values: ["supermarket"] }],

  // ── Hospitality ──────────────────────────────────────────────────────────────
  hotel:              [{ key: "tourism", values: ["hotel"] }],
  hotels:             [{ key: "tourism", values: ["hotel", "motel"] }],
  motel:              [{ key: "tourism", values: ["motel"] }],
  motels:             [{ key: "tourism", values: ["motel"] }],
  hospitality:        [{ key: "tourism", values: ["hotel", "motel", "guest_house"] }],
  "bed and breakfast": [{ key: "tourism", values: ["bed_and_breakfast"] }],
  "b&b":              [{ key: "tourism", values: ["bed_and_breakfast"] }],
  "guest house":      [{ key: "tourism", values: ["guest_house"] }],

  // ── Education & Childcare ────────────────────────────────────────────────────
  education:          [{ key: "amenity", values: ["school", "college", "university"] }],
  school:             [{ key: "amenity", values: ["school"] }],
  schools:            [{ key: "amenity", values: ["school"] }],
  tutoring:           [{ key: "amenity", values: ["school"] }],
  "tutoring center":  [{ key: "amenity", values: ["school"] }],
  childcare:          [{ key: "amenity", values: ["childcare", "kindergarten"] }],
  daycare:            [{ key: "amenity", values: ["childcare"] }],
  "day care":         [{ key: "amenity", values: ["childcare"] }],
  preschool:          [{ key: "amenity", values: ["kindergarten"] }],
  "music school":     [{ key: "amenity", values: ["school"] }],
  "dance studio":     [{ key: "leisure", values: ["fitness_centre"] },
                       { key: "amenity", values: ["school"] }],
  "driving school":   [{ key: "amenity", values: ["driving_school"] }],
  "art studio":       [{ key: "amenity", values: ["school"] }],

  // ── Entertainment ────────────────────────────────────────────────────────────
  cinema:             [{ key: "amenity", values: ["cinema"] }],
  "movie theater":    [{ key: "amenity", values: ["cinema"] }],
  theatre:            [{ key: "amenity", values: ["theatre"] }],
  theater:            [{ key: "amenity", values: ["theatre"] }],
  "escape room":      [{ key: "leisure", values: ["amusement_arcade"] },
                       { key: "amenity", values: ["entertainment_centre"] }],
  "escape rooms":     [{ key: "leisure", values: ["amusement_arcade"] }],
  bowling:            [{ key: "leisure", values: ["bowling_alley"] }],
  "bowling alley":    [{ key: "leisure", values: ["bowling_alley"] }],

  // ── Travel ───────────────────────────────────────────────────────────────────
  travel_agency:      [{ key: "shop", values: ["travel_agency"] }],
  "travel agency":    [{ key: "shop", values: ["travel_agency"] }],
  "travel agent":     [{ key: "shop", values: ["travel_agency"] }],
  "travel agents":    [{ key: "shop", values: ["travel_agency"] }],
};

// ─── Reverse mapping: OSM tags → niche label ──────────────────────────────────

const OSM_TAG_TO_NICHE: ReadonlyArray<{ key: string; value: string; niche: string }> = [
  { key: "shop",      value: "car_repair",        niche: "auto_repair"    },
  { key: "amenity",   value: "car_repair",         niche: "auto_repair"    },
  { key: "amenity",   value: "car_wash",           niche: "car_wash"       },
  { key: "shop",      value: "tyres",              niche: "tire_shop"      },
  { key: "shop",      value: "car",                niche: "auto_dealer"    },
  { key: "amenity",   value: "fuel",               niche: "gas_station"    },
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
  { key: "shop",      value: "moving",             niche: "moving"         },
  { key: "amenity",   value: "restaurant",         niche: "restaurant"     },
  { key: "amenity",   value: "fast_food",          niche: "restaurant"     },
  { key: "amenity",   value: "cafe",               niche: "cafe"           },
  { key: "amenity",   value: "bar",                niche: "bar"            },
  { key: "amenity",   value: "pub",                niche: "bar"            },
  { key: "amenity",   value: "nightclub",          niche: "nightclub"      },
  { key: "amenity",   value: "ice_cream",          niche: "ice_cream"      },
  { key: "shop",      value: "bakery",             niche: "bakery"         },
  { key: "amenity",   value: "dentist",            niche: "dentist"        },
  { key: "amenity",   value: "doctors",            niche: "medical"        },
  { key: "amenity",   value: "clinic",             niche: "medical"        },
  { key: "amenity",   value: "hospital",           niche: "medical"        },
  { key: "amenity",   value: "pharmacy",           niche: "health_wellness"},
  { key: "shop",      value: "optician",           niche: "optician"       },
  { key: "healthcare",value: "alternative",        niche: "chiropractor"   },
  { key: "healthcare",value: "counselling",        niche: "therapist"      },
  { key: "amenity",   value: "physiotherapist",    niche: "physiotherapy"  },
  { key: "leisure",   value: "fitness_centre",     niche: "gym"            },
  { key: "leisure",   value: "sports_centre",      niche: "gym"            },
  { key: "leisure",   value: "spa",                niche: "spa"            },
  { key: "leisure",   value: "swimming_pool",      niche: "swimming"       },
  { key: "leisure",   value: "bowling_alley",      niche: "bowling"        },
  { key: "leisure",   value: "amusement_arcade",   niche: "entertainment"  },
  { key: "shop",      value: "hairdresser",        niche: "hair_salon"     },
  { key: "shop",      value: "barber",             niche: "hair_salon"     },
  { key: "shop",      value: "beauty",             niche: "beauty_salon"   },
  { key: "shop",      value: "tattoo",             niche: "tattoo"         },
  { key: "shop",      value: "nail_salon",         niche: "nail_salon"     },
  { key: "shop",      value: "florist",            niche: "florist"        },
  { key: "amenity",   value: "veterinary",         niche: "veterinary"     },
  { key: "shop",      value: "pet",                niche: "pet_services"   },
  { key: "shop",      value: "pet_grooming",       niche: "pet_services"   },
  { key: "office",    value: "estate_agent",       niche: "real_estate"    },
  { key: "office",    value: "lawyer",             niche: "legal"          },
  { key: "office",    value: "notary",             niche: "legal"          },
  { key: "office",    value: "accountant",         niche: "accounting"     },
  { key: "office",    value: "tax_advisor",        niche: "accounting"     },
  { key: "office",    value: "insurance",          niche: "insurance"      },
  { key: "office",    value: "financial",          niche: "financial"      },
  { key: "shop",      value: "photo",              niche: "photography"    },
  { key: "shop",      value: "photography",        niche: "photography"    },
  { key: "shop",      value: "laundry",            niche: "laundry"        },
  { key: "shop",      value: "dry_cleaning",       niche: "laundry"        },
  { key: "shop",      value: "copyshop",           niche: "printing"       },
  { key: "shop",      value: "jewelry",            niche: "jewelry"        },
  { key: "shop",      value: "jewellery",          niche: "jewelry"        },
  { key: "shop",      value: "clothes",            niche: "clothing"       },
  { key: "shop",      value: "books",              niche: "bookstore"      },
  { key: "shop",      value: "supermarket",        niche: "grocery"        },
  { key: "shop",      value: "grocery",            niche: "grocery"        },
  { key: "shop",      value: "travel_agency",      niche: "travel_agency"  },
  { key: "shop",      value: "storage_rental",     niche: "storage"        },
  { key: "tourism",   value: "hotel",              niche: "hospitality"    },
  { key: "tourism",   value: "motel",              niche: "hospitality"    },
  { key: "amenity",   value: "school",             niche: "education"      },
  { key: "amenity",   value: "childcare",          niche: "childcare"      },
  { key: "amenity",   value: "kindergarten",       niche: "childcare"      },
  { key: "amenity",   value: "cinema",             niche: "entertainment"  },
  { key: "amenity",   value: "theatre",            niche: "entertainment"  },
];

function nicheFromOsmTags(tags: OverpassTags): string {
  for (const { key, value, niche } of OSM_TAG_TO_NICHE) {
    if (tags[key] === value) return niche;
  }
  for (const key of ["amenity", "shop", "craft", "office", "tourism", "leisure", "healthcare"]) {
    const val = tags[key];
    if (val) return val;
  }
  return "local_business";
}

// ─── Query parser ─────────────────────────────────────────────────────────────

interface ParsedQuery { keyword: string; location: string }

function parseQuery(raw: string): ParsedQuery {
  const q = raw.trim();

  // "X in Y" pattern
  const inMatch = q.match(/^(.+?)\s+in\s+(.+)$/i);
  if (inMatch?.[1] && inMatch?.[2]) {
    return { keyword: inMatch[1].trim(), location: inMatch[2].trim() };
  }

  const words = q.split(/\s+/);

  // "keyword City ST" — last token is a 2-letter US state abbreviation
  if (words.length >= 3 && /^[A-Z]{2}$/.test(words[words.length - 1]!)) {
    const keyword  = words.slice(0, -2).join(" ");
    const location = words.slice(-2).join(" ");
    if (keyword) return { keyword, location };
  }

  // "keyword City" — last token is the location
  if (words.length >= 2) {
    return { keyword: words.slice(0, -1).join(" "), location: words[words.length - 1]! };
  }

  return { keyword: q, location: q };
}

function normaliseKeyword(kw: string): string {
  return kw.toLowerCase().trim().replace(/[\s\-]+/g, "_");
}

// ─── Keyword → tag lookup (permissive) ───────────────────────────────────────
//
// Resolution order:
//  1. Exact normalised key  ("auto_repair")
//  2. Raw lower-cased key   ("auto repair")
//  3. Strip trailing "s"    ("restaurants" → "restaurant")
//  4. Strip "ies"→"y"       ("bakeries" → "bakery")
//  5. Longest normalised prefix  ("auto_repair_shop" → "auto_repair" → "auto")

function findOsmTagSets(keyword: string): OsmTagSet[] | null {
  const norm  = normaliseKeyword(keyword);
  const lower = keyword.toLowerCase().trim();

  if (KEYWORD_TO_OSM_TAGS[norm])  return KEYWORD_TO_OSM_TAGS[norm];
  if (KEYWORD_TO_OSM_TAGS[lower]) return KEYWORD_TO_OSM_TAGS[lower];

  // Plural normalisation
  const stripped =
    norm.endsWith("ies") ? norm.slice(0, -3) + "y"  :
    norm.endsWith("es")  ? norm.slice(0, -2)          :
    norm.endsWith("s")   ? norm.slice(0, -1)           :
    null;
  if (stripped && KEYWORD_TO_OSM_TAGS[stripped]) return KEYWORD_TO_OSM_TAGS[stripped];

  // Prefix decomposition: "yoga_studio_near_me" → "yoga_studio" → "yoga"
  const parts = norm.split("_");
  for (let len = parts.length - 1; len >= 1; len--) {
    const prefix = parts.slice(0, len).join("_");
    if (KEYWORD_TO_OSM_TAGS[prefix]) return KEYWORD_TO_OSM_TAGS[prefix];
    // Also try with spaces
    const spaced = parts.slice(0, len).join(" ");
    if (KEYWORD_TO_OSM_TAGS[spaced]) return KEYWORD_TO_OSM_TAGS[spaced];
  }

  return null;
}

// ─── Address utilities ────────────────────────────────────────────────────────

interface BuiltAddress { address: string; city: string }

function buildAddress(tags: OverpassTags, fallbackCity: string): BuiltAddress {
  const street = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ");
  const city   =
    tags["addr:city"]    ??
    tags["addr:town"]    ??
    tags["addr:village"] ??
    tags["addr:suburb"]  ??
    fallbackCity;
  const parts = [street, city, tags["addr:state"], tags["addr:postcode"]].filter(Boolean);
  return { address: parts.length > 0 ? parts.join(", ") : city, city };
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
    new URL(href);
    return href;
  } catch {
    return undefined;
  }
}

// ─── HTTP utilities ───────────────────────────────────────────────────────────

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJson<T>(url: string, init: RequestInit = {}, timeoutMs = NOMINATIM_TIMEOUT_MS): Promise<T> {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal:  ctrl.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept:       "application/json",
        ...(init.headers ?? {}),
      },
    });
    if (res.status === 429 || res.status === 503) {
      throw new ExternalServiceError(
        `Rate limited (HTTP ${res.status}) from ${new URL(url).host}`, true,
        { status: res.status, host: new URL(url).host }
      );
    }
    if (!res.ok) {
      throw new ExternalServiceError(
        `HTTP ${res.status} from ${new URL(url).host}`, res.status >= 500,
        { status: res.status, host: new URL(url).host }
      );
    }
    return res.json() as Promise<T>;
  } catch (err) {
    if ((err as { name?: string }).name === "AbortError") {
      throw new ExternalServiceError(
        `Overpass/Nominatim timed out after ${timeoutMs}ms`, true,
        { url: url.split("?")[0], timeoutMs }
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Retry helper with exponential back-off.
 * @param maxRetries  Total additional attempts after the first (default varies by caller).
 *                    Pass 1 for Overpass (fail fast, fall through to next strategy).
 *                    Pass 3 for Nominatim (more reliable API, worth retrying more).
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = NOMINATIM_MAX_RETRIES,
  baseDelayMs = 800,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (err instanceof ExternalServiceError && !err.retryable) throw err;
      if (attempt < maxRetries) {
        const delay = baseDelayMs * 2 ** attempt + Math.random() * 200;
        logger.warn(
          {
            attempt:    attempt + 1,
            maxRetries,
            delayMs:    Math.round(delay),
            error:      err instanceof Error ? err.message : String(err),
          },
          "OSMMapsService: transient error — retrying"
        );
        await sleep(delay);
      }
    }
  }
  throw lastErr;
}

// ─── Overpass query builders ──────────────────────────────────────────────────
//
// Both builders embed [timeout:N] in the Overpass QL body.  This MUST be less
// than OVERPASS_TIMEOUT_MS so Overpass returns a proper error JSON rather than
// having the HTTP connection abruptly cut by our fetch abort controller.

function buildStructuredQuery(
  tagSets: readonly OsmTagSet[],
  lat: number, lon: number,
  radiusM: number, limit: number
): string {
  // Use nwr (node+way+relation) shorthand to keep clause count low
  const lines: string[] = [`[out:json][timeout:${OVERPASS_QUERY_TIMEOUT_S}];`, "("];
  for (const { key, values } of tagSets) {
    const regex  = values.map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
    const filter = `["${key}"~"^(${regex})$"]["name"]`;
    const bbox   = `(around:${radiusM},${lat},${lon})`;
    lines.push(`  nwr${filter}${bbox};`);
  }
  lines.push(");", `out center ${limit};`);
  return lines.join("\n");
}

/**
 * Builds a name-regex Overpass query using the `nwr` shorthand (node + way +
 * relation in one clause), one clause per commercial tag key.
 *
 * Old approach: 3 OSM types × 8 tag keys = 24 clauses → frequent timeouts on
 * the free public Overpass endpoint.
 * New approach: 1 `nwr` per tag key = 6 clauses → ~4× faster.
 */
function buildNameQuery(
  keyword: string,
  lat: number, lon: number,
  radiusM: number, limit: number
): string {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const lines: string[] = [`[out:json][timeout:${OVERPASS_QUERY_TIMEOUT_S}];`, "("];
  for (const tagKey of BUSINESS_TAG_KEYS) {
    lines.push(`  nwr["name"~"${escaped}",i]["${tagKey}"](around:${radiusM},${lat},${lon});`);
  }
  lines.push(");", `out center ${limit};`);
  return lines.join("\n");
}

// ─── Service implementation ───────────────────────────────────────────────────

export class OSMMapsService implements IMapsService {
  private readonly sessionCache = new Map<string, PlaceResult>();

  // ── searchPlaces ─────────────────────────────────────────────────────────────

  async searchPlaces(query: string): Promise<readonly PlaceResult[]> {
    logger.info({ service: "OSMMapsService", query }, "searchPlaces — start");

    const { keyword, location } = parseQuery(query);
    logger.info({ service: "OSMMapsService", keyword, location }, "Query parsed");

    const { lat, lon, resolvedCity } = await this.geocodeLocation(location);
    logger.info({ service: "OSMMapsService", lat, lon, resolvedCity }, "Location geocoded");

    let places: PlaceResult[] = [];
    let strategy = "none";

    // ── Strategy 1: structured tag search ────────────────────────────────────
    const tagSets = findOsmTagSets(keyword);
    if (tagSets && tagSets.length > 0) {
      logger.info({ service: "OSMMapsService", tagSetCount: tagSets.length }, "Strategy 1: structured tag search");
      places = await this.overpassStructuredSearch(tagSets, keyword, lat, lon, resolvedCity);
      if (places.length > 0) strategy = "structured";
    }

    // ── Strategy 2: Overpass name-based search ────────────────────────────────
    if (places.length < 3) {
      logger.info({ service: "OSMMapsService", keyword, existingCount: places.length }, "Strategy 2: Overpass name search");
      const nameResults = await this.overpassNameSearch(keyword, lat, lon, resolvedCity);
      // Merge — deduplicate by placeId, name search result takes lower priority
      const existingIds = new Set(places.map((p) => p.placeId));
      for (const r of nameResults) {
        if (!existingIds.has(r.placeId)) {
          places.push(r);
          existingIds.add(r.placeId);
        }
      }
      if (strategy === "none" && nameResults.length > 0) strategy = "name_search";
    }

    // ── Strategy 3: Nominatim free-text fallback ──────────────────────────────
    if (places.length < 3) {
      logger.info({ service: "OSMMapsService", existingCount: places.length }, "Strategy 3: Nominatim text search");
      const nomResults = await this.nominatimTextSearch(query, resolvedCity);
      const existingIds = new Set(places.map((p) => p.placeId));
      for (const r of nomResults) {
        if (!existingIds.has(r.placeId)) {
          places.push(r);
          existingIds.add(r.placeId);
        }
      }
      if (strategy === "none" && nomResults.length > 0) strategy = "nominatim";
    }

    // Cap to MAX_RESULTS
    places = places.slice(0, MAX_RESULTS);

    for (const p of places) this.sessionCache.set(p.placeId, p);
    logger.info(
      { service: "OSMMapsService", total: places.length, strategy, withWebsite: places.filter((p) => p.website).length },
      "searchPlaces — complete"
    );
    return places;
  }

  // ── getPlaceDetails ───────────────────────────────────────────────────────────

  async getPlaceDetails(placeId: string): Promise<PlaceResult> {
    const cached = this.sessionCache.get(placeId);
    if (cached) {
      logger.debug({ placeId }, "OSMMapsService: getPlaceDetails — cache hit");
      return cached;
    }
    logger.info({ placeId }, "OSMMapsService: getPlaceDetails — cache miss, fetching");
    return this.fetchElementById(placeId);
  }

  // ── Private: geocoding ────────────────────────────────────────────────────────

  private async geocodeLocation(
    location: string,
  ): Promise<{ lat: number; lon: number; resolvedCity: string }> {
    const url =
      `${NOMINATIM_BASE}/search?` +
      new URLSearchParams({ q: location, format: "json", limit: "1", featuretype: "settlement,country,state" }).toString();

    let results: NominatimGeocode[];
    try {
      results = await withRetry(() => fetchJson<NominatimGeocode[]>(url));
    } catch (err) {
      throw new ExternalServiceError(`Nominatim geocode failed for "${location}": ${String(err)}`, true, { location });
    }
    if (!results.length) {
      throw new ExternalServiceError(`Could not geocode "${location}" — no results from Nominatim`, false, { location });
    }
    const hit  = results[0]!;
    const city = hit.display_name.split(",")[0]?.trim() ?? location;
    return { lat: parseFloat(hit.lat), lon: parseFloat(hit.lon), resolvedCity: city };
  }

  // ── Private: Overpass structured search ──────────────────────────────────────

  private async overpassStructuredSearch(
    tagSets: readonly OsmTagSet[],
    keyword: string, lat: number, lon: number, city: string,
  ): Promise<PlaceResult[]> {
    const oql = buildStructuredQuery(tagSets, lat, lon, SEARCH_RADIUS_M, MAX_RESULTS);
    let response: OverpassResponse;
    try {
      response = await withRetry(
        () => fetchJson<OverpassResponse>(OVERPASS_BASE, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body:   `data=${encodeURIComponent(oql)}`,
        }, OVERPASS_TIMEOUT_MS),
        OVERPASS_MAX_RETRIES,
      );
    } catch (err) {
      logger.warn({ service: "OSMMapsService", err: String(err) }, "Overpass structured search failed — skipping");
      return [];
    }
    const elements = (response.elements ?? []).slice(0, MAX_RESULTS);
    logger.info({ service: "OSMMapsService", count: elements.length, keyword }, "Overpass structured results");
    return elements
      .filter((el): el is OverpassElement & { tags: OverpassTags } => el.tags?.name !== undefined)
      .map((el) => this.elementToPlaceResult(el, city, keyword));
  }

  // ── Private: Overpass name-based search ──────────────────────────────────────

  private async overpassNameSearch(
    keyword: string, lat: number, lon: number, city: string,
  ): Promise<PlaceResult[]> {
    const oql = buildNameQuery(keyword, lat, lon, SEARCH_RADIUS_M, MAX_RESULTS);
    let response: OverpassResponse;
    try {
      response = await withRetry(
        () => fetchJson<OverpassResponse>(OVERPASS_BASE, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body:   `data=${encodeURIComponent(oql)}`,
        }, OVERPASS_TIMEOUT_MS),
        OVERPASS_MAX_RETRIES,
      );
    } catch (err) {
      logger.warn({ service: "OSMMapsService", err: String(err) }, "Overpass name search failed — skipping");
      return [];
    }
    const elements = (response.elements ?? []).slice(0, MAX_RESULTS);
    logger.info({ service: "OSMMapsService", count: elements.length, keyword }, "Overpass name search results");
    return elements
      .filter((el): el is OverpassElement & { tags: OverpassTags } => el.tags?.name !== undefined)
      .map((el) => this.elementToPlaceResult(el, city, keyword));
  }

  // ── Private: Nominatim text search ────────────────────────────────────────────

  private async nominatimTextSearch(query: string, city: string): Promise<PlaceResult[]> {
    const url =
      `${NOMINATIM_BASE}/search?` +
      new URLSearchParams({ q: query, format: "json", limit: String(MAX_RESULTS), addressdetails: "1", extratags: "1" }).toString();
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
      .map((r) => this.nominatimResultToPlaceResult(r, city));
  }

  // ── Private: fetch single element by placeId ─────────────────────────────────

  private async fetchElementById(placeId: string): Promise<PlaceResult> {
    const match = placeId.match(/^osm-(node|way|relation)-(\d+)$/);
    if (!match) {
      throw new ExternalServiceError(`Invalid OSM placeId format: "${placeId}"`, false, { placeId });
    }
    const osmType = match[1] as "node" | "way" | "relation";
    const osmId   = match[2]!;
    const outMode = osmType === "node" ? "out tags;" : "out tags center;";
    const oql     = `[out:json][timeout:${OVERPASS_QUERY_TIMEOUT_S}];\n${osmType}(${osmId});\n${outMode}`;

    let response: OverpassResponse;
    try {
      response = await withRetry(
        () => fetchJson<OverpassResponse>(OVERPASS_BASE, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body:   `data=${encodeURIComponent(oql)}`,
        }, OVERPASS_TIMEOUT_MS),
        OVERPASS_MAX_RETRIES,
      );
    } catch (err) {
      throw new ExternalServiceError(`Overpass fetch by ID failed for "${placeId}": ${String(err)}`, true, { placeId });
    }
    const el = response.elements?.[0];
    if (!el?.tags?.name) {
      throw new ExternalServiceError(`OSM element "${placeId}" not found or has no name tag`, false, { placeId });
    }
    const result = this.elementToPlaceResult(
      el as OverpassElement & { tags: OverpassTags }, "", nicheFromOsmTags(el.tags!)
    );
    this.sessionCache.set(placeId, result);
    return result;
  }

  // ── Private: mapping helpers ──────────────────────────────────────────────────

  private elementToPlaceResult(
    el: OverpassElement & { tags: OverpassTags },
    fallbackCity: string,
    nicheHint: string,
  ): PlaceResult {
    const tags              = el.tags;
    const { address, city } = buildAddress(tags, fallbackCity);
    const niche             = nicheFromOsmTags(tags) || normaliseKeyword(nicheHint) || "local_business";
    const phone             = extractPhone(tags);
    const website           = extractWebsite(tags);
    return {
      placeId:      `osm-${el.type}-${el.id}`,
      businessName: tags.name!,
      address,
      city:         city || fallbackCity,
      niche,
      reviewCount:  0,
      ...(phone   !== undefined && { phone }),
      ...(website !== undefined && { website }),
      source: "osm_fallback" as const,
    };
  }

  private nominatimResultToPlaceResult(
    r: NominatimSearchResult,
    fallbackCity: string,
  ): PlaceResult {
    const addr = r.address ?? {};
    const city = addr.city ?? addr.town ?? addr.village ?? addr.suburb ?? fallbackCity;

    const streetPart = [addr.house_number, addr.road].filter(Boolean).join(" ");
    const address    = [streetPart, city, addr.state, addr.postcode].filter(Boolean).join(", ") || r.display_name;

    const ext     = r.extratags ?? {};
    const phone   = ext.phone ?? ext["contact:phone"];
    const website = ext.website ?? ext["contact:website"];

    const fakeTags: OverpassTags = {};
    if (r.class && r.type) fakeTags[r.class] = r.type;
    const niche = nicheFromOsmTags(fakeTags) || r.type || "local_business";

    let sanitisedWebsite: string | undefined;
    if (website) {
      try {
        const href = website.startsWith("http") ? website : `https://${website}`;
        new URL(href);
        sanitisedWebsite = href;
      } catch { sanitisedWebsite = undefined; }
    }

    return {
      placeId:     `osm-${r.osm_type}-${r.osm_id}`,
      businessName: r.display_name.split(",")[0]?.trim() ?? "Unknown",
      address,
      city,
      niche,
      reviewCount: 0,
      ...(phone            !== undefined && { phone }),
      ...(sanitisedWebsite !== undefined && { website: sanitisedWebsite }),
      source: "osm_fallback" as const,
    };
  }
}
