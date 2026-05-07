/**
 * Debug router — individual agent-step smoke tests.
 * Only mounted in development (NODE_ENV !== "production").
 *
 * All endpoints use real infrastructure services wired in the DI container.
 * No mock data — every response reflects genuine OSM discovery, Playwright
 * crawls, Google PageSpeed Insights, and real LLM output (Claude or MockLLM
 * per env config). Audit records and email drafts are persisted to the DB.
 *
 * POST /api/debug/scout       { query }              → DiscoverBusinesses (OSM + WebsiteEmailExtractor)
 * POST /api/debug/crawl       { url, leadId? }       → PageCrawler; persists AuditRecord when leadId given
 * POST /api/debug/pagespeed   { url, leadId? }       → PageSpeedService; persists AuditRecord when leadId given
 * POST /api/debug/writer      { leadId, wordLimit? } → GenerateOutreachEmail; email draft persisted to DB
 * POST /api/debug/approve     { emailId }            → ApproveAndSendEmail (MockEmailSender in dev)
 */
import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { z } from "zod";

import { container } from "@/config/container";
import type { PlaceResult } from "@/application/ports/IMapsService";
import type { AuditRecord } from "@/domain/types";
import { logger } from "@/utils/logger";

// ─── Router ───────────────────────────────────────────────────────────────────

const router = Router();
const log = logger.child({ router: "debug" });

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ok(res: Response, data: unknown) {
  res.json({ ok: true, data });
}

function wrap(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next);
}

// ─── 1. Scout ─────────────────────────────────────────────────────────────────

const scoutSchema = z.object({
  query: z.string().min(3, "query must be at least 3 characters"),
});

router.post(
  "/scout",
  wrap(async (req, res) => {
    const { query } = scoutSchema.parse(req.body);
    log.info({ query }, "debug/scout — real OSM discovery");

    const result = await container.discoverBusinesses.execute({ query });

    ok(res, {
      placesFound: result.places.length,
      skippedExisting: result.skippedExisting,
      places: result.places,
    });
  })
);

// ─── 2. Crawler (Playwright) ──────────────────────────────────────────────────

const crawlSchema = z.object({
  url: z.string().url("must be a valid URL"),
  leadId: z.string().optional(),
});

router.post(
  "/crawl",
  wrap(async (req, res) => {
    const { url, leadId } = crawlSchema.parse(req.body);
    log.info({ url, leadId }, "debug/crawl — real Playwright crawl");

    const t0 = Date.now();
    const crawlResult = await container.pageCrawler.crawl(url);
    const durationMs = Date.now() - t0;

    let audit: AuditRecord | null = null;

    if (leadId !== undefined) {
      const lead = await container.leadRepo.findById(leadId);
      if (!lead) {
        res.status(404).json({ ok: false, error: `Lead ${leadId} not found` });
        return;
      }

      audit = await container.auditRepo.create({
        leadId,
        loadTimeMs: crawlResult.loadTimeMs,
        hasSSL: crawlResult.hasSSL,
        hasMobileMeta: crawlResult.hasMobileMeta,
        hasMetaTags: crawlResult.hasMetaTags,
        hasCTA: crawlResult.hasCTA,
        reviewSummary: {},
        rawFindings: { url, crawl: crawlResult, source: "debug/crawl" },
      });

      log.info({ leadId, auditId: audit.id }, "debug/crawl — audit record persisted");
    }

    ok(res, {
      url,
      durationMs,
      crawl: crawlResult,
      ...(audit !== null && { audit }),
    });
  })
);

// ─── 3. PageSpeed ─────────────────────────────────────────────────────────────

const pageSpeedSchema = z.object({
  url: z.string().url("must be a valid URL"),
  leadId: z.string().optional(),
});

router.post(
  "/pagespeed",
  wrap(async (req, res) => {
    const { url, leadId } = pageSpeedSchema.parse(req.body);
    log.info({ url, leadId }, "debug/pagespeed — real Google PageSpeed Insights");

    const t0 = Date.now();
    const psiResult = await container.pageSpeedService.analyze(url);
    const durationMs = Date.now() - t0;

    let audit: AuditRecord | null = null;

    if (leadId !== undefined) {
      const lead = await container.leadRepo.findById(leadId);
      if (!lead) {
        res.status(404).json({ ok: false, error: `Lead ${leadId} not found` });
        return;
      }

      // PSI-only audit — crawl signals are unknown without a Playwright pass.
      // Use /debug/crawl with the same leadId to fill the structural signals.
      audit = await container.auditRepo.create({
        leadId,
        pageSpeedScore: psiResult.desktop.score,
        mobileScore: psiResult.mobile.score,
        loadTimeMs: psiResult.desktop.loadTimeMs,
        hasSSL: false,
        hasMobileMeta: false,
        hasMetaTags: false,
        hasCTA: false,
        reviewSummary: {},
        rawFindings: { url, psi: psiResult, source: "debug/pagespeed" },
      });

      log.info({ leadId, auditId: audit.id }, "debug/pagespeed — audit record persisted");
    }

    ok(res, {
      url,
      durationMs,
      pagespeed: psiResult,
      ...(audit !== null && { audit }),
    });
  })
);

// ─── 4. Writer ────────────────────────────────────────────────────────────────

const writerSchema = z.object({
  leadId: z.string().min(1, "leadId required"),
  wordLimit: z.number().int().min(50).max(500).default(180),
});

router.post(
  "/writer",
  wrap(async (req, res) => {
    const { leadId, wordLimit } = writerSchema.parse(req.body);
    log.info({ leadId, wordLimit }, "debug/writer — generating real email draft");

    const lead = await container.leadRepo.findById(leadId);
    if (!lead) {
      res.status(404).json({ ok: false, error: `Lead ${leadId} not found` });
      return;
    }

    const place: PlaceResult = {
      placeId: lead.gmapsPlaceId,
      businessName: lead.businessName,
      address: lead.address,
      city: lead.city,
      niche: lead.niche,
      reviewCount: lead.reviewCount,
      ...(lead.phone !== undefined && { phone: lead.phone }),
      ...(lead.website !== undefined && { website: lead.website }),
      ...(lead.googleRating !== undefined && { googleRating: lead.googleRating }),
    };

    const auditFindings =
      lead.topIssue !== undefined
        ? {
            topIssue: lead.topIssue,
            ...(lead.digitalScore !== undefined && { pageSpeedScore: lead.digitalScore }),
          }
        : undefined;

    const t0 = Date.now();
    const generated = await container.generateOutreachEmail.execute({
      place,
      wordLimit,
      ...(auditFindings !== undefined && { auditFindings }),
    });

    // Persist as a DAY_0 draft → appears in the Approval queue immediately.
    const emailDraft = await container.emailRepo.create({
      leadId,
      cadence: "DAY_0",
      subject: generated.subject,
      body: generated.body,
      wordCount: generated.wordCount,
    });

    log.info(
      { leadId, emailId: emailDraft.id, wordCount: generated.wordCount },
      "debug/writer — email draft persisted"
    );

    ok(res, {
      lead: { id: leadId, businessName: lead.businessName },
      durationMs: Date.now() - t0,
      email: {
        draftId: emailDraft.id,
        status: emailDraft.status,
        subject: generated.subject,
        body: generated.body,
        wordCount: generated.wordCount,
      },
    });
  })
);

// ─── 5. Approve & Send ────────────────────────────────────────────────────────

const approveSchema = z.object({
  emailId: z.string().min(1, "emailId required"),
  recipientEmail: z.string().email().optional(),
});

router.post(
  "/approve",
  wrap(async (req, res) => {
    const { emailId, recipientEmail } = approveSchema.parse(req.body);
    const t0 = Date.now();
    const result = await container.approveAndSendEmail.execute({
      emailId,
      approvedBy: "debug-panel",
      ...(recipientEmail !== undefined && { recipientEmail }),
    });
    ok(res, { durationMs: Date.now() - t0, email: result });
  })
);

export { router as debugRouter };
