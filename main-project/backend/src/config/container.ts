/**
 * Dependency Injection container — manual factory wiring.
 *
 * Maps:       OSMMapsService (Nominatim + Overpass — no Google dependency)
 * PageSpeed:  PythonPageSpeedAdapter → Python FastAPI sidecar on :8001
 * Crawler:    PythonCrawlerAdapter   → Python FastAPI sidecar on :8001
 * LLM:        AnthropicAdapter (Claude) or MockLLMAdapter when key is absent
 * Email:      GmailService or MockEmailSender when OAuth credentials are absent
 */
import { PrismaClient } from "@prisma/client";
import { env } from "@/config/env";
import { logger } from "@/utils/logger";

// ── Infrastructure ────────────────────────────────────────────────────────────
import { LeadRepository }    from "@/infrastructure/persistence/repositories/LeadRepository";
import { RunRepository }     from "@/infrastructure/persistence/repositories/RunRepository";
import { EmailRepository }   from "@/infrastructure/persistence/repositories/EmailRepository";
import { AuditRepository }   from "@/infrastructure/persistence/repositories/AuditRepository";

import { OSMMapsService }          from "@/infrastructure/external/osm/OSMMapsService";
import { PythonCrawlerAdapter }    from "@/infrastructure/external/scraper/PythonCrawlerAdapter";
import { PythonPageSpeedAdapter }  from "@/infrastructure/external/scraper/PythonPageSpeedAdapter";

import { AnthropicAdapter }  from "@/infrastructure/external/llm/AnthropicAdapter";
import { MockLLMAdapter }    from "@/infrastructure/external/llm/MockLLMAdapter";
import { GmailService }      from "@/infrastructure/external/email/GmailService";
import { MockEmailSender }   from "@/infrastructure/external/email/MockEmailSender";

// ── Use-cases ─────────────────────────────────────────────────────────────────
import { DiscoverBusinesses }     from "@/application/use-cases/scout/DiscoverBusinesses";
import { AuditWebsite }           from "@/application/use-cases/analyst/AuditWebsite";
import { AnalyzeReviews }         from "@/application/use-cases/analyst/AnalyzeReviews";
import { GenerateOutreachEmail }  from "@/application/use-cases/writer/GenerateOutreachEmail";
import { LogLead }                from "@/application/use-cases/tracker/LogLead";
import { RunPipeline }            from "@/application/use-cases/pipeline/RunPipeline";
import { ApproveAndSendEmail }    from "@/application/use-cases/email/ApproveAndSendEmail";

// ── Router registrations ──────────────────────────────────────────────────────
import { registerApproveAndSend } from "@/interface/http/routes/emails.router";

// ─── Prisma singleton ─────────────────────────────────────────────────────────

const prisma = new PrismaClient({
  log:
    env.NODE_ENV === "development"
      ? [
          { level: "warn",  emit: "stdout" },
          { level: "error", emit: "stdout" },
        ]
      : [{ level: "error", emit: "stdout" }],
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────

async function disconnectPrisma() {
  try {
    await prisma.$disconnect();
    logger.info("Prisma disconnected");
  } catch (err) {
    logger.error({ err }, "Error disconnecting Prisma");
  }
}

process.on("SIGINT", async () => {
  await pageCrawler.shutdown().catch(() => null);
  await disconnectPrisma();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await pageCrawler.shutdown().catch(() => null);
  await disconnectPrisma();
  process.exit(0);
});

// ─── Repositories ─────────────────────────────────────────────────────────────

const leadRepo  = new LeadRepository(prisma);
const runRepo   = new RunRepository(prisma);
const emailRepo = new EmailRepository(prisma);
const auditRepo = new AuditRepository(prisma);

// ─── Maps — OpenStreetMap (Nominatim + Overpass) ───────────────────────────────
// No API key required. Rate-limit safe for ≤ 15 req/day (internal cap).

const mapsService = new OSMMapsService();

logger.info("Maps: using OSMMapsService (Nominatim + Overpass API — no API key required)");

// ─── Python scraper sidecar ───────────────────────────────────────────────────
// Playwright crawling and PageSpeed calls are handled by the Python FastAPI
// service. Node.js delegates via HTTP on localhost — internal only.

const pageSpeedService = new PythonPageSpeedAdapter(env.PYTHON_SCRAPER_URL);
const pageCrawler      = new PythonCrawlerAdapter(env.PYTHON_SCRAPER_URL);

logger.info(
  { url: env.PYTHON_SCRAPER_URL },
  "Scraper: using Python FastAPI sidecar (PythonCrawlerAdapter + PythonPageSpeedAdapter)"
);

// ─── LLM provider ─────────────────────────────────────────────────────────────
// Use mock when MOCK_LLM=true or the API key is the placeholder default.

const useMockLLM =
  env.MOCK_LLM ||
  !env.ANTHROPIC_API_KEY ||
  env.ANTHROPIC_API_KEY === "sk-ant-placeholder";

const llmProvider = useMockLLM
  ? new MockLLMAdapter()
  : new AnthropicAdapter(env.ANTHROPIC_API_KEY);

if (useMockLLM) {
  logger.warn(
    "LLM: using MockLLMAdapter (set MOCK_LLM=false and a real ANTHROPIC_API_KEY to use Claude)"
  );
}

// ─── Email sender ─────────────────────────────────────────────────────────────
// Use Gmail when all OAuth credentials are present, otherwise log-only mock.

const gmailReady =
  env.GMAIL_CLIENT_ID &&
  env.GMAIL_CLIENT_SECRET &&
  env.GMAIL_REFRESH_TOKEN &&
  env.GMAIL_SENDER_EMAIL;

const emailSender = gmailReady
  ? new GmailService({
      clientId:     env.GMAIL_CLIENT_ID,
      clientSecret: env.GMAIL_CLIENT_SECRET,
      refreshToken: env.GMAIL_REFRESH_TOKEN,
      redirectUri:  env.GMAIL_REDIRECT_URI,
      senderEmail:  env.GMAIL_SENDER_EMAIL,
    })
  : new MockEmailSender();

if (!gmailReady) {
  logger.warn(
    "Email: using MockEmailSender (configure GMAIL_* env vars to send real emails)"
  );
}

// ─── Use-Cases ────────────────────────────────────────────────────────────────

const discoverBusinesses    = new DiscoverBusinesses(mapsService, leadRepo);
const auditWebsite          = new AuditWebsite(pageSpeedService, pageCrawler, auditRepo, leadRepo);
const analyzeReviews        = new AnalyzeReviews(llmProvider);
const generateOutreachEmail = new GenerateOutreachEmail(llmProvider);
const logLead               = new LogLead(leadRepo, emailRepo);

const runPipeline = new RunPipeline(
  runRepo,
  leadRepo,
  discoverBusinesses,
  auditWebsite,
  analyzeReviews,
  generateOutreachEmail,
  logLead
);

const approveAndSendEmail = new ApproveAndSendEmail(emailRepo, leadRepo, emailSender);

// Register with the emails router (avoids circular import)
registerApproveAndSend(approveAndSendEmail);

// ─── Container ────────────────────────────────────────────────────────────────

export const container = {
  prisma,
  // Repositories
  leadRepo,
  runRepo,
  emailRepo,
  auditRepo,
  // Infrastructure (exposed for debug router)
  pageCrawler,
  pageSpeedService,
  // Use-cases
  discoverBusinesses,
  auditWebsite,
  analyzeReviews,
  generateOutreachEmail,
  logLead,
  runPipeline,
  approveAndSendEmail,
} as const;

export type Container = typeof container;
