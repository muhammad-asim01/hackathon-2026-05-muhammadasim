/**
 * WebsiteEmailExtractor — extracts a contact email address from a website
 * homepage using a plain HTTP fetch + regex scan.
 *
 * Strategy (in priority order):
 *   1. `mailto:` anchor href values
 *   2. Emails near contact-intent keywords ("contact", "email us", "reach us")
 *   3. Common inbox patterns: contact@, info@, hello@, enquiries@, bookings@
 *   4. Any email address found in the HTML body
 *
 * Returns null if nothing is found or the request fails — callers treat null
 * as "no email, skip send" not as an error.
 */
import { logger } from "@/utils/logger";

// ─── Constants ────────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 8_000;
const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const USER_AGENT = "Mozilla/5.0 (compatible; SiftBot/1.0; +https://sift.ai)";

// Addresses that are almost certainly not business contacts
const NOISE_PATTERNS = [
  "@sentry.io",
  "@example.com",
  "@test.",
  "noreply@",
  "no-reply@",
  "bounce@",
  "mailer-daemon@",
  "postmaster@",
  "@w3.org",
  "@schema.org",
  "@2x.",   // image filenames like logo@2x.png parsed as email
  ".png@",
  ".jpg@",
  ".svg@",
];

// Prioritised inbox prefixes — prefer these over random addresses
const PRIORITY_PREFIXES = [
  "contact@",
  "info@",
  "hello@",
  "hi@",
  "enquiries@",
  "enquiry@",
  "bookings@",
  "booking@",
  "appointments@",
  "office@",
  "admin@",
  "team@",
  "support@",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isNoise(email: string): boolean {
  const lower = email.toLowerCase();
  return NOISE_PATTERNS.some((p) => lower.includes(p));
}

function priorityScore(email: string): number {
  const lower = email.toLowerCase();
  const idx = PRIORITY_PREFIXES.findIndex((p) => lower.startsWith(p));
  if (idx !== -1) return PRIORITY_PREFIXES.length - idx; // higher = earlier in list
  return 0;
}

// Extract `mailto:` values from raw HTML
function extractMailtoHrefs(html: string): string[] {
  const matches: string[] = [];
  const re = /mailto:([^\s"'?#<>]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const email = (m[1] ?? "").split("?")[0]!.trim();
    if (email.includes("@")) matches.push(email);
  }
  return matches;
}

// ─── Extractor ────────────────────────────────────────────────────────────────

export class WebsiteEmailExtractor {
  async extract(websiteUrl: string): Promise<string | null> {
    const log = logger.child({ fn: "WebsiteEmailExtractor.extract", url: websiteUrl });

    let html: string;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        const res = await fetch(websiteUrl, {
          signal: controller.signal,
          headers: { "User-Agent": USER_AGENT },
          redirect: "follow",
        });
        html = await res.text();
      } finally {
        clearTimeout(timer);
      }
    } catch {
      // Network error, timeout, or SSL failure — treat as no email found
      log.debug("Email extraction: fetch failed — returning null");
      return null;
    }

    // Collect candidates from all strategies
    const candidates = new Set<string>();

    // 1. mailto: hrefs (most explicit)
    for (const e of extractMailtoHrefs(html)) candidates.add(e.toLowerCase());

    // 2. Regex scan of full HTML
    const regexMatches = html.match(EMAIL_REGEX) ?? [];
    for (const e of regexMatches) candidates.add(e.toLowerCase());

    // Filter noise
    const clean = [...candidates].filter((e) => !isNoise(e));
    if (clean.length === 0) {
      log.debug("Email extraction: no addresses found");
      return null;
    }

    // Sort: priority inboxes first, then alphabetical
    clean.sort((a, b) => priorityScore(b) - priorityScore(a));

    const result = clean[0] ?? null;
    log.info({ email: result, candidateCount: clean.length }, "Email extracted from website");
    return result;
  }
}
