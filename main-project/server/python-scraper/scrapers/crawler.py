"""
Hybrid httpx + Playwright crawler.

Flow mirrors PageCrawler.ts exactly:
  1. Launch a Playwright browser context, visit the URL.
  2. Extract audit signals (SSL, mobile meta, meta tags, CTA, contact form).
  3. Extract emails in priority order:
       a. JSON-LD / schema.org structured data  (highest confidence — explicitly authored)
       b. <address> tags                         (semantic HTML for contact info)
       c. <a href="mailto:"> links               (explicit intent)
       d. Visible-text regex                     (scripts/styles stripped before matching)
  4. If still no emails: try /contact, /about, /contact-us.
       Primary  → httpx plain HTTP (fast, ~10–50 ms) — mirrors Cheerio fast-path.
       Fallback → Playwright navigation (handles JS + anti-bot).
       Guard    → skip if secondary page redirects back to homepage root.

A shared Browser object is passed in from the FastAPI lifespan.
A shared httpx.AsyncClient is passed in for the fast-path fetches.
"""

import json
import re
import time
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup
from playwright.async_api import Browser

from models import CrawlResponse
from utils.email_extractor import (
    extract_mailto_emails,
    is_noise,
    is_valid_email,
    parse_emails,
    _priority,
)

# ── Timeouts ───────────────────────────────────────────────────────────────────

PAGE_TIMEOUT_MS = 20_000
EMAIL_PAGE_TIMEOUT_MS = 12_000
HTTP_TIMEOUT_SECS = 5.0

# ── Resource blocking ──────────────────────────────────────────────────────────
# Scripts are intentionally NOT blocked — we need JS execution so that
# dynamically-rendered content appears in page.content().
# Images, media, fonts, and stylesheets add latency without providing usable data.

_BLOCKED_RESOURCES = frozenset({"image", "media", "font", "stylesheet"})

# ── CTA patterns (mirrors CTA_PATTERNS in PageCrawler.ts exactly) ─────────────

_CTA_PATTERNS = (
    "book now",
    "book appointment",
    "book online",
    "contact us",
    "get a quote",
    "get a free quote",
    "get estimate",
    "free consultation",
    "call now",
    "call us",
    "call today",
    "schedule",
    "request service",
    "request a callback",
    "order now",
    "order online",
    "buy now",
    "get started",
    "sign up",
)

_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)

# ── URL helpers ────────────────────────────────────────────────────────────────


def _extract_domain(url: str) -> str:
    try:
        return (urlparse(url).hostname or "").removeprefix("www.")
    except Exception:
        return ""


def _extract_origin(url: str) -> str:
    try:
        p = urlparse(url)
        return f"{p.scheme}://{p.netloc}"
    except Exception:
        return url


def _is_homepage_redirect(navigated_url: str, homepage_url: str) -> bool:
    """
    Return True when a secondary-page navigation landed back at the homepage.
    Compares scheme + netloc + path (ignoring query params and fragments).
    Prevents re-scraping homepage HTML when /contact doesn't exist.
    """
    try:
        a = urlparse(navigated_url)
        b = urlparse(homepage_url)
        return (a.scheme, a.netloc, a.path.rstrip("/")) == (
            b.scheme,
            b.netloc,
            b.path.rstrip("/"),
        )
    except Exception:
        return False


# ── Structured-data email extraction (JSON-LD) ────────────────────────────────


def _collect_emails_from_obj(obj: object, out: list[str]) -> None:
    """Recursively walk a JSON-decoded object, collecting values of 'email' keys."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k.lower() == "email" and isinstance(v, str) and "@" in v:
                out.append(v)
            else:
                _collect_emails_from_obj(v, out)
    elif isinstance(obj, list):
        for item in obj:
            _collect_emails_from_obj(item, out)


def _extract_jsonld_emails(html: str) -> list[str]:
    """
    Parse all <script type="application/ld+json"> blocks and recursively collect
    any 'email' field values.

    Schema.org markup is intentionally authored by the site owner — it's the
    highest-confidence source of contact data available in plain HTML.
    """
    raw: list[str] = []
    soup = BeautifulSoup(html, "lxml")

    for tag in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(tag.string or "")
        except (json.JSONDecodeError, TypeError):
            continue
        _collect_emails_from_obj(data, raw)

    seen: set[str] = set()
    out: list[str] = []
    for e in raw:
        e = e.lower().strip()
        if e not in seen and is_valid_email(e) and not is_noise(e):
            seen.add(e)
            out.append(e)
    return sorted(out, key=_priority)


# ── <address> tag email extraction ────────────────────────────────────────────


def _extract_address_tag_emails(html: str, site_domain: str | None = None) -> list[str]:
    """
    Extract emails from <address> elements — the semantic HTML element for
    contact information. High signal, low noise.
    """
    soup = BeautifulSoup(html, "lxml")
    combined = " ".join(tag.get_text(separator=" ") for tag in soup.find_all("address"))
    if not combined.strip():
        return []
    return parse_emails(combined, site_domain)


# ── httpx fast-path (mirrors extractEmailsCheerio in PageCrawler.ts) ──────────


async def _extract_emails_httpx(
    url: str,
    site_domain: str | None,
    client: httpx.AsyncClient,
) -> list[str] | None:
    """
    Returns:
      list[str]  — fetch succeeded; may be empty if no emails found.
      None       — fetch failed (timeout, network error) → caller uses Playwright.
    """
    try:
        res = await client.get(
            url,
            timeout=HTTP_TIMEOUT_SECS,
            follow_redirects=True,
        )
        if not res.is_success:
            # Non-2xx → page doesn't exist; skip Playwright fallback too
            return []

        html = res.text

        # Try channels in priority order for the fast-path as well
        return (
            _extract_jsonld_emails(html)
            or _extract_address_tag_emails(html, site_domain)
            or extract_mailto_emails(html)
            or parse_emails(html, site_domain)
        )

    except Exception:
        # Network failure, timeout → signal caller to use Playwright fallback
        return None


# ── Main crawl function ────────────────────────────────────────────────────────


async def crawl(
    url: str,
    browser: Browser,
    http_client: httpx.AsyncClient,
) -> CrawlResponse:
    start_ms = int(time.monotonic() * 1000)

    # Bug fix: initialise to None so the finally block is safe even if
    # new_context() or new_page() raises before assignment.
    context = None
    page = None

    try:
        context = await browser.new_context(
            user_agent=_USER_AGENT,
            viewport={"width": 1280, "height": 800},
        )
        page = await context.new_page()

        # Bug fix: handler must take exactly ONE argument — Playwright Python
        # calls route handlers as handler(route). Access the request via
        # route.request (not a second positional parameter).
        async def _block_resources(route) -> None:  # type: ignore[type-arg]
            if route.request.resource_type in _BLOCKED_RESOURCES:
                await route.abort()
            else:
                await route.continue_()

        await page.route("**/*", _block_resources)

        # ── Step 1: Load homepage ──────────────────────────────────────────────
        await page.goto(url, wait_until="domcontentloaded", timeout=PAGE_TIMEOUT_MS)

        load_time_ms = int(time.monotonic() * 1000) - start_ms
        final_url = page.url
        homepage_origin = _extract_origin(final_url)

        # ── Step 2: Audit signals ─────────────────────────────────────────────
        has_ssl = final_url.startswith("https://")

        try:
            viewport_content = await page.get_attribute('meta[name="viewport"]', "content") or ""
        except Exception:
            viewport_content = ""
        has_mobile_meta = bool(re.search(r"width=device-width", viewport_content, re.I))

        try:
            title_text = (await page.text_content("title") or "").strip()
        except Exception:
            title_text = ""
        try:
            meta_desc = (
                await page.get_attribute('meta[name="description"]', "content") or ""
            ).strip()
        except Exception:
            meta_desc = ""
        has_meta_tags = len(title_text) > 0 and len(meta_desc) > 0

        try:
            form_count = await page.locator(
                'form:has(input[type="email"]), form:has(textarea)'
            ).count()
        except Exception:
            form_count = 0
        has_contact_form = form_count > 0

        # CTA: search full body text instead of iterating N elements.
        # One Playwright round-trip vs potentially thousands; same detection quality.
        try:
            body_text = (await page.locator("body").text_content() or "").lower()
            has_cta = any(pat in body_text for pat in _CTA_PATTERNS)
        except Exception:
            has_cta = False

        # ── Step 3: Email extraction from homepage ─────────────────────────────
        site_domain = _extract_domain(final_url)
        html = await page.content()

        # Channel 1: JSON-LD structured data — highest confidence (explicitly authored)
        emails = _extract_jsonld_emails(html)

        # Channel 2: <address> tags — semantic HTML designed for contact info
        if not emails:
            emails = _extract_address_tag_emails(html, site_domain)

        # Channel 3: explicit mailto: links — clear intent
        if not emails:
            emails = extract_mailto_emails(html)

        # Channel 4: visible-text regex — scripts/styles stripped internally before matching
        if not emails:
            emails = parse_emails(html, site_domain)

        # ── Step 4: Secondary pages if homepage had no emails ──────────────────
        if not emails:
            for path in ("/contact", "/about", "/contact-us"):
                if emails:
                    break

                target_url = f"{homepage_origin}{path}"

                # Primary: httpx fast-path (no extra browser navigation)
                httpx_result = await _extract_emails_httpx(target_url, site_domain, http_client)

                if httpx_result is not None:
                    if httpx_result:
                        emails = httpx_result
                    continue

                # Fallback: Playwright (handles JS rendering and anti-bot)
                try:
                    await page.goto(
                        target_url,
                        wait_until="domcontentloaded",
                        timeout=EMAIL_PAGE_TIMEOUT_MS,
                    )
                    # Skip if the site redirected back to the homepage root
                    # (means the secondary page doesn't exist)
                    if _is_homepage_redirect(page.url, final_url):
                        continue

                    sub_html = await page.content()
                    emails = (
                        _extract_jsonld_emails(sub_html)
                        or _extract_address_tag_emails(sub_html, site_domain)
                        or extract_mailto_emails(sub_html)
                        or parse_emails(sub_html, site_domain)
                    )
                except Exception:
                    pass  # Page not reachable — try next path

        return CrawlResponse(
            hasSSL=has_ssl,
            hasMobileMeta=has_mobile_meta,
            hasMetaTags=has_meta_tags,
            hasCTA=has_cta,
            hasContactForm=has_contact_form,
            loadTimeMs=load_time_ms,
            emails=emails,
        )

    finally:
        # None-safe cleanup — guards against new_context / new_page failures
        if page is not None:
            await page.close()
        if context is not None:
            await context.close()
