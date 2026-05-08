"""
Google PageSpeed Insights client.

Mirrors PageSpeedService.ts exactly:
  - Calls the v5 Lighthouse API for both desktop and mobile in parallel.
  - Extracts: performance score, TTI (loadTimeMs), FCP, LCP.
  - apiKey is optional — omit for unauthenticated requests (dev/rate-limited).

Error handling:
  - 400 from Google = URL not publicly accessible from Google's servers
    (private IP, site blocking Google's crawler, etc.).
    Treated as graceful "no data" — returns zero metrics so the rest of the
    audit (crawl structural signals, email extraction) can still complete.
  - 429 / 5xx = retried with exponential backoff (up to _MAX_RETRIES).
  - Network errors = retried.
  - All non-retryable errors include the Google API response body for debugging.
"""

import asyncio
import logging

import httpx

from models import PageSpeedMetrics, PageSpeedResponse

log = logging.getLogger(__name__)

PSI_BASE = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"
TIMEOUT_SECS = 30.0

# Retry config: up to 2 retries on 429 / 5xx, with increasing backoff
_MAX_RETRIES = 2
_RETRY_DELAYS = (2.0, 5.0)  # seconds between attempt 1→2 and 2→3

# Zero-score sentinel returned when Google PSI can't access the URL (400).
# Downstream scoring treats 0 the same as "PSI not run" — both contribute 0 pts.
_ZERO_METRICS = PageSpeedMetrics(score=0, loadTimeMs=0, fcp=0, lcp=0)


def _extract_google_error(res: httpx.Response) -> str:
    """
    Pull the human-readable message from a Google API error response body.
    Returns a short string suitable for logging and HTTP error details.
    """
    try:
        data = res.json()
        msg = (data.get("error") or {}).get("message", "")
        if msg:
            return msg
        # Fallback: first 300 chars of raw body
        return res.text[:300]
    except Exception:
        return res.text[:300]


def _extract_metrics(data: dict) -> PageSpeedMetrics:  # type: ignore[type-arg]
    lhr = data.get("lighthouseResult") or data
    categories = lhr.get("categories") or {}
    audits = lhr.get("audits") or {}

    perf_score = (categories.get("performance") or {}).get("score") or 0
    tti = (audits.get("interactive") or {}).get("numericValue") or 0
    fcp = (audits.get("first-contentful-paint") or {}).get("numericValue") or 0
    lcp = (audits.get("largest-contentful-paint") or {}).get("numericValue") or 0

    return PageSpeedMetrics(
        score=round(perf_score * 100),
        loadTimeMs=round(tti),
        fcp=round(fcp),
        lcp=round(lcp),
    )


async def _fetch_strategy(
    url: str,
    strategy: str,
    api_key: str,
    client: httpx.AsyncClient,
) -> PageSpeedMetrics:
    params: dict[str, str] = {
        "url": url,
        "strategy": strategy,
        "category": "performance",
    }
    if api_key:
        params["key"] = api_key

    last_exc: Exception | None = None

    for attempt in range(_MAX_RETRIES + 1):
        try:
            res = await client.get(PSI_BASE, params=params, timeout=TIMEOUT_SECS)

            # ── 400: URL not accessible from Google's servers ─────────────────
            # This is NOT a bug in our code — it means Google's crawler cannot
            # reach the target URL (private network, bot-blocking, CGNAT, etc.).
            # Return zero metrics so the crawl audit can still complete cleanly.
            if res.status_code == 400:
                google_msg = _extract_google_error(res)
                log.warning(
                    "PSI 400 for %s [%s] — Google cannot access this URL (%s). "
                    "Returning zero metrics; structural crawl signals still apply.",
                    url,
                    strategy,
                    google_msg,
                )
                return _ZERO_METRICS

            # ── 429 / 5xx: transient — retry with backoff ─────────────────────
            if res.status_code == 429 or res.status_code >= 500:
                if attempt < _MAX_RETRIES:
                    delay = _RETRY_DELAYS[min(attempt, len(_RETRY_DELAYS) - 1)]
                    log.warning(
                        "PSI %s for %s/%s — retrying in %.1fs (attempt %d/%d)",
                        res.status_code,
                        url,
                        strategy,
                        delay,
                        attempt + 1,
                        _MAX_RETRIES,
                    )
                    await asyncio.sleep(delay)
                    continue
                # Retries exhausted — raise with the response body for context
                google_msg = _extract_google_error(res)
                raise httpx.HTTPStatusError(
                    f"PSI {res.status_code} after {_MAX_RETRIES} retries for "
                    f"{url}/{strategy}: {google_msg}",
                    request=res.request,
                    response=res,
                )

            # ── Other 4xx: unexpected — fail fast with full body ──────────────
            if not res.is_success:
                google_msg = _extract_google_error(res)
                raise httpx.HTTPStatusError(
                    f"PSI {res.status_code} for {url}/{strategy}: {google_msg}",
                    request=res.request,
                    response=res,
                )

            return _extract_metrics(res.json())

        except httpx.HTTPStatusError:
            raise  # Already annotated above — propagate as-is

        except (httpx.TimeoutException, httpx.NetworkError) as exc:
            last_exc = exc
            if attempt < _MAX_RETRIES:
                delay = _RETRY_DELAYS[min(attempt, len(_RETRY_DELAYS) - 1)]
                log.warning(
                    "PSI network error for %s/%s — retrying in %.1fs (attempt %d/%d): %s",
                    url,
                    strategy,
                    delay,
                    attempt + 1,
                    _MAX_RETRIES,
                    exc,
                )
                await asyncio.sleep(delay)
                continue

    raise last_exc or RuntimeError(
        f"PSI {strategy} failed after {_MAX_RETRIES} retries for {url}"
    )


async def analyze_pagespeed(
    url: str,
    api_key: str,
    client: httpx.AsyncClient,
) -> PageSpeedResponse:
    """
    Fetch desktop + mobile PageSpeed scores in parallel.

    return_exceptions=True isolates failures per-strategy so one transient error
    doesn't silently discard the other result. Both must succeed — errors re-raised
    to the caller (main.py) which maps them to the correct HTTP status.

    A 400 from Google is handled inside _fetch_strategy and returns zero metrics
    rather than raising, so this function always returns a valid PageSpeedResponse
    even when Google cannot reach the target URL.
    """
    results = await asyncio.gather(
        _fetch_strategy(url, "desktop", api_key, client),
        _fetch_strategy(url, "mobile", api_key, client),
        return_exceptions=True,
    )

    desktop, mobile = results[0], results[1]

    if isinstance(desktop, BaseException):
        raise desktop
    if isinstance(mobile, BaseException):
        raise mobile

    return PageSpeedResponse(desktop=desktop, mobile=mobile)
