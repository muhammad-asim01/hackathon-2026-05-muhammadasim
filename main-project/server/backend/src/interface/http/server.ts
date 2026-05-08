/**
 * Express 5 application — entry point for `npm run dev` and `npm start`.
 *
 * Middleware stack (order matters):
 *   helmet        → security headers (CSP, HSTS, etc.)
 *   cors          → FRONTEND_URL whitelist, credentials support
 *   compression   → gzip/brotli for responses > 1kb
 *   pino-http     → structured request/response logging
 *   express.json  → body parsing (1 MB limit)
 *   routes        → all API handlers
 *   404 fallback  → JSON 404 for unmatched routes
 *   errorHandler  → centralised error → HTTP status mapping (must be last)
 */
import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
import { env } from "@/config/env";
import { logger } from "@/utils/logger";
import { errorHandler } from "@/interface/http/middleware/errorHandler";
import { healthRouter } from "@/interface/http/routes/health.router";
import { leadsRouter } from "@/interface/http/routes/leads.router";
import { pipelineRouter } from "@/interface/http/routes/pipeline.router";
import { emailsRouter } from "@/interface/http/routes/emails.router";
import { publicRouter } from "@/interface/http/routes/public.router";
import { settingsRouter } from "@/interface/http/routes/settings.router";
import { analyticsRouter } from "@/interface/http/routes/analytics.router";
import { debugRouter } from "@/interface/http/routes/debug.router";

// ─── Rate limiters ────────────────────────────────────────────────────────────

const rateLimitMessage = (code: string, message: string) =>
  JSON.stringify({ ok: false, error: { code, message } });

/** Global cap: 200 requests per 15 minutes per IP across all endpoints. */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitMessage("RATE_LIMITED", "Too many requests — try again later"),
});

/** Pipeline trigger cap: 5 starts per minute per IP (expensive LLM calls). */
const pipelineLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitMessage("RATE_LIMITED", "Pipeline rate limit exceeded — wait before starting another run"),
});

/** Public audit endpoint cap: 30 requests per minute per IP. */
const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitMessage("RATE_LIMITED", "Too many requests — try again later"),
});

// ─── App factory ──────────────────────────────────────────────────────────────

/**
 * Exported separately so tests can import createApp() and use supertest
 * without binding to a real port.
 */
export function createApp() {
  const app = express();

  // ── Security ──────────────────────────────────────────────────────────────
  app.use(helmet());

  // Deduplicate allowed origins — env.FRONTEND_URL may overlap with hardcoded dev/prod values
  const allowedOrigins = [
    ...new Set([
      "http://localhost:3000",
      "https://saftai.vercel.app",
      env.FRONTEND_URL,
    ]),
  ];

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow server-to-server (no Origin) or explicitly listed origins.
        // null-origin requests (file://, data:) are blocked intentionally.
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        return callback(new Error(`CORS blocked for origin: ${origin}`));
      },

      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );

  // ── Global rate limit ──────────────────────────────────────────────────────
  app.use(globalLimiter);

  // ── Performance ───────────────────────────────────────────────────────────
  app.use(compression());

  // ── Logging ───────────────────────────────────────────────────────────────
  app.use(
    pinoHttp({
      logger,
      // Skip health check logs to avoid noise in production metrics
      autoLogging: {
        ignore: (req) => req.url === "/api/health",
      },
      // Customise the log level per response status
      customLogLevel: (_req, res) => {
        if (res.statusCode >= 500) return "error";
        if (res.statusCode >= 400) return "warn";
        return "info";
      },
      // Redact JWT tokens passed as ?token= in SSE EventSource requests
      serializers: {
        req(req: Record<string, unknown> & { url?: string }) {
          return {
            ...req,
            url: typeof req.url === "string"
              ? req.url.replace(/([?&])token=[^&]*/gi, "$1token=[REDACTED]")
              : req.url,
          };
        },
      },
    })
  );

  // ── Body parsing ──────────────────────────────────────────────────────────
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false, limit: "1mb" }));

  // ── Routes ────────────────────────────────────────────────────────────────
  app.use("/api/health", healthRouter);
  app.use("/api/public", publicLimiter, publicRouter);
  app.use("/api/leads", leadsRouter);
  app.use("/api/pipeline/run", pipelineLimiter);  // tighter cap on expensive trigger
  app.use("/api/pipeline", pipelineRouter);
  app.use("/api/emails", emailsRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/analytics", analyticsRouter);

  // ── Debug routes — development only ──────────────────────────────────────
  if (env.NODE_ENV === "development") {
    app.use("/api/debug", debugRouter);
  }

  // ── 404 fallback ──────────────────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "Route not found" } });
  });

  // ── Error handler (must be the last middleware) ───────────────────────────
  app.use(errorHandler);

  return app;
}

// ─── Server startup ───────────────────────────────────────────────────────────

async function start() {
  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, env: env.NODE_ENV },
      "sift.ai API server listening"
    );
  });

  // Increase keep-alive timeout slightly above typical load balancer timeouts
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;
}

start().catch((err: unknown) => {
  logger.error({ err }, "Fatal: failed to start server");
  process.exit(1);
});
