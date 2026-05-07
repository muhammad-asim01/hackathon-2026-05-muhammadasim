"""
Hybrid httpx + Playwright crawler.

Flow mirrors PageCrawler.ts exactly:
  1. Launch a Playwright browser context, visit the URL.
  2. Extract audit signals (SSL, mobile meta, meta tags, CTA, contact form).
  3. Extract emails from homepage HTML (mailto links → regex fallback).
  4. If still no emails: try /contact, /about, /contact-us.
       Primary  → httpx plain HTTP (fast, ~10–50 ms) — mirrors Cheerio fast-path.
       Fallback → Playwright navigation (handles JS + anti-bot).

A shared Browser object is passed in from the FastAPI lifespan.
A shared httpx.AsyncClient is passed in for the fast-path fetches.
"""

import re
import time
from urllib.parse import urlparse

import httpx
from playwright.async_api import Browser

from models import CrawlResponse
from utils.email_extractor import extract_mailto_emails, parse_emails

# ── Timeouts ───────────────────────────────────────────────────────────────────

PAGE_TIMEOUT_MS = 20_000
EMAIL_PAGE_TIMEOUT_MS = 12_000
HTTP_TIMEOUT_SECS = 5.0

# ── Resource blocking (mirrors BLOCKED_RESOURCES in PageCrawler.ts) ───────────

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

# ── Helpers ────────────────────────────────────────────────────────────────────


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
            # Non-2xx means page doesn't exist — no emails, skip Playwright fallback
            return []

        html = res.text

        # mailto links — highest confidence
        mailto = extract_mailto_emails(html)
        if mailto:
            return mailto

        return parse_emails(html, site_domain)

    except Exception:
        # Network failure, timeout, etc. → signal Playwright fallback
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
        # calls route handlers as handler(route).  Access the request via
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

        # ── Step 2: Audit signals ─────────────────────────────────────────────
        # Bug fix: wrap every selector call in try/except to mirror the
        # .catch(() => "") / .catch(() => 0) patterns in PageCrawler.ts.
        # Playwright raises TimeoutError when a required element is absent.

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

        try:
            clickable_texts = await page.locator("button, a, [role='button']").all_text_contents()
        except Exception:
            clickable_texts = []
        has_cta = any(
            pat in text.strip().lower()
            for text in clickable_texts
            for pat in _CTA_PATTERNS
        )

        # ── Step 3: Email extraction from homepage HTML ────────────────────────
        site_domain = _extract_domain(final_url)
        html = await page.content()

        # mailto links first (highest confidence), then full regex scan
        emails = extract_mailto_emails(html) or parse_emails(html, site_domain)

        # ── Step 4: Secondary pages if homepage had no emails ──────────────────
        if not emails:
            origin = _extract_origin(final_url)

            for path in ("/contact", "/about", "/contact-us"):
                if emails:
                    break

                target_url = f"{origin}{path}"

                # Primary: httpx fast-path (no extra browser navigation)
                httpx_result = await _extract_emails_httpx(target_url, site_domain, http_client)

                if httpx_result is not None:
                    # Fetch succeeded — accept result (may be empty, continue to next path)
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
                    sub_html = await page.content()
                    emails = extract_mailto_emails(sub_html) or parse_emails(sub_html, site_domain)
                except Exception:
                    pass  # Page not reachable — skip

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
