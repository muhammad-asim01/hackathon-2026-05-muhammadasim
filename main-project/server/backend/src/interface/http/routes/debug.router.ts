/**
 * Debug router — individual agent-step smoke tests.
 * Only mounted in development (NODE_ENV !== "production").
 *
 * All crawler and PageSpeed operations are delegated to the Python FastAPI
 * sidecar (PYTHON_SCRAPER_URL, default http://localhost:8001) via the
 * PythonCrawlerAdapter and PythonPageSpeedAdapter. Every Python-backed
 * response includes a `_sidecar` block showing the URL and round-trip latency
 * so you can confirm the call actually reached the sidecar.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ GET  /api/debug/services           active service map (no side-effects)  │
 * │ GET  /api/debug/python/health      direct health ping to Python sidecar  │
 * │ POST /api/debug/scout              OSM discovery via DiscoverBusinesses  │
 * │ POST /api/debug/crawl              Python /crawl (Playwright)            │
 * │ POST /api/debug/pagespeed          Python /pagespeed (Google PSI)        │
 * │ POST /api/debug/analyst            Full AuditWebsite: crawl+PSI+score+DB │
 * │ POST /api/debug/writer             LLM email draft + DB persist          │
 * │ POST /api/debug/approve            ApproveAndSendEmail (MockSender dev)  │
 * └─────────────────────────────────────────────────────────────────────────┘
 */
import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { z } from "zod";

import { container } from "@/config/container";
import { env } from "@/config/env";
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

/**
 * Sidecar metadata block appended to every Python-backed response.
 * Tells the caller the exact URL that was contacted and how long it took.
 */
function sidecarMeta(latencyMs: number) {
  return {
    _sidecar: {
      url: env.PYTHON_SCRAPER_URL,
      adapter: "PythonCrawlerAdapter / PythonPageSpeedAdapter",
      latencyMs,
      note: "All crawl and PageSpeed calls go through this Python FastAPI process (port 8001 by default)",
    },
  };
}

// ─── 1. Service map ───────────────────────────────────────────────────────────
// No side-effects — returns the active adapter configuration so you can tell
// at a glance which services are live vs mocked.

router.get(
  "/services",
  wrap(async (_req, res) => {
    // Determine LLM adapter type from env (mirrors container.ts logic)
    const useMockLLM =
      env.MOCK_LLM ||
      !env.ANTHROPIC_API_KEY ||
      env.ANTHROPIC_API_KEY === "sk-ant-placeholder";

    // Determine email sender type from env (mirrors container.ts logic)
    const gmailReady =
      Boolean(env.GMAIL_CLIENT_ID) &&
      Boolean(env.GMAIL_CLIENT_SECRET) &&
      Boolean(env.GMAIL_REFRESH_TOKEN) &&
      Boolean(env.GMAIL_SENDER_EMAIL);

    ok(res, {
      crawler: {
        adapter: "PythonCrawlerAdapter",
        backend: "Python FastAPI sidecar (Playwright headless)",
        sidecarUrl: env.PYTHON_SCRAPER_URL,
        endpoint: `${env.PYTHON_SCRAPER_URL}/crawl`,
      },
      pageSpeed: {
        adapter: "PythonPageSpeedAdapter",
        backend: "Python FastAPI sidecar (Google PageSpeed Insights API)",
        sidecarUrl: env.PYTHON_SCRAPER_URL,
        endpoint: `${env.PYTHON_SCRAPER_URL}/pagespeed`,
      },
      maps: {
        adapter: "OSMMapsService",
        backend: "OpenStreetMap (Nominatim + Overpass API — no API key)",
      },
      llm: {
        adapter: useMockLLM ? "MockLLMAdapter" : "AnthropicAdapter",
        backend: useMockLLM ? "canned responses (no API calls)" : "Anthropic Claude API",
        model: useMockLLM ? "n/a" : "claude-sonnet-4-5",
        keyPresent: !useMockLLM,
      },
      email: {
        adapter: gmailReady ? "GmailService" : "MockEmailSender",
        backend: gmailReady ? "Gmail OAuth2" : "stdout log only (no real emails sent)",
        ready: gmailReady,
      },
    });
  })
);

// ─── 2. Python sidecar health ─────────────────────────────────────────────────
// Pings the Python FastAPI GET /health endpoint directly — no adapter involved.
// Use this to verify the sidecar process is up before running /crawl or /pagespeed.

router.get(
  "/python/health",
  wrap(async (_req, res) => {
    const url = `${env.PYTHON_SCRAPER_URL}/health`;
    log.info({ url }, "debug/python/health — pinging Python sidecar");

    const t0 = Date.now();
    let fetchRes: Awaited<ReturnType<typeof fetch>>;

    try {
      fetchRes = await fetch(url, {
        method: "GET",
        signal: AbortSignal.timeout(5_000),
      });
    } catch (err) {
      const latencyMs = Date.now() - t0;
      log.error({ url, err, latencyMs }, "debug/python/health — sidecar unreachable");
      res.status(502).json({
        ok: false,
        error: {
          code: "PYTHON_SIDECAR_UNREACHABLE",
          message: `Cannot reach Python sidecar at ${url}`,
          detail: String(err),
          hint: "Run: cd main-project/server/python-scraper && uvicorn main:app --reload --port 8001",
          latencyMs,
        },
      });
      return;
    }

    const latencyMs = Date.now() - t0;

    if (!fetchRes.ok) {
      const body = await fetchRes.text().catch(() => "");
      res.status(502).json({
        ok: false,
        error: {
          code: "PYTHON_SIDECAR_UNHEALTHY",
          message: `Python sidecar returned HTTP ${fetchRes.status}`,
          body: body.slice(0, 300),
          latencyMs,
        },
      });
      return;
    }

    const json = await fetchRes.json().catch(() => ({})) as Record<string, unknown>;
    log.info({ url, latencyMs, response: json }, "debug/python/health — sidecar OK");

    ok(res, {
      status: "ok",
      sidecarUrl: env.PYTHON_SCRAPER_URL,
      latencyMs,
      response: json,
    });
  })
);

// ─── 3. Scout ─────────────────────────────────────────────────────────────────

const scoutSchema = z.object({
  query: z.string().min(3, "query must be at least 3 characters"),
});

router.post(
  "/scout",
  wrap(async (req, res) => {
    const { query } = scoutSchema.parse(req.body);
    log.info({ query }, "debug/scout — OSM discovery via DiscoverBusinesses");

    const t0 = Date.now();
    const result = await container.discoverBusinesses.execute({ query });

    ok(res, {
      query,
      durationMs: Date.now() - t0,
      placesFound: result.places.length,
      skippedExisting: result.skippedExisting,
      places: result.places,
      _maps: {
        adapter: "OSMMapsService",
        backend: "OpenStreetMap Nominatim + Overpass API",
      },
    });
  })
);

// ─── 4. Crawl (Python sidecar) ────────────────────────────────────────────────
// Calls container.pageCrawler.crawl() → PythonCrawlerAdapter → POST :8001/crawl
// Optionally persists an AuditRecord when leadId is provided.

const crawlSchema = z.object({
  url: z.string().url("must be a valid URL"),
  leadId: z.string().optional(),
});

router.post(
  "/crawl",
  wrap(async (req, res) => {
    const { url, leadId } = crawlSchema.parse(req.body);
    log.info({ url, leadId }, "debug/crawl — Python sidecar crawl via PythonCrawlerAdapter");

    const t0 = Date.now();
    const crawlResult = await container.pageCrawler.crawl(url);
    const latencyMs = Date.now() - t0;

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
        rawFindings: {
          url,
          source: "debug/crawl",
          hasContactForm: crawlResult.hasContactForm,
          emails: crawlResult.emails,
        },
      });

      log.info({ leadId, auditId: audit.id, latencyMs }, "debug/crawl — audit record persisted");
    }

    ok(res, {
      url,
      ...sidecarMeta(latencyMs),
      crawl: {
        hasSSL: crawlResult.hasSSL,
        hasMobileMeta: crawlResult.hasMobileMeta,
        hasMetaTags: crawlResult.hasMetaTags,
        hasCTA: crawlResult.hasCTA,
        hasContactForm: crawlResult.hasContactForm,
        loadTimeMs: crawlResult.loadTimeMs,
        emailsFound: crawlResult.emails.length,
        emails: crawlResult.emails,
      },
      ...(audit !== null && { audit }),
    });
  })
);

// ─── 5. PageSpeed (Python sidecar) ───────────────────────────────────────────
// Calls container.pageSpeedService.analyze() → PythonPageSpeedAdapter → POST :8001/pagespeed
// Optionally persists an AuditRecord when leadId is provided.
// NOTE: PSI-only audits have no crawl signals (hasSSL etc. stay at false).
//       Use /analyst or run /crawl first with the same leadId for structural signals.

const pageSpeedSchema = z.object({
  url: z.string().url("must be a valid URL"),
  leadId: z.string().optional(),
});

router.post(
  "/pagespeed",
  wrap(async (req, res) => {
    const { url, leadId } = pageSpeedSchema.parse(req.body);
    log.info({ url, leadId }, "debug/pagespeed — Python sidecar PSI via PythonPageSpeedAdapter");

    const t0 = Date.now();
    const psiResult = await container.pageSpeedService.analyze(url);
    const latencyMs = Date.now() - t0;

    let audit: AuditRecord | null = null;

    if (leadId !== undefined) {
      const lead = await container.leadRepo.findById(leadId);
      if (!lead) {
        res.status(404).json({ ok: false, error: `Lead ${leadId} not found` });
        return;
      }

      // PSI-only audit: structural crawl signals (hasSSL, hasMobileMeta, etc.) are
      // unknown without a Playwright pass. They are stored as false here — run
      // POST /debug/analyst or POST /debug/crawl with the same leadId for full data.
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
        rawFindings: {
          url,
          source: "debug/pagespeed",
          note: "PSI-only audit: crawl signals not available. Use /analyst for full data.",
          psi: psiResult,
        },
      });

      log.info({ leadId, auditId: audit.id, latencyMs }, "debug/pagespeed — audit record persisted");
    }

    const allZero =
      psiResult.desktop.score === 0 &&
      psiResult.mobile.score === 0 &&
      psiResult.desktop.loadTimeMs === 0;

    ok(res, {
      url,
      ...sidecarMeta(latencyMs),
      pagespeed: {
        desktop: psiResult.desktop,
        mobile: psiResult.mobile,
        summary: {
          desktopScore: psiResult.desktop.score,
          mobileScore: psiResult.mobile.score,
          loadTimeMs: psiResult.desktop.loadTimeMs,
          fcpMs: psiResult.desktop.fcp,
          lcpMs: psiResult.desktop.lcp,
        },
        ...(allZero && {
          _note:
            "All scores are zero — Google PageSpeed could not access this URL. " +
            "This is normal for sites that block Google's crawler or are not publicly " +
            "reachable. Crawl signals (hasSSL, hasMobileMeta, etc.) still apply. " +
            "Check the Python sidecar logs for the specific Google API error message.",
        }),
      },
      ...(audit !== null && {
        audit,
        _auditNote: "Crawl signals (hasSSL, hasMobileMeta, etc.) are false — run /analyst for complete data",
      }),
    });
  })
);

// ─── 6. Analyst — full AuditWebsite use-case ─────────────────────────────────
// Runs the complete Analyst pipeline step for a specific lead:
//   1. Fetches lead from DB to build the PlaceResult context
//   2. Calls AuditWebsite.execute() → crawl (Python) + pagespeed (Python) in parallel
//   3. Computes the digital score and writes it + topIssue to the lead record
//   4. Persists the AuditRecord to the DB
//
// This is the recommended way to test the Analyst agent in isolation.

const analystSchema = z.object({
  leadId: z.string().min(1, "leadId required"),
});

router.post(
  "/analyst",
  wrap(async (req, res) => {
    const { leadId } = analystSchema.parse(req.body);
    log.info({ leadId }, "debug/analyst — full AuditWebsite use-case");

    const lead = await container.leadRepo.findById(leadId);
    if (!lead) {
      res.status(404).json({ ok: false, error: `Lead ${leadId} not found` });
      return;
    }

    // Build PlaceResult from the stored lead — same shape AuditWebsite expects
    const place: PlaceResult = {
      placeId: lead.gmapsPlaceId,
      businessName: lead.businessName,
      address: lead.address,
      city: lead.city,
      niche: lead.niche,
      reviewCount: lead.reviewCount,
      ...(lead.phone     !== undefined && { phone: lead.phone }),
      ...(lead.website   !== undefined && { website: lead.website }),
      ...(lead.googleRating !== undefined && { googleRating: lead.googleRating }),
    };

    if (!place.website) {
      log.warn({ leadId, businessName: lead.businessName }, "debug/analyst — lead has no website; crawl will be skipped, score will be minimal");
    }

    const t0 = Date.now();
    const result = await container.auditWebsite.execute({ leadId, place });
    const durationMs = Date.now() - t0;

    log.info(
      { leadId, score: result.score.value, emailsFound: result.extractedEmails.length, durationMs },
      "debug/analyst — AuditWebsite complete"
    );

    ok(res, {
      leadId,
      businessName: lead.businessName,
      website: lead.website ?? null,
      durationMs,
      ...sidecarMeta(durationMs),
      score: {
        value: result.score.value,
        tier: result.score.value === 0
          ? "No digital presence detected — top outreach priority"
          : result.score.value <= 30
          ? "Critical — immediate outreach"
          : result.score.value <= 55
          ? "Poor — strong outreach candidate"
          : result.score.value <= 75
          ? "Fair — offer free audit"
          : "Good — skip",
      },
      audit: result.audit,
      extractedEmails: result.extractedEmails,
      _note: place.website
        ? "Crawl + PageSpeed ran in parallel via Python sidecar"
        : "No website — crawl and PageSpeed skipped; score based on rating/review signals only",
    });
  })
);

// ─── 7. Writer ────────────────────────────────────────────────────────────────

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
      ...(lead.phone        !== undefined && { phone: lead.phone }),
      ...(lead.website      !== undefined && { website: lead.website }),
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
      _llm: {
        adapter: env.MOCK_LLM || env.ANTHROPIC_API_KEY === "sk-ant-placeholder"
          ? "MockLLMAdapter (no API call)"
          : "AnthropicAdapter (Claude API)",
      },
    });
  })
);

// ─── 8. Approve & Send ────────────────────────────────────────────────────────

const approveSchema = z.object({
  emailId: z.string().min(1, "emailId required"),
  recipientEmail: z.string().email().optional(),
});

router.post(
  "/approve",
  wrap(async (req, res) => {
    const { emailId, recipientEmail } = approveSchema.parse(req.body);
    log.info({ emailId, recipientEmail }, "debug/approve — ApproveAndSendEmail");
    const t0 = Date.now();
    const result = await container.approveAndSendEmail.execute({
      emailId,
      approvedBy: "debug-panel",
      ...(recipientEmail !== undefined && { recipientEmail }),
    });
    ok(res, {
      durationMs: Date.now() - t0,
      email: result,
      _email: {
        adapter: env.GMAIL_CLIENT_ID && env.GMAIL_REFRESH_TOKEN
          ? "GmailService (real send)"
          : "MockEmailSender (logged to stdout — no real email sent)",
      },
    });
  })
);

export { router as debugRouter };
