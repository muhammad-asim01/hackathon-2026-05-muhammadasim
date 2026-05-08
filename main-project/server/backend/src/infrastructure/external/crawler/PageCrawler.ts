import { chromium, type Browser, type Page } from "playwright";
import * as cheerio from "cheerio";
import type { IPageCrawler, CrawlResult } from "@/application/ports/IPageCrawler";
import { ExternalServiceError } from "@/domain/errors";
import { logger } from "@/utils/logger";

// ─── Timeouts ─────────────────────────────────────────────────────────────────

const PAGE_TIMEOUT_MS       = 20_000;   // main homepage load (Playwright)
const EMAIL_PAGE_TIMEOUT_MS = 12_000;   // secondary page Playwright fallback
const CHEERIO_TIMEOUT_MS    =  5_000;   // Cheerio HTTP fetch (fast path)

// ─── Resource blocking ────────────────────────────────────────────────────────
// Block bandwidth-heavy types — we only need HTML + JS for email extraction.

const BLOCKED_RESOURCES = new Set(["image", "media", "font", "stylesheet"]);

// ─── CTA patterns ─────────────────────────────────────────────────────────────

const CTA_PATTERNS = [
  "book now", "book appointment", "book online",
  "contact us", "get a quote", "get a free quote",
  "get estimate", "free consultation",
  "call now", "call us", "call today",
  "schedule", "request service", "request a callback",
  "order now", "order online", "buy now",
  "get started", "sign up",
];

// ─── Email extraction ─────────────────────────────────────────────────────────

/**
 * Broad regex that matches emails anywhere in raw HTML:
 *   - href="mailto:..." attributes
 *   - Visible text
 *   - data-* attributes
 *   - JS string literals
 *   - HTML comments
 */
const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

/** Domains / patterns that are never real contact emails */
const NOISE_PATTERNS: RegExp[] = [
  /noreply/i, /no-reply/i, /donotreply/i, /do-not-reply/i,
  /mailer-daemon/i, /postmaster/i, /webmaster/i, /bounce/i,
  /@sentry\./i, /@bugsnag\./i, /@rollbar\./i,
  /\.png$/i, /\.jpg$/i, /\.gif$/i, /\.svg$/i, /\.webp$/i,
  /@example\./i, /@yourdomain\./i, /@domain\./i, /@test\./i,
  /localhost/i,
  // Website builder / CDN domains — appear in HTML but aren't contact emails
  /wixpress\.com/i, /wix\.com/i,
  /squarespace\.com/i, /squarespace-mail/i,
  /shopify\.com/i, /myshopify\.com/i,
  /godaddy\.com/i,
  /googleapis\.com/i, /google\.com/i,
  /cloudflare\.com/i, /cloudfront\.net/i,
  /amazonaws\.com/i, /sendgrid\./i, /mailchimp\./i,
  /typeform\./i, /hubspot\./i, /salesforce\./i,
];

/**
 * Popular consumer / business email providers.
 * Small businesses very often use Gmail / Outlook instead of a custom domain,
 * so we always keep emails from these even when domain tokens don't overlap.
 */
const ALLOWED_PROVIDERS = new Set([
  "gmail.com", "googlemail.com",
  "yahoo.com", "yahoo.co.uk",
  "hotmail.com", "hotmail.co.uk",
  "outlook.com", "outlook.co.uk",
  "live.com", "msn.com",
  "icloud.com", "me.com", "mac.com",
  "protonmail.com", "proton.me",
  "fastmail.com", "zoho.com",
]);

/** Lower = higher priority in results */
function priority(email: string): number {
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  if (local === "contact")   return 0;
  if (local === "hello")     return 1;
  if (local === "info")      return 2;
  if (local === "sales")     return 3;
  if (local === "support")   return 4;
  if (local === "admin")     return 5;
  if (local === "office")    return 6;
  if (local === "team")      return 7;
  if (local === "enquiries") return 8;
  if (local === "enquiry")   return 9;
  if (local === "mail")      return 10;
  return 99; // personal / unknown
}

function isNoise(email: string): boolean {
  return NOISE_PATTERNS.some((p) => p.test(email));
}

/**
 * Run regex over `source` (raw HTML or plain text), deduplicate, filter noise,
 * optionally filter by site domain, and priority-sort.
 */
function parseEmails(source: string, siteDomain?: string): string[] {
  const raw = source.match(EMAIL_REGEX) ?? [];
  const seen = new Set<string>();
  const out:  string[] = [];

  for (const raw_email of raw) {
    const email  = raw_email.toLowerCase().trim();
    if (seen.has(email)) continue;
    seen.add(email);

    if (isNoise(email)) continue;

    const emailDomain = email.split("@")[1] ?? "";

    if (ALLOWED_PROVIDERS.has(emailDomain)) {
      out.push(email);
      continue;
    }

    if (siteDomain) {
      const siteParts  = siteDomain.replace(/^www\./, "").split(".");
      const emailParts = emailDomain.split(".");
      const overlap    = siteParts.some((p) => emailParts.includes(p));
      if (!overlap && priority(email) === 99) continue;
    }

    out.push(email);
  }

  return out.sort((a, b) => priority(a) - priority(b));
}

// ─── Cheerio fast-path ────────────────────────────────────────────────────────

/**
 * Fast email extraction via plain HTTP GET + Cheerio — no browser launched.
 * Typically 10–50 ms vs 3–10 s for Playwright.
 *
 * Strategy (matches user-reference implementation):
 *   1. mailto: links  → highest confidence, direct signal
 *   2. Full HTML regex → catches emails in data-* attrs, JS literals, comments
 *
 * Returns:
 *   string[]  — fetch succeeded; list may be empty if no emails found
 *   null      — fetch failed (anti-bot block, network error, non-2xx)
 *               → caller should fall back to Playwright
 */
async function extractEmailsCheerio(
  url: string,
  siteDomain?: string
): Promise<string[] | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(CHEERIO_TIMEOUT_MS),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      },
    });

    // Non-2xx (e.g. 404 on /contact) → page doesn't exist → no fallback needed
    if (!res.ok) return [];

    const html = await res.text();
    const $    = cheerio.load(html);

    // ── 1. mailto: links — highest confidence ────────────────────────────
    const mailtoEmails: string[] = [];
    $('a[href^="mailto:"]').each((_i, el) => {
      const href  = $(el).attr("href") ?? "";
      const email = href.replace(/^mailto:/i, "").split("?")[0]?.trim().toLowerCase() ?? "";
      if (email && !isNoise(email)) mailtoEmails.push(email);
    });

    if (mailtoEmails.length > 0) {
      return mailtoEmails.sort((a, b) => priority(a) - priority(b));
    }

    // ── 2. Full HTML regex ────────────────────────────────────────────────
    return parseEmails(html, siteDomain);
  } catch {
    // Timeout, network failure, CORS, etc. → signal Playwright fallback
    return null;
  }
}

// ─── Playwright email extraction ──────────────────────────────────────────────

/**
 * Extract emails from one already-loaded Playwright page.
 *
 * Strategy (in order — stops at first hit):
 *   1. mailto: href attributes   → most reliable, direct signal
 *   2. Full raw HTML (page.content()) → catches emails in attributes, JS, comments
 */
async function extractEmailsFromPage(page: Page, siteDomain?: string): Promise<string[]> {
  // ── 1. mailto: links — highest confidence ────────────────────────────────
  const mailtoEmails = await page
    .locator("a[href^='mailto:']")
    .evaluateAll((els: unknown[]) =>
      (els as Array<{ getAttribute(k: string): string | null }>)
        .map((el) => el.getAttribute("href") ?? "")
        .filter(Boolean)
        .map((href) =>
          href
            .replace(/^mailto:/i, "")
            .split("?")[0]
            ?.trim() ?? ""
        )
        .filter(Boolean)
    )
    .catch((): string[] => []);

  const cleanedMailto = mailtoEmails
    .map((e) => e.toLowerCase())
    .filter((e) => !isNoise(e))
    .sort((a, b) => priority(a) - priority(b));

  if (cleanedMailto.length > 0) {
    return cleanedMailto;
  }

  // ── 2. Full HTML via regex ────────────────────────────────────────────────
  // page.content() returns the complete rendered HTML including <script> blocks,
  // HTML comments, data-* attributes — far more comprehensive than innerText().
  const html = await page.content().catch(() => "");
  return parseEmails(html, siteDomain);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); }
  catch { return ""; }
}

function extractOrigin(url: string): string {
  try { const u = new URL(url); return `${u.protocol}//${u.host}`; }
  catch { return url; }
}

// ─── PageCrawler ──────────────────────────────────────────────────────────────

/**
 * Hybrid Cheerio + Playwright page crawler.
 *
 * Full flow per URL:
 *   Step 1 — OSM gives us the website URL (passed in as `url`)
 *   Step 2 — Launch Chromium (headless), visit URL — Playwright handles JS
 *   Step 3 — Extract full page HTML via page.content()
 *   Step 4 — Run email regex over raw HTML + check mailto: hrefs (Playwright)
 *   Step 5 — If still no email: for each of /contact, /about, /contact-us:
 *               PRIMARY  → Cheerio (fast plain HTTP GET, ~10–50 ms)
 *               FALLBACK → Playwright navigation (if Cheerio fetch fails)
 *
 * Cheerio is used as the primary strategy for secondary pages because:
 *   - No extra browser launch (Playwright instance already running for Step 2)
 *   - ~60–70% of pages serve emails in static HTML — no JS needed
 *   - Playwright fallback covers JS-rendered pages and anti-bot challenges
 *
 * Opens a fresh browser per crawl; ALWAYS closes in finally — EC2 t3.micro safety.
 * Concurrency is capped at BATCH_SIZE=3 in RunPipeline.
 */
export class PageCrawler implements IPageCrawler {
  async crawl(url: string): Promise<CrawlResult> {
    const log = logger.child({ fn: "PageCrawler.crawl", url });
    const startedAt = Date.now();

    let browser: Browser | null = null;
    let page:    Page    | null = null;

    try {
      // ── Step 2: Launch Chromium ───────────────────────────────────────────
      browser = await chromium.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--disable-extensions",
          "--no-first-run",
        ],
      });

      page = await browser.newPage();

      // Block images / fonts / CSS to keep crawl fast
      await page.route("**/*", (route) => {
        if (BLOCKED_RESOURCES.has(route.request().resourceType())) {
          void route.abort();
        } else {
          void route.continue();
        }
      });

      await page.setViewportSize({ width: 1280, height: 800 });
      await page.setExtraHTTPHeaders({
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      });

      // ── Step 2 cont.: Visit the URL — Playwright handles JS execution ─────
      log.info("Navigating to homepage");
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: PAGE_TIMEOUT_MS });

      const loadTimeMs = Date.now() - startedAt;
      const finalUrl   = page.url();
      log.info({ finalUrl, loadTimeMs }, "Page loaded");

      // ── Audit signals ─────────────────────────────────────────────────────
      const hasSSL = finalUrl.startsWith("https://");

      const viewportContent = await page
        .getAttribute('meta[name="viewport"]', "content")
        .catch(() => "");
      const hasMobileMeta = /width=device-width/i.test(viewportContent ?? "");

      const titleText      = await page.textContent("title").catch(() => "");
      const metaDescContent = await page
        .getAttribute('meta[name="description"]', "content")
        .catch(() => "");
      const hasMetaTags =
        (titleText ?? "").trim().length > 0 &&
        (metaDescContent ?? "").trim().length > 0;

      const formCount = await page
        .locator('form:has(input[type="email"]), form:has(textarea)')
        .count()
        .catch(() => 0);
      const hasContactForm = formCount > 0;

      const clickableTexts = await page
        .locator("button, a, [role='button']")
        .allTextContents()
        .catch((): string[] => []);
      const hasCTA = clickableTexts.some((t) => {
        const lower = t.trim().toLowerCase();
        return CTA_PATTERNS.some((p) => lower.includes(p));
      });

      // ── Steps 3 & 4: Playwright — extract emails from homepage HTML ───────
      const siteDomain = extractDomain(finalUrl);
      log.info({ siteDomain }, "Extracting emails from homepage (Playwright)");

      let emails = await extractEmailsFromPage(page, siteDomain);
      log.info({ count: emails.length, found: emails.slice(0, 3) }, "Homepage email extraction done");

      // ── Step 5: Secondary pages — Cheerio first, Playwright fallback ──────
      if (emails.length === 0) {
        const origin     = extractOrigin(finalUrl);
        const extraPaths = ["/contact", "/about", "/contact-us"];

        for (const path of extraPaths) {
          if (emails.length > 0) break;

          const targetUrl = `${origin}${path}`;

          // ── PRIMARY: Cheerio (fast plain HTTP GET, no extra browser nav) ──
          log.info({ targetUrl, method: "cheerio" }, "Trying secondary page via Cheerio");
          const cheerioResult = await extractEmailsCheerio(targetUrl, siteDomain);

          if (cheerioResult !== null) {
            // Fetch succeeded — accept the result (may be empty, move to next path)
            if (cheerioResult.length > 0) {
              log.info(
                { targetUrl, method: "cheerio", count: cheerioResult.length },
                "Emails found via Cheerio"
              );
              emails = cheerioResult;
            } else {
              log.debug({ targetUrl }, "Cheerio: page exists but no emails found");
            }
            continue;
          }

          // ── FALLBACK: Playwright (handles JS rendering, anti-bot) ─────────
          log.info({ targetUrl, method: "playwright" }, "Cheerio failed — falling back to Playwright");
          try {
            await page.goto(targetUrl, {
              waitUntil: "domcontentloaded",
              timeout:   EMAIL_PAGE_TIMEOUT_MS,
            });
            emails = await extractEmailsFromPage(page, siteDomain);
            if (emails.length > 0) {
              log.info(
                { targetUrl, method: "playwright", count: emails.length },
                "Emails found via Playwright fallback"
              );
            }
          } catch {
            log.debug({ targetUrl }, "Secondary page not reachable — skipping");
          }
        }
      }

      log.info(
        { emailCount: emails.length, emails: emails.slice(0, 3) },
        "Email extraction complete"
      );

      const result: CrawlResult = {
        hasSSL,
        hasMobileMeta,
        hasMetaTags,
        hasContactForm,
        hasCTA,
        loadTimeMs,
        emails,
      };

      log.info(result, "Page crawl complete");
      return result;

    } catch (err) {
      if (err instanceof ExternalServiceError) throw err;
      throw new ExternalServiceError(
        `Page crawl failed for ${url}: ${String(err)}`,
        true,
        { url }
      );
    } finally {
      // ALWAYS close — critical for EC2 t3.micro memory stability
      if (page)    await page.close().catch(() => null);
      if (browser) await browser.close().catch(() => null);
    }
  }

  async shutdown(): Promise<void> {
    // No persistent browser — each crawl owns its own lifecycle
  }
}
