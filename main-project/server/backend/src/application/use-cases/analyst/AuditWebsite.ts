import type { IPageSpeedService } from "@/application/ports/IPageSpeedService";
import type { IPageCrawler } from "@/application/ports/IPageCrawler";
import type { IAuditRepository } from "@/application/ports/IAuditRepository";
import type { ILeadRepository } from "@/application/ports/ILeadRepository";
import type { PlaceResult } from "@/application/ports/IMapsService";
import type { AuditRecord } from "@/domain/types";
import { LeadScore } from "@/domain/value-objects/LeadScore";
import { logger } from "@/utils/logger";

export interface AuditWebsiteInput {
  readonly leadId: string;
  readonly place: PlaceResult;
}

export interface AuditWebsiteOutput {
  readonly audit: AuditRecord;
  readonly score: LeadScore;
  /** Emails extracted from the website by the Playwright crawler (priority-sorted). */
  readonly extractedEmails: readonly string[];
}

/**
 * Score formula (max 100):
 *  No website → hard cap at 20 (rating + reviews only)
 *  With website:
 *    SSL                  10 pts   (binary)
 *    Mobile usability     20 pts   (PSI mobile score/100 * 20; fallback: hasMobileMeta ? 20 : 0)
 *    SEO                  15 pts   (hasMetaTags — title + meta description)
 *    UX                   15 pts   (hasCTA 7.5 + hasContactForm 7.5)
 *    PageSpeed            40 pts   (PSI desktop score/100 * 40)
 *
 * Total weight: 100 pts.
 * Businesses with high existing quality (low score → strong digital presence)
 * are skipped upstream by DiscoverBusinesses before reaching this auditor.
 */
function computeScore(
  place: PlaceResult,
  crawl: { hasSSL: boolean; hasMobileMeta: boolean; hasMetaTags: boolean; hasCTA: boolean; hasContactForm: boolean } | null,
  psiDesktopScore: number | null,
  psiMobileScore: number | null
): number {
  if (!place.website) {
    // No website — score based on social proof signals only (max 20).
    // Floor at 1 so that null = "not yet audited" and 1–20 = "audited, no web presence".
    // A score of 0 would be indistinguishable from "not audited" in the frontend.
    const ratingScore = ((place.googleRating ?? 0) / 5) * 10;
    const reviewScore = Math.min((place.reviewCount / 200) * 10, 10);
    return Math.max(1, Math.min(Math.round(ratingScore + reviewScore), 20));
  }

  // ── SSL: 10 pts ────────────────────────────────────────────────────────────
  const sslPts = crawl?.hasSSL ? 10 : 0;

  // ── Mobile usability: 20 pts ───────────────────────────────────────────────
  // Prefer real PSI mobile score; fall back to viewport-meta binary check
  const mobilePts =
    psiMobileScore !== null
      ? (psiMobileScore / 100) * 20
      : crawl?.hasMobileMeta
        ? 20
        : 0;

  // ── SEO: 15 pts ────────────────────────────────────────────────────────────
  const seoPts = crawl?.hasMetaTags ? 15 : 0;

  // ── UX: 15 pts (CTA 7.5 + contact form 7.5) ───────────────────────────────
  const ctaPts = crawl?.hasCTA ? 7.5 : 0;
  const formPts = crawl?.hasContactForm ? 7.5 : 0;

  // ── PageSpeed: 40 pts ──────────────────────────────────────────────────────
  const pagespeedPts =
    psiDesktopScore !== null ? (psiDesktopScore / 100) * 40 : 0;

  const total = sslPts + mobilePts + seoPts + ctaPts + formPts + pagespeedPts;
  return Math.min(Math.round(total), 100);
}

export class AuditWebsite {
  constructor(
    private readonly pageSpeed: IPageSpeedService,
    private readonly crawler: IPageCrawler,
    private readonly auditRepo: IAuditRepository,
    private readonly leadRepo: ILeadRepository
  ) {}

  async execute(input: AuditWebsiteInput): Promise<AuditWebsiteOutput> {
    const { leadId, place } = input;
    const log = logger.child({ useCase: "AuditWebsite", leadId, placeId: place.placeId });

    let crawlResult: Awaited<ReturnType<IPageCrawler["crawl"]>> | null = null;
    let extractedEmails: readonly string[] = [];
    let psiDesktopScore: number | null = null;
    let psiMobileScore: number | null = null;
    let psiLoadTimeMs: number | null = null;

    if (place.website) {
      // Crawl + PageSpeed in parallel — fastest possible wall-clock time
      const [crawlSettled, psiSettled] = await Promise.allSettled([
        this.crawler.crawl(place.website),
        this.pageSpeed.analyze(place.website),
      ]);

      if (crawlSettled.status === "fulfilled") {
        crawlResult = crawlSettled.value;
        console.log("crawlResult.emails", crawlResult.emails)
        extractedEmails = crawlResult.emails;
      } else {
        log.warn({ err: crawlSettled.reason }, "Page crawl failed — skipping crawl signals");
      }

      if (psiSettled.status === "fulfilled") {
        psiDesktopScore = psiSettled.value.desktop.score;
        psiMobileScore = psiSettled.value.mobile.score;
        psiLoadTimeMs = psiSettled.value.desktop.loadTimeMs;
      } else {
        log.warn({ err: psiSettled.reason }, "PageSpeed analysis failed — skipping PSI signals");
      }
    }

    const scoreValue = computeScore(place, crawlResult, psiDesktopScore, psiMobileScore);
    const score = LeadScore.create(scoreValue);

    const rawFindings: Record<string, unknown> = {
      website: place.website ?? null,
      crawl: crawlResult,
      psiDesktopScore,
      psiMobileScore,
    };

    const audit = await this.auditRepo.create({
      leadId,
      ...(psiDesktopScore !== null && { pageSpeedScore: psiDesktopScore }),
      ...(psiMobileScore !== null && { mobileScore: psiMobileScore }),
      ...(psiLoadTimeMs !== null && { loadTimeMs: psiLoadTimeMs }),
      hasSSL: crawlResult?.hasSSL ?? false,
      hasMobileMeta: crawlResult?.hasMobileMeta ?? false,
      hasMetaTags: crawlResult?.hasMetaTags ?? false,
      hasCTA: crawlResult?.hasCTA ?? false,
      reviewSummary: {},
      rawFindings,
    });

    // Determine top issue for Writer context
    let topIssue: string | undefined;
    if (crawlResult) {
      if (!crawlResult.hasSSL) topIssue = "no HTTPS (SSL certificate missing)";
      else if (!crawlResult.hasMobileMeta) topIssue = "not mobile-optimized";
      else if (!crawlResult.hasMetaTags) topIssue = "missing meta title/description (invisible to Google)";
      else if (!crawlResult.hasCTA) topIssue = "no clear call-to-action";
      else if (!crawlResult.hasContactForm) topIssue = "no contact form";
    } else if (!place.website) {
      topIssue = "no website found";
    }

    const primaryEmail = extractedEmails[0];
    await this.leadRepo.update(leadId, {
      status: "AUDITED",
      digitalScore: scoreValue,
      ...(topIssue !== undefined && { topIssue }),
      ...(primaryEmail !== undefined && { contactEmail: primaryEmail }),
    });

    log.info(
      { score: scoreValue, topIssue, emailsFound: extractedEmails.length, contactEmail: primaryEmail ?? null },
      primaryEmail
        ? `Audit complete — contactEmail "${primaryEmail}" written to lead`
        : "Audit complete — no contact email found"
    );

    return { audit, score, extractedEmails };
  }
}
