import type { IPageSpeedService, PageSpeedMetrics, PageSpeedResult } from "@/application/ports/IPageSpeedService";
import { ExternalServiceError } from "@/domain/errors";
import { logger } from "@/utils/logger";

const PSI_BASE = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const TIMEOUT_MS = 30_000;

interface PsiCategory {
  score: number | null;
}

interface PsiAuditResult {
  numericValue?: number;
}

interface PsiResponse {
  categories?: {
    performance?: PsiCategory;
  };
  audits?: {
    "interactive"?: PsiAuditResult;
    "first-contentful-paint"?: PsiAuditResult;
    "largest-contentful-paint"?: PsiAuditResult;
    [key: string]: PsiAuditResult | undefined;
  };
  lighthouseResult?: {
    categories?: { performance?: PsiCategory };
    audits?: Record<string, PsiAuditResult>;
  };
}

function extractMetrics(data: PsiResponse): PageSpeedMetrics {
  const lhr = data.lighthouseResult ?? data;
  const perfScore = (lhr.categories?.performance?.score ?? 0) * 100;
  const audits = lhr.audits ?? {};
  const tti = audits["interactive"]?.numericValue ?? 0;
  const fcp = audits["first-contentful-paint"]?.numericValue ?? 0;
  const lcp = audits["largest-contentful-paint"]?.numericValue ?? 0;

  return {
    score: Math.round(perfScore),
    loadTimeMs: Math.round(tti),
    fcp: Math.round(fcp),
    lcp: Math.round(lcp),
  };
}

async function fetchStrategy(url: string, strategy: "desktop" | "mobile", apiKey: string): Promise<PageSpeedMetrics> {
  const params = new URLSearchParams({
    url,
    strategy,
    category: "performance",
    ...(apiKey ? { key: apiKey } : {}),
  });

  const endpoint = `${PSI_BASE}?${params.toString()}`;
  const log = logger.child({ fn: "PageSpeedService.fetchStrategy", strategy, url });

  let response: Response;
  try {
    response = await fetch(endpoint, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    throw new ExternalServiceError(
      `PageSpeed API request failed (${strategy}): ${String(err)}`,
      true,
      { url, strategy }
    );
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new ExternalServiceError(
      `PageSpeed API returned ${response.status} (${strategy})`,
      response.status >= 500,
      { url, strategy, status: response.status, body: body.slice(0, 300) }
    );
  }

  let data: PsiResponse;
  try {
    data = (await response.json()) as PsiResponse;
  } catch {
    throw new ExternalServiceError("PageSpeed API returned invalid JSON", false, { url, strategy });
  }

  const metrics = extractMetrics(data);
  log.info({ score: metrics.score, loadTimeMs: metrics.loadTimeMs }, "PSI result");
  return metrics;
}

export class PageSpeedService implements IPageSpeedService {
  constructor(private readonly apiKey: string) {}

  async analyze(url: string): Promise<PageSpeedResult> {
    // Desktop + mobile in parallel — halves wall-clock time
    const [desktop, mobile] = await Promise.all([
      fetchStrategy(url, "desktop", this.apiKey),
      fetchStrategy(url, "mobile", this.apiKey),
    ]);
    return { desktop, mobile };
  }
}
