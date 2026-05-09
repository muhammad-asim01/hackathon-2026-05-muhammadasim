/**
 * Shared Playwright test helpers.
 *
 * Screenshot convention:
 *   All screenshots land in  .playwright/screenshots/<suite>/<label>-<ts>.png
 *   so they survive test-results cleanup and are easy to review by suite.
 */

import type { Page } from "@playwright/test";
import path from "path";
import fs from "fs";

// ─── Screenshot root ──────────────────────────────────────────────────────────

export const SCREENSHOT_ROOT = path.join(".playwright", "screenshots");

/**
 * Capture a named screenshot into `.playwright/screenshots/<suite>/<label>-<ts>.png`.
 * Creates the directory if it does not exist.
 */
export async function shot(page: Page, suite: string, label: string): Promise<void> {
  const dir = path.join(SCREENSHOT_ROOT, suite);
  fs.mkdirSync(dir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const file = path.join(dir, `${label}-${ts}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`📸  [${suite}] ${label} → ${file}`);
}

// ─── Navigation helper ────────────────────────────────────────────────────────

/** Navigate and wait for the network to settle. */
export async function goTo(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: "networkidle" });
}

// ─── API helpers (backend on :3001) ──────────────────────────────────────────

const BACKEND = "http://localhost:3001/api";
const DEV_TOKEN = "dev-qa-bypass";   // accepted when NODE_ENV=development

/** Authenticated GET against the backend API. Returns parsed JSON. */
export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BACKEND}${path}`, {
    headers: { Authorization: `Bearer ${DEV_TOKEN}` },
  });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  const body = (await res.json()) as { ok: boolean; data: T };
  return body.data;
}

/** Unauthenticated POST. Returns parsed JSON body. */
export async function apiPost<T>(path: string, payload: unknown): Promise<{ ok: boolean; data?: T; error?: unknown }> {
  const res = await fetch(`${BACKEND}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<{ ok: boolean; data?: T; error?: unknown }>;
}
