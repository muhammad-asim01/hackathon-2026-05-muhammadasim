"""
Google PageSpeed Insights client.

Mirrors PageSpeedService.ts exactly:
  - Calls the v5 Lighthouse API for both desktop and mobile in parallel.
  - Extracts: performance score, TTI (loadTimeMs), FCP, LCP.
  - apiKey is optional — omit for unauthenticated requests (dev/rate-limited).

Improvements over the original:
  - Retry with exponential backoff on 429 (rate limit) and transient 5xx errors.
  - return_exceptions=True in gather() so one strategy failure is isolated.
  - Explicit re-raise lets the caller (main.py) surface the right HTTP status.
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

            # Retry on rate limit or transient server errors
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
                res.raise_for_status()

            res.raise_for_status()
            return _extract_metrics(res.json())

        except httpx.HTTPStatusError:
            raise  # Non-retryable HTTP errors (4xx other than 429) propagate immediately

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
