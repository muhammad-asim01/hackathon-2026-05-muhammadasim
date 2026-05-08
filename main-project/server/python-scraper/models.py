from pydantic import BaseModel


# ── /crawl ────────────────────────────────────────────────────────────────────


class CrawlRequest(BaseModel):
    url: str


class CrawlResponse(BaseModel):
    """Mirrors CrawlResult in backend/src/application/ports/IPageCrawler.ts exactly."""

    hasSSL: bool
    hasMobileMeta: bool
    hasMetaTags: bool
    hasCTA: bool
    hasContactForm: bool
    loadTimeMs: int
    emails: list[str]


# ── /pagespeed ────────────────────────────────────────────────────────────────


class PageSpeedRequest(BaseModel):
    url: str


class PageSpeedMetrics(BaseModel):
    """Mirrors PageSpeedMetrics in backend/src/application/ports/IPageSpeedService.ts."""

    score: int  # 0–100
    loadTimeMs: int  # interactive (TTI) in ms
    fcp: int  # first contentful paint ms
    lcp: int  # largest contentful paint ms


class PageSpeedResponse(BaseModel):
    """Mirrors PageSpeedResult in IPageSpeedService.ts."""

    desktop: PageSpeedMetrics
    mobile: PageSpeedMetrics
