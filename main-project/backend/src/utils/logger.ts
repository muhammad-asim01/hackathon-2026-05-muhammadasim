/**
 * Application logger — Pino v9 with secret redaction.
 *
 * Usage:
 *   import { logger } from "@/utils/logger";
 *   logger.info({ userId }, "User logged in");
 *   logger.error({ err }, "Unhandled error");
 *
 * Child loggers for agent context:
 *   const agentLog = logger.child({ agent: "scout" });
 *   agentLog.info({ placeId }, "Found business");
 *
 * Dev pretty-printing: install pino-pretty and set LOG_PRETTY=true
 *   npm install --save-dev pino-pretty
 */
import pino from "pino";
import { env } from "@/config/env";

// ─── Redacted paths ───────────────────────────────────────────────────────────
// Pino will replace the value at any matching path with "[REDACTED]".
// Paths use dot notation; wildcards are supported.

const REDACTED_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "req.headers[\"x-api-key\"]",
  "*.password",
  "*.token",
  "*.secret",
  "*.apiKey",
  "*.api_key",
  "*.privateKey",
  "*.private_key",
  "*.refreshToken",
  "*.refresh_token",
  "*.accessToken",
  "*.access_token",
  "*.clientSecret",
  "*.client_secret",
];

// ─── Transport ────────────────────────────────────────────────────────────────

const isDev = env.NODE_ENV === "development";
const isTest = env.NODE_ENV === "test";

// Resolve transport lazily so the server doesn't crash if pino-pretty is absent
function buildTransport(): pino.TransportSingleOptions | undefined {
  if (!isDev) return undefined;
  try {
    require.resolve("pino-pretty");
    return {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:MM:ss.l",
        ignore: "pid,hostname,env",
        messageFormat: "{msg}",
      },
    };
  } catch {
    // pino-pretty not installed — fall back to JSON
    return undefined;
  }
}

// ─── Logger instance ──────────────────────────────────────────────────────────

const transport = buildTransport();

export const logger = pino({
  // Silence all output during tests — use logger.child() in tests if needed
  level: isTest ? "silent" : "info",

  // Base fields merged into every log line
  base: { env: env.NODE_ENV },

  redact: {
    paths: REDACTED_PATHS,
    censor: "[REDACTED]",
  },

  // ISO timestamp on every line
  timestamp: pino.stdTimeFunctions.isoTime,

  // Spread only when transport is defined — exactOptionalPropertyTypes safe
  ...(transport !== undefined && { transport }),
});

export type Logger = typeof logger;
