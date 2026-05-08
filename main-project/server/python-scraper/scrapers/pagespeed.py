"""
Google PageSpeed Insights client.

Mirrors PageSpeedService.ts exactly:
  - Calls the v5 Lighthouse API for both desktop and mobile in parallel.
  - Extracts: performance score, TTI (loadTimeMs), FCP, LCP.
  - apiKey is optional — omit for unauthenticated requests (dev/rate-limited).
"""

import asyncio

import httpx

from models import PageSpeedMetrics, PageSpeedResponse

PSI_BASE = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"
TIMEOUT_SECS = 30.0


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

    res = await client.get(PSI_BASE, params=params, timeout=TIMEOUT_SECS)
    res.raise_for_status()
    return _extract_metrics(res.json())


async def analyze_pagespeed(
    url: str,
    api_key: str,
    client: httpx.AsyncClient,
) -> PageSpeedResponse:
    desktop, mobile = await asyncio.gather(
        _fetch_strategy(url, "desktop", api_key, client),
        _fetch_strategy(url, "mobile", api_key, client),
    )
    return PageSpeedResponse(desktop=desktop, mobile=mobile)
