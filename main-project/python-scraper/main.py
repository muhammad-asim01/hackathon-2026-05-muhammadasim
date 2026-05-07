"""
Python scraper sidecar — FastAPI service on port 8001.

Endpoints:
  POST /crawl       → CrawlResponse    (Playwright + httpx hybrid)
  POST /pagespeed   → PageSpeedResponse (Google PageSpeed Insights)
  GET  /health      → { status: "ok" }

Architecture:
  - One shared Playwright Browser launched at startup, closed on shutdown.
  - One shared httpx.AsyncClient for fast HTTP fetches and PSI API calls.
  - asyncio.Semaphore caps concurrent Playwright contexts at MAX_CONCURRENT_CRAWLS=3,
    matching Node.js BATCH_SIZE=3 in RunPipeline.ts.
  - Never exposed to the internet — called only by Node.js on localhost:8001.
"""

import asyncio
import logging
from contextlib import asynccontextmanager

import httpx
import uvicorn
from fastapi import FastAPI, HTTPException, Request
from playwright.async_api import async_playwright

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


# ── Lifespan — shared resources ───────────────────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("Starting up: launching Playwright browser and httpx client...")

    pw = await async_playwright().start()

    browser = await pw.chromium.launch(
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

    http_client = httpx.AsyncClient(
        headers={"User-Agent": _USER_AGENT},
        follow_redirects=True,
        timeout=httpx.Timeout(30.0),
    )

    semaphore = asyncio.Semaphore(settings.MAX_CONCURRENT_CRAWLS)

    app.state.browser = browser
    app.state.http_client = http_client
    app.state.semaphore = semaphore
    app.state.pagespeed_api_key = settings.GOOGLE_PAGESPEED_API_KEY

    log.info(
        "Ready — Playwright browser launched, httpx client ready. "
        f"Max concurrent crawls: {settings.MAX_CONCURRENT_CRAWLS}"
    )

    yield

    log.info("Shutting down: closing browser and httpx client...")
    await http_client.aclose()
    await browser.close()
    await pw.stop()
    log.info("Shutdown complete.")


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(title="LocalPulse Scraper Sidecar", version="1.0.0", lifespan=lifespan)


# ── Routes ────────────────────────────────────────────────────────────────────


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/crawl", response_model=CrawlResponse)
async def crawl_route(body: CrawlRequest, request: Request):
    """
    Full website audit: loads page with Playwright, extracts audit signals
    and contact emails. Mirrors PageCrawler.crawl() in Node.js.
    """
    log.info(f"POST /crawl url={body.url}")
    try:
        async with request.app.state.semaphore:
            result = await crawl(
                url=body.url,
                browser=request.app.state.browser,
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
    Mirrors PageSpeedService.analyze() in Node.js.
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
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=False,
        log_level="info",
    )
