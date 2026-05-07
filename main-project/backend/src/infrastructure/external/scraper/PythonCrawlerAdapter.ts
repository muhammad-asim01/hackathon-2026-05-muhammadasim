import { z } from "zod";
import type { IPageCrawler, CrawlResult } from "@/application/ports/IPageCrawler";
import { ExternalServiceError } from "@/domain/errors";
import { logger } from "@/utils/logger";

const TIMEOUT_MS = 35_000;

const CrawlResponseSchema = z.object({
  hasSSL:          z.boolean(),
  hasMobileMeta:   z.boolean(),
  hasMetaTags:     z.boolean(),
  hasCTA:          z.boolean(),
  hasContactForm:  z.boolean(),
  loadTimeMs:      z.number(),
  emails:          z.array(z.string()),
});

/**
 * Delegates crawling to the Python FastAPI sidecar (localhost:8001/crawl).
 * Drop-in replacement for PageCrawler — implements the same IPageCrawler port.
 */
export class PythonCrawlerAdapter implements IPageCrawler {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async crawl(url: string): Promise<CrawlResult> {
    const log = logger.child({ fn: "PythonCrawlerAdapter.crawl", url });

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/crawl`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ url }),
        signal:  AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      throw new ExternalServiceError(
        `Python scraper unreachable for ${url}: ${String(err)}`,
        true,
        { url }
      );
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new ExternalServiceError(
        `Python scraper /crawl returned ${res.status}: ${body.slice(0, 200)}`,
        res.status >= 500,
        { url, status: res.status }
      );
    }

    let raw: unknown;
    try {
      raw = await res.json();
    } catch {
      throw new ExternalServiceError("Python scraper /crawl returned invalid JSON", false, { url });
    }

    const parsed = CrawlResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ExternalServiceError(
        `Python scraper /crawl response schema mismatch: ${parsed.error.message}`,
        false,
        { url }
      );
    }

    log.info({ emailCount: parsed.data.emails.length }, "Crawl complete via Python sidecar");
    return parsed.data;
  }

  async shutdown(): Promise<void> {
    // No local resources — Python sidecar manages its own lifecycle
  }
}
