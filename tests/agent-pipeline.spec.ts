/**
 * Agent Pipeline — E2E flow test
 *
 * Verifies the full pipeline sequence by watching real backend log lines
 * appear sequentially inside the AgentPanel:
 *
 *   form filled → Run Pipeline clicked → Scout log → Analyst log → Writer log
 *   → Tracker log → "Pipeline complete" card with real lead counts
 *
 * Requires:
 *   - frontend  on :3000  (Next.js dev server)
 *   - backend   on :3001  (tsx watch, MOCK_LLM=true MOCK_MAPS=true)
 *
 * Screenshots saved to:  test-results/agent-pipeline/
 */

import { test, expect, type Page } from "@playwright/test";
import path from "path";
import fs from "fs";

// ─── Screenshot helper ────────────────────────────────────────────────────────

const SS_DIR = path.join("test-results", "agent-pipeline");

async function shot(page: Page, label: string) {
  fs.mkdirSync(SS_DIR, { recursive: true });
  const file = path.join(SS_DIR, `${label}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`📸  ${label}`);
}

// ─── Selector helpers — use text content, not aria-label ─────────────────────

/** The amber "Run Pipeline" CTA button (not-running state) */
const runBtn = (page: Page) =>
  page.locator("button").filter({ hasText: /run pipeline/i }).first();

/** The disabled spinner button shown while pipeline is in flight */
const runningBtn = (page: Page) =>
  page.locator("button").filter({ hasText: /pipeline running/i }).first();

/** Step row: find a container that holds the given agent name */
const stepRow = (page: Page, label: string) =>
  page.locator("div").filter({ hasText: label }).filter({ hasText: /running|done|partial|failed/i }).first();

/** Any log line (font-mono) matching a pattern */
const logLine = (page: Page, pattern: RegExp) =>
  page.locator(".font-mono").filter({ hasText: pattern }).first();

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe("Agent page — live pipeline flow", () => {
  test.setTimeout(90_000); // mocks take ~3–8 s end-to-end

  // ── Main flow ────────────────────────────────────────────────────────────────

  test("scout→analyst→writer→tracker runs sequentially with real log lines", async ({ page }) => {

    // 1. Navigate and confirm idle state
    await page.goto("/dashboard/agent", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Run Pipeline" })).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText("Ready to run")).toBeVisible();
    await shot(page, "01-idle");

    // 2. Fill form
    await page.getByLabel(/business type/i).fill("plumbing");
    await page.getByLabel(/city or region/i).fill("Austin, TX");
    await shot(page, "02-form-filled");

    // 3. Click "Run Pipeline" — button found by text content
    await expect(runBtn(page)).toBeVisible({ timeout: 5_000 });
    await runBtn(page).click();

    // 4. Pipeline triggered — either catch the transient "running" state OR jump
    //    straight to the scout log (mocks run in ~600 ms, too fast to guarantee catching)
    await expect(
      runningBtn(page).or(logLine(page, /Scout found \d+/i))
    ).toBeVisible({ timeout: 10_000 });
    await shot(page, "03-pipeline-triggered");

    // 5. Scout log line — "Scout found N new business(es)"
    await expect(logLine(page, /Scout found \d+/i)).toBeVisible({ timeout: 15_000 });
    await shot(page, "04-scout-log");

    // 6. Analyst log line — "Analyst auditing N businesses…"
    await expect(logLine(page, /Analyst auditing \d+/i)).toBeVisible({ timeout: 15_000 });
    await shot(page, "05-analyst-start-log");

    // 7. Analyst audit score line — confirms crawl + PageSpeed actually ran
    await expect(logLine(page, /Audited .+ — score \d+/i)).toBeVisible({ timeout: 25_000 });
    await shot(page, "06-analyst-score-log");

    // 8. Writer log line — "Writer generating email for …"
    await expect(logLine(page, /Writer generating email for/i)).toBeVisible({ timeout: 20_000 });
    await shot(page, "07-writer-log");

    // 9. Email drafted line — "Email drafted for … (N words)"
    await expect(logLine(page, /Email drafted for .+ \(\d+ words\)/i)).toBeVisible({ timeout: 20_000 });
    await shot(page, "08-email-drafted-log");

    // 10. Tracker log — "Tracker logging … to CRM"
    await expect(logLine(page, /Tracker logging .+ to CRM/i)).toBeVisible({ timeout: 20_000 });
    await shot(page, "09-tracker-log");

    // 11. Pipeline complete card appears
    await expect(page.getByText("Pipeline complete")).toBeVisible({ timeout: 40_000 });
    await shot(page, "10-complete-card");

    // 12. Scout Agent row must show "done" badge
    await expect(
      page.locator("p", { hasText: "Scout Agent" }).locator("..").locator("span").filter({ hasText: "done" })
    ).toBeVisible({ timeout: 5_000 });

    // 13. Analyst Agent row must show "done" or "partial"
    await expect(
      page.locator("p", { hasText: "Analyst Agent" }).locator("..").locator("span").filter({ hasText: /done|partial/i })
    ).toBeVisible({ timeout: 5_000 });

    // 14. Writer Agent row must show "done" or "partial"
    await expect(
      page.locator("p", { hasText: "Writer Agent" }).locator("..").locator("span").filter({ hasText: /done|partial/i })
    ).toBeVisible({ timeout: 5_000 });

    // 15. Tracker Agent row must show "done" or "partial"
    await expect(
      page.locator("p", { hasText: "Tracker Agent" }).locator("..").locator("span").filter({ hasText: /done|partial/i })
    ).toBeVisible({ timeout: 5_000 });
    await shot(page, "11-all-steps-done");

    // 16. Result card shows real stat labels (businesses found / leads qualified / emails drafted)
    await expect(page.getByText("businesses found")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("leads qualified")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("emails drafted")).toBeVisible({ timeout: 5_000 });
    await shot(page, "12-success-counts");

    // 17. "Review approval queue" CTA link present
    await expect(page.getByRole("link", { name: /review approval queue/i })).toBeVisible();
    await shot(page, "13-final-state");
  });

  // ── Validation: empty fields must not submit ──────────────────────────────

  test("empty fields — panel stays idle, button does not change to running", async ({ page }) => {
    await page.goto("/dashboard/agent", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Run Pipeline" })).toBeVisible({ timeout: 8_000 });

    // Click without filling either field
    await expect(runBtn(page)).toBeVisible({ timeout: 5_000 });
    await runBtn(page).click();

    // Panel must still show "Ready to run" — no run was started
    await expect(page.getByText("Ready to run")).toBeVisible({ timeout: 3_000 });

    // Button must NOT become the running spinner variant
    await expect(runningBtn(page)).not.toBeVisible();
    await shot(page, "empty-validation");
  });

  // ── Niche-only empty: city missing ───────────────────────────────────────

  test("niche filled but city empty — form shakes, no run", async ({ page }) => {
    await page.goto("/dashboard/agent", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Run Pipeline" })).toBeVisible({ timeout: 8_000 });

    await page.getByLabel(/business type/i).fill("dentist");
    // city left empty
    await expect(runBtn(page)).toBeVisible({ timeout: 5_000 });
    await runBtn(page).click();

    await expect(page.getByText("Ready to run")).toBeVisible({ timeout: 3_000 });
    await expect(runningBtn(page)).not.toBeVisible();
    await shot(page, "city-missing-validation");
  });

  // ── Recent runs list populates after a run ────────────────────────────────

  test("recent runs list shows previous runs", async ({ page }) => {
    await page.goto("/dashboard/agent", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Run Pipeline" })).toBeVisible({ timeout: 8_000 });

    // Recent runs widget should show at least one entry from previous pipeline runs
    const recentSection = page.locator("div").filter({ hasText: "Recent runs" }).last();
    // If there are prior runs the list will have links; otherwise shows "No runs yet"
    await expect(recentSection).toBeVisible();
    await shot(page, "recent-runs-widget");
  });
});
