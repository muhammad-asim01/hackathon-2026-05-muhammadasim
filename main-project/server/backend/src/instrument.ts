/**
 * Sentry instrumentation — must be imported before all other modules in server.ts
 * so Sentry can monkey-patch Node.js core modules for tracing.
 *
 * Initialisation is skipped silently when SENTRY_DSN is absent (local dev without DSN).
 */
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import { env } from "@/config/env";

if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,

    // Capture 100% of transactions in non-production; 10% in production
    tracesSampleRate: env.NODE_ENV === "production" ? 0.1 : 1.0,

    // Profile 100% of sampled transactions
    profilesSampleRate: 1.0,

    integrations: [
      nodeProfilingIntegration(),
    ],
  });
}

export { Sentry };
