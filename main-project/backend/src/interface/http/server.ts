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

// ─── App factory ──────────────────────────────────────────────────────────────

/**
 * Exported separately so tests can import createApp() and use supertest
 * without binding to a real port.
 */
export function createApp() {
  const app = express();

  // ── Security ──────────────────────────────────────────────────────────────
  app.use(helmet());

  app.use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );

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
    })
  );

  // ── Body parsing ──────────────────────────────────────────────────────────
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false, limit: "1mb" }));

  // ── Routes ────────────────────────────────────────────────────────────────
  app.use("/api/health", healthRouter);
  app.use("/api/public", publicRouter);
  app.use("/api/leads", leadsRouter);
  app.use("/api/pipeline", pipelineRouter);
  app.use("/api/emails", emailsRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/analytics", analyticsRouter);

  // ── Debug routes — development only ──────────────────────────────────────
  if (env.NODE_ENV !== "production") {
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
