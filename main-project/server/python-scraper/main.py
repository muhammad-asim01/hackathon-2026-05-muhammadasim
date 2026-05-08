"""
Python scraper sidecar — FastAPI service.

Endpoints:
  POST /crawl       → CrawlResponse    (Playwright + httpx hybrid)
  POST /pagespeed   → PageSpeedResponse (Google PageSpeed Insights)
  GET  /health      → { status: "ok" }

Architecture:
  - FastAPI starts immediately — browser is NOT launched on startup.
  - Playwright Browser is created lazily on the first /crawl request
    (asyncio.Lock guarantees a single shared instance across requests).
  - asyncio.Semaphore caps concurrent Playwright contexts at MAX_CONCURRENT_CRAWLS=3.
  - httpx.AsyncClient is created in the lifespan (lightweight, no OS deps).
  - Never exposed to the internet — called only by Node.js.
"""

import asyncio
import logging
import os
from contextlib import asynccontextmanager

import httpx
import uvicorn
from fastapi import FastAPI, HTTPException, Request
from playwright.async_api import Browser, Playwright, async_playwright

from config import settings
from models import CrawlRequest, CrawlResponse, PageSpeedRequest, PageSpeedResponse
from scrapers.crawler import crawl
from scrapers.pagespeed import analyze_pagespeed

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)

# ── Lazy browser state ─────────────────────────────────────────────────────────
# Browser is created on the first /crawl request, not at startup.
# This lets FastAPI boot and pass the healthcheck before Chromium loads.

_pw: Playwright | None = None
_browser: Browser | None = None
_browser_lock = asyncio.Lock()


async def get_browser() -> Browser:
    """Return the shared browser, launching it on first call."""
    global _pw, _browser
    if _browser is not None and _browser.is_connected():
        return _browser
    async with _browser_lock:
        if _browser is None or not _browser.is_connected():
            log.info("Launching Playwright browser (first crawl request)...")
            _pw = await async_playwright().start()
            _browser = await _pw.chromium.launch(
                headless=True,
                args=[
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
                    "--disable-extensions",
                    "--no-first-run",
                ],
            )
            log.info("Playwright browser ready.")
    return _browser


# ── Lifespan — httpx client only; NO browser here ─────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("Starting up: creating httpx client and semaphore...")

    http_client = httpx.AsyncClient(
        headers={"User-Agent": _USER_AGENT},
        follow_redirects=True,
        timeout=httpx.Timeout(30.0),
    )
    semaphore = asyncio.Semaphore(settings.MAX_CONCURRENT_CRAWLS)

    app.state.http_client = http_client
    app.state.semaphore = semaphore
    app.state.pagespeed_api_key = settings.GOOGLE_PAGESPEED_API_KEY

    log.info("Ready — browser will launch on first /crawl request.")

    yield

    log.info("Shutting down: closing httpx client and browser (if started)...")
    await http_client.aclose()
    global _browser, _pw
    if _browser is not None:
        await _browser.close()
    if _pw is not None:
        await _pw.stop()
    log.info("Shutdown complete.")


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(title="LocalPulse Scraper Sidecar", version="1.0.0", lifespan=lifespan)


# ── Routes ────────────────────────────────────────────────────────────────────


@app.get("/health")
async def health():
    """Lightweight — no browser dependency. Always responds once FastAPI boots."""
    return {"status": "ok"}


@app.post("/crawl", response_model=CrawlResponse)
async def crawl_route(body: CrawlRequest, request: Request):
    """
    Full website audit: loads page with Playwright, extracts audit signals
    and contact emails. Browser is started lazily on first call.
    """
    log.info(f"POST /crawl url={body.url}")
    try:
        browser = await get_browser()
        async with request.app.state.semaphore:
            result = await crawl(
                url=body.url,
                browser=browser,
                http_client=request.app.state.http_client,
            )
        log.info(f"POST /crawl done url={body.url} emails={len(result.emails)}")
        return result
    except Exception as exc:
        log.error(f"POST /crawl failed url={body.url} error={exc}")
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.post("/pagespeed", response_model=PageSpeedResponse)
async def pagespeed_route(body: PageSpeedRequest, request: Request):
    """
    Fetch Google PageSpeed Insights scores (desktop + mobile in parallel).
    """
    log.info(f"POST /pagespeed url={body.url}")
    try:
        result = await analyze_pagespeed(
            url=body.url,
            api_key=request.app.state.pagespeed_api_key,
            client=request.app.state.http_client,
        )
        log.info(
            f"POST /pagespeed done url={body.url} "
            f"desktop={result.desktop.score} mobile={result.mobile.score}"
        )
        return result
    except httpx.HTTPStatusError as exc:
        status = exc.response.status_code
        log.error(f"POST /pagespeed PSI API error url={body.url} status={status}")
        raise HTTPException(
            status_code=502,
            detail=f"PageSpeed API returned {status}",
        ) from exc
    except Exception as exc:
        log.error(f"POST /pagespeed failed url={body.url} error={exc}")
        raise HTTPException(status_code=502, detail=str(exc)) from exc


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    PORT = int(os.environ.get("PORT", 8001))
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=PORT,
        reload=False,
        log_level="info",
    )
