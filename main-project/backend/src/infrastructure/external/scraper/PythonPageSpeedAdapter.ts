import { z } from "zod";
import type { IPageSpeedService, PageSpeedResult } from "@/application/ports/IPageSpeedService";
import { ExternalServiceError } from "@/domain/errors";
import { logger } from "@/utils/logger";

const TIMEOUT_MS = 35_000;

const MetricsSchema = z.object({
  score:      z.number(),
  loadTimeMs: z.number(),
  fcp:        z.number(),
  lcp:        z.number(),
});

const PageSpeedResponseSchema = z.object({
  desktop: MetricsSchema,
  mobile:  MetricsSchema,
});

/**
 * Delegates PageSpeed analysis to the Python FastAPI sidecar (localhost:8001/pagespeed).
 * Drop-in replacement for PageSpeedService — implements the same IPageSpeedService port.
 */
export class PythonPageSpeedAdapter implements IPageSpeedService {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async analyze(url: string): Promise<PageSpeedResult> {
    const log = logger.child({ fn: "PythonPageSpeedAdapter.analyze", url });

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/pagespeed`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ url }),
        signal:  AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      throw new ExternalServiceError(
        `Python scraper unreachable for pagespeed ${url}: ${String(err)}`,
        true,
        { url }
      );
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new ExternalServiceError(
        `Python scraper /pagespeed returned ${res.status}: ${body.slice(0, 200)}`,
        res.status >= 500,
        { url, status: res.status }
      );
    }

    let raw: unknown;
    try {
      raw = await res.json();
    } catch {
      throw new ExternalServiceError(
        "Python scraper /pagespeed returned invalid JSON",
        false,
        { url }
      );
    }

    const parsed = PageSpeedResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ExternalServiceError(
        `Python scraper /pagespeed response schema mismatch: ${parsed.error.message}`,
        false,
        { url }
      );
    }

    log.info(
      { desktop: parsed.data.desktop.score, mobile: parsed.data.mobile.score },
      "PageSpeed complete via Python sidecar"
    );
    return parsed.data;
  }
}
