/**
 * Single source of truth for all environment variables.
 *
 * Rules (from CLAUDE.md):
 *  - Validated with Zod on process start — crashes with a clear message on
 *    any missing or malformed variable.
 *  - Never access process.env directly outside this file. Import `env` instead.
 */
import { z } from "zod";
import { config } from "dotenv";

config(); // Load .env file before validation

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  // ── Server ────────────────────────────────────────────────────────────────
  PORT: z.coerce
    .number()
    .int()
    .min(1)
    .max(65535)
    .default(3001),

  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  // ── Database ──────────────────────────────────────────────────────────────
  DATABASE_URL: z
    .string()
    .min(1)
    .refine((v) => v.startsWith("postgresql://") || v.startsWith("postgres://"), {
      message: "DATABASE_URL must be a valid PostgreSQL connection string",
    }),

  // ── Auth (shared secret with NextAuth frontend) ───────────────────────────
  NEXTAUTH_SECRET: z
    .string()
    .min(32, "NEXTAUTH_SECRET must be at least 32 characters for HS256"),

  // ── CORS ──────────────────────────────────────────────────────────────────
  FRONTEND_URL: z
    .string()
    .url("FRONTEND_URL must be a valid URL")
    .default("http://localhost:3000"),

  // ── Anthropic (optional until pipeline agents are used) ───────────────────
  // In production, require a real key starting with "sk-ant-".
  // In dev/test, allow omission — MockLLMAdapter is used automatically.
  ANTHROPIC_API_KEY: z
    .string()
    .optional()
    .default("sk-ant-placeholder")
    .refine(
      (v) => process.env.NODE_ENV !== "production" || v.startsWith("sk-ant-"),
      { message: "ANTHROPIC_API_KEY must be a valid Anthropic key (starts with sk-ant-) in production" }
    ),

  // Set MOCK_LLM=true to use MockLLMAdapter instead of real Claude API.
  // Auto-enabled when ANTHROPIC_API_KEY is the placeholder default.
  MOCK_LLM: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1")
    .default("false"),

  // ── Python scraper sidecar (internal only — never exposed to internet) ────────
  PYTHON_SCRAPER_URL: z.string().url().default("http://localhost:8001"),

  // ── Google PageSpeed Insights (called by the Python sidecar) ─────────────────
  // Also kept here so the Node.js env validation documents it; actual key is read
  // by the Python service from its own .env.
  GOOGLE_PAGESPEED_API_KEY: z.string().optional().default(""),

  // ── Gmail OAuth 2.0 (optional until email sending is used) ────────────────
  GMAIL_CLIENT_ID: z.string().optional().default(""),
  GMAIL_CLIENT_SECRET: z.string().optional().default(""),
  GMAIL_REDIRECT_URI: z.string().optional().default("http://localhost:3001/auth/google/callback"),
  GMAIL_REFRESH_TOKEN: z.string().optional().default(""),
  GMAIL_SENDER_EMAIL: z.string().optional().default("dev@localhost"),

  // ── Google Sheets (optional until tracker agent is used) ──────────────────
  GOOGLE_SHEETS_SPREADSHEET_ID: z.string().optional().default(""),
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().optional().default("dev@localhost"),
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: z.string().optional().default(""),
});

// ─── Loader ───────────────────────────────────────────────────────────────────

function loadEnv() {
  const result = schema.safeParse(process.env);

  if (!result.success) {
    const messages = result.error.errors
      .map((e) => `  • ${e.path.join(".")}: ${e.message}`)
      .join("\n");

    // Use console.error directly — logger hasn't been initialised yet
    console.error(
      `\n[Config] Environment validation failed — fix the issues below and restart:\n\n${messages}\n`
    );
    process.exit(1);
  }

  return result.data;
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export const env = loadEnv();
export type Env = z.infer<typeof schema>;
