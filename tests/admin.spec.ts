/**
 * sift.ai Admin Pages — Playwright E2E Tests
 *
 * Covers all 7 admin pages:
 *   Dashboard · Leads list · Lead detail · Approvals · Runs list
 *   Run detail · Settings · Analytics · Sidebar navigation
 *
 * Screenshots → .playwright/screenshots/admin/
 */

import { test, expect, type Page } from "@playwright/test";
import { execSync } from "child_process";
import path from "path";
import { shot } from "./helpers";

async function goTo(page: Page, url: string) {
  // domcontentloaded is enough — React Query handles data fetching after mount.
  // networkidle can take 8–9 s on pages with SSE or long-polling connections.
  await page.goto(url, { waitUntil: "domcontentloaded" });
}

// ─── DB seed before entire suite ─────────────────────────────────────────────
// Tests mutate DB state (approve/discard). Re-seed before the suite so every
// run starts from a deterministic baseline.

test.beforeAll(() => {
  // Re-seed before the suite so every run starts from a deterministic baseline.
  // Wrapped in try/catch because Playwright re-runs beforeAll on test retry
  // (each retry is a fresh worker context), and the seed may fail with a
  // unique-constraint error if the previous worker seeded successfully but a
  // transient error prevented cleanup. In that case, the DB still has valid
  // seeded data and tests can proceed.
  const backendDir = path.resolve(__dirname, "../main-project/server/backend");
  try {
    execSync("npx prisma db seed", { cwd: backendDir, stdio: "inherit" });
  } catch (err) {
    console.warn(
      "⚠  Seed failed — DB likely already seeded from prior run. Tests continue with existing data.",
      (err as Error).message?.slice(0, 120)
    );
  }
});

// ─── 1. Dashboard ─────────────────────────────────────────────────────────────

test.describe("Dashboard overview", () => {
  test("renders page title and KPI cards", async ({ page }) => {
    await goTo(page, "/dashboard");
    await shot(page, "admin", "01-dashboard");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByText(/total leads/i).first()).toBeVisible();
    await expect(page.getByText(/emails sent/i).first()).toBeVisible();
    await expect(page.getByText(/\bReplies\b/i).first()).toBeVisible();
    await expect(page.getByText(/reply rate/i).first()).toBeVisible();
  });

  test("shows Recent Runs widget with run links", async ({ page }) => {
    await goTo(page, "/dashboard");
    await expect(page.getByText("Recent Runs", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Auto Repair|Pet Grooming|HVAC|Landscaping/i }).first()
    ).toBeVisible();
  });

  test("shows Recent Leads widget", async ({ page }) => {
    await goTo(page, "/dashboard");
    await expect(page.getByText("Recent Leads", { exact: true })).toBeVisible();
    const widget = page.locator(".bg-card").filter({
      has: page.locator("p", { hasText: "Recent Leads" }),
    });
    await expect(widget.getByRole("link").first()).toBeVisible();
  });

  test("sidebar has all 5 nav items", async ({ page }) => {
    // Settings link is intentionally excluded from the sidebar in AppSidebar.tsx
    await goTo(page, "/dashboard");
    const sidebar = page.locator("aside");
    await expect(sidebar.getByRole("link", { name: "Agent" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Leads" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Runs" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Approvals" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Analytics" })).toBeVisible();
  });
});

// ─── 2. Leads list ────────────────────────────────────────────────────────────

// With domcontentloaded React hasn't mounted yet — filling the search before
// React mounts causes the state to be reset to "" on hydration, clearing our
// fill. This helper waits for tbody tr to confirm React Query has rendered rows
// before we interact with the search or filter controls.
async function goToLeadsTable(page: Page): Promise<void> {
  await goTo(page, "/dashboard/leads");
  await page.waitForSelector("table tbody tr", { state: "visible", timeout: 12_000 });
}

test.describe("Leads table", () => {
  test("renders page heading and table", async ({ page }) => {
    await goToLeadsTable(page);
    await shot(page, "admin", "10-leads-table");
    await expect(page.getByRole("heading", { name: "Leads" })).toBeVisible();
    await expect(page.locator("table")).toBeVisible();
  });

  test("shows a known business in the table", async ({ page }) => {
    // Table sorts by score DESC — lead_001 (score 18) may be on page 2.
    // Search to bring it into view. Must wait for React to mount first.
    await goToLeadsTable(page);
    const searchInput = page.getByPlaceholder(/search business/i);
    await searchInput.fill("thornton");
    await expect(page.getByRole("link", { name: "Thornton's Auto Repair" })).toBeVisible({ timeout: 10_000 });
  });

  test("search filters rows", async ({ page }) => {
    await goToLeadsTable(page);
    const tbody = page.locator("table tbody");
    const searchInput = page.getByPlaceholder(/search business/i);
    await searchInput.fill("thornton");
    // Wait for Thornton's to appear — confirms the filter settled
    await expect(tbody.getByText("Thornton's Auto Repair")).toBeVisible({ timeout: 10_000 });
    await shot(page, "admin", "11-leads-search");
    // Bellini's should be gone from the filtered table rows
    await expect(tbody.getByText("Bellini's Ristorante")).not.toBeVisible({ timeout: 8_000 });
  });

  test("Filters panel toggles open showing score range and status", async ({ page }) => {
    await goToLeadsTable(page);
    await page.getByRole("button", { name: /filters/i }).click();
    await shot(page, "admin", "12-leads-filters-open");
    await expect(page.getByText(/score range/i)).toBeVisible();
    await expect(page.getByText(/status/i).first()).toBeVisible();
  });

  test("status filter — New hides rejected leads", async ({ page }) => {
    await goToLeadsTable(page);
    await page.getByRole("button", { name: /filters/i }).click();
    await page.getByRole("button", { name: "New" }).click();
    const tbody = page.locator("table tbody");
    // Wait for at least one "new" status lead to appear — proves filter settled
    await expect(tbody.getByText("Thornton's Auto Repair")).toBeVisible({ timeout: 10_000 });
    // Ironwood Fitness & Yoga (REJECTED status) must not appear in filtered rows
    await expect(tbody.getByText("Ironwood Fitness & Yoga")).not.toBeVisible({ timeout: 8_000 });
  });

  test("sort by Score header click doesn't crash", async ({ page }) => {
    await goToLeadsTable(page);
    await page.getByRole("columnheader", { name: /score/i }).click();
    await expect(page.locator("table")).toBeVisible();
  });

  test("clear filters resets search input", async ({ page }) => {
    await goToLeadsTable(page);
    const searchInput = page.getByPlaceholder(/search business/i);
    await searchInput.fill("xyz");
    await page.getByRole("button", { name: /clear/i }).click();
    await expect(searchInput).toHaveValue("");
  });

  test("clicking a lead navigates to detail", async ({ page }) => {
    // Fill search after data loads so React state is set correctly
    await goToLeadsTable(page);
    await page.getByPlaceholder(/search business/i).fill("thornton");
    await page.getByRole("link", { name: "Thornton's Auto Repair" }).click({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/dashboard\/leads\/lead_001/);
  });
});

// ─── 3. Lead detail ───────────────────────────────────────────────────────────

// With domcontentloaded, React Query hasn't fetched yet when the page lands.
// This helper navigates AND waits for the h1 heading to appear — which only
// renders once the useLead() query resolves — before any further assertions.
async function goToLeadDetail(page: Page, leadId: string): Promise<void> {
  await goTo(page, `/dashboard/leads/${leadId}`);
  // h1 only mounts after React Query resolves; this is the reliable data-ready signal
  await page.waitForSelector("h1", { state: "visible", timeout: 12_000 });
}

test.describe("Lead detail page", () => {
  test("renders business name in h1", async ({ page }) => {
    await goToLeadDetail(page, "lead_001");
    await shot(page, "admin", "20-lead-detail");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Thornton's Auto Repair");
  });

  test("shows business website link", async ({ page }) => {
    // Seed stores URL without protocol — component may render it as-is or prefix http(s)
    // Use partial href match so the test is resilient to protocol differences
    await goToLeadDetail(page, "lead_001");
    await expect(page.locator('a[href*="thorntonsauto"]')).toBeVisible();
  });

  test("shows phone number", async ({ page }) => {
    await goToLeadDetail(page, "lead_001");
    await expect(page.getByText("+1 (312) 847-1928")).toBeVisible();
  });

  test("shows Business meta column", async ({ page }) => {
    await goToLeadDetail(page, "lead_001");
    await expect(page.getByText("Business", { exact: true })).toBeVisible();
  });

  test("shows Audit Findings column with outreach label", async ({ page }) => {
    await goToLeadDetail(page, "lead_001");
    await expect(page.getByText("Audit Findings")).toBeVisible();
    await expect(page.getByText(/immediate outreach/i)).toBeVisible();
  });

  test("shows Primary Issue section", async ({ page }) => {
    await goToLeadDetail(page, "lead_001");
    await expect(page.getByText("Primary Issue")).toBeVisible();
    await expect(page.getByText(/no https/i)).toBeVisible();
  });

  test("shows Outreach column and Email Draft", async ({ page }) => {
    await goToLeadDetail(page, "lead_001");
    // "Outreach" is the column header (CSS-uppercase but DOM text is "Outreach")
    await expect(page.getByText("Outreach")).toBeVisible();
    await expect(page.getByText("Email Draft")).toBeVisible();
  });

  test("Approve & Send button is present for pending draft", async ({ page }) => {
    await goToLeadDetail(page, "lead_001");
    await expect(page.getByRole("button", { name: /approve & send/i })).toBeVisible();
  });

  test("approve action shows sent confirmation", async ({ page }) => {
    await goToLeadDetail(page, "lead_001");
    await page.getByRole("button", { name: /approve & send/i }).click();
    await shot(page, "admin", "21-lead-detail-approved");
    // Dev backend queues the send; confirmation reads "Approved — pending send."
    // In production it reads "Email sent successfully." — accept either:
    await expect(
      page.getByText(/approved.*pending send|email sent/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("discard action shows confirmation on lead_002", async ({ page }) => {
    // lead_002 has a PENDING_APPROVAL email draft — the Discard button should appear
    await goToLeadDetail(page, "lead_002");
    await page.getByRole("button", { name: /discard/i }).click();
    await shot(page, "admin", "22-lead-detail-discarded");
    // Accept any rejection/discard confirmation wording
    await expect(
      page.getByText(/discarded|rejected|draft removed/i).first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test("Edit Draft button expands textarea", async ({ page }) => {
    // lead_005 (Paw & Whisker Grooming) has email_004 → PENDING_APPROVAL.
    // lead_001 and lead_002 are mutated by the approve/discard tests above, so
    // use a lead whose draft is still untouched at this point in the suite.
    await goToLeadDetail(page, "lead_005");
    await page.getByRole("button", { name: /edit draft/i }).click();
    await shot(page, "admin", "23-lead-detail-edit-draft");
    await expect(page.locator("textarea")).toBeVisible();
  });

  test("back link navigates to leads list", async ({ page }) => {
    await goToLeadDetail(page, "lead_001");
    await page.locator("a", { hasText: "Leads" }).first().click();
    await expect(page).toHaveURL("/dashboard/leads");
  });

  test("404 for unknown lead shows inline error", async ({ page }) => {
    await page.goto("/dashboard/leads/lead_999");
    await shot(page, "admin", "24-lead-detail-404");
    await expect(
      page.getByText(/lead not found|failed to load/i)
    ).toBeVisible({ timeout: 8_000 });
  });
});

// ─── 4. Approvals queue ───────────────────────────────────────────────────────

test.describe("Approvals queue", () => {
  test("renders heading and pending count badge", async ({ page }) => {
    await goTo(page, "/dashboard/approvals");
    await shot(page, "admin", "30-approvals");
    await expect(page.getByRole("heading", { name: "Approval Queue" })).toBeVisible();
    await expect(page.getByText(/\d+ pending/i)).toBeVisible();
  });

  test("Pending tab shows known pending draft", async ({ page }) => {
    await goTo(page, "/dashboard/approvals");
    await expect(page.getByText("Thornton's Auto Repair")).toBeVisible();
  });

  test("Sent tab shows sent drafts", async ({ page }) => {
    await goTo(page, "/dashboard/approvals");
    await page.getByRole("button", { name: /sent/i }).first().click();
    await shot(page, "admin", "31-approvals-sent-tab");
    await expect(page.getByText("Primrose Bakery & Café")).toBeVisible();
  });

  test("All tab shows both sent and pending drafts", async ({ page }) => {
    await goTo(page, "/dashboard/approvals");
    await page.getByRole("button", { name: /^all/i }).click();
    await expect(page.getByText("Thornton's Auto Repair")).toBeVisible();
    await expect(page.getByText("Primrose Bakery & Café")).toBeVisible();
  });

  test("expand email body preview shows draft text", async ({ page }) => {
    await goTo(page, "/dashboard/approvals");
    await page.getByText(/preview email body/i).first().click();
    await shot(page, "admin", "32-approvals-preview-expanded");
    await expect(page.getByText(/Hi,/i).first()).toBeVisible();
  });

  test("approve button triggers resolved state", async ({ page }) => {
    await goTo(page, "/dashboard/approvals");
    await page.getByRole("button", { name: /approve & send/i }).first().click();
    await shot(page, "admin", "33-approvals-approved");
    await expect(
      page.getByText(/sent to|email sent|email approved/i).first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test("discard button triggers resolved state", async ({ page }) => {
    await goTo(page, "/dashboard/approvals");
    await page.getByRole("button", { name: /discard/i }).nth(1).click();
    await shot(page, "admin", "34-approvals-discarded");
    await expect(page.getByText(/draft discarded/i)).toBeVisible();
  });
});

// ─── 5. Runs list ─────────────────────────────────────────────────────────────

test.describe("Pipeline Runs list", () => {
  test("renders page heading with status chips", async ({ page }) => {
    await goTo(page, "/dashboard/runs");
    await shot(page, "admin", "40-runs-list");
    await expect(page.getByRole("heading", { name: "Pipeline Runs" })).toBeVisible();
    await expect(page.getByText(/complete/i).first()).toBeVisible();
    await expect(page.getByText(/failed/i).first()).toBeVisible();
  });

  test("shows run rows with niche names", async ({ page }) => {
    await goTo(page, "/dashboard/runs");
    await expect(page.getByText("Auto Repair").first()).toBeVisible();
    await expect(page.getByText("HVAC").first()).toBeVisible();
  });

  test("shows agent timeline abbreviations and counters", async ({ page }) => {
    await goTo(page, "/dashboard/runs");
    await expect(page.getByText("sco").first()).toBeVisible();
    await expect(page.getByText("ana").first()).toBeVisible();
    await expect(page.getByText("found").first()).toBeVisible();
    await expect(page.getByText("sent").first()).toBeVisible();
  });

  test("clicking a run navigates to run detail", async ({ page }) => {
    await goTo(page, "/dashboard/runs");
    await page.getByRole("link", { name: /auto repair/i }).first().click();
    await expect(page).toHaveURL(/\/dashboard\/runs\/run_/);
  });
});

// ─── 6. Run detail ────────────────────────────────────────────────────────────

// Data-load gate for run detail — h1 only renders after useRun() query resolves.
async function goToRunDetail(page: Page, runId: string): Promise<void> {
  await goTo(page, `/dashboard/runs/${runId}`);
  await page.waitForSelector("h1", { state: "visible", timeout: 12_000 });
}

test.describe("Run detail page", () => {
  test("renders niche in h1 with 4 stat cards", async ({ page }) => {
    await goToRunDetail(page, "run_001");
    await shot(page, "admin", "50-run-detail");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Auto Repair");
    await expect(page.getByText("Leads Found")).toBeVisible();
    await expect(page.getByText("Leads Scored").first()).toBeVisible();
    await expect(page.getByText("Drafts Made")).toBeVisible();
    await expect(page.getByText("Emails Sent")).toBeVisible();
  });

  test("stat card shows correct lead count (run_001 = 23 found)", async ({ page }) => {
    await goToRunDetail(page, "run_001");
    const foundCard = page.locator(".bg-card").filter({ hasText: "Leads Found" });
    await expect(foundCard.getByText("23")).toBeVisible();
  });

  test("shows all 5 agent step rows", async ({ page }) => {
    await goToRunDetail(page, "run_001");
    await expect(page.getByText("Scout Agent")).toBeVisible();
    await expect(page.getByText("Analyst Agent")).toBeVisible();
    await expect(page.getByText("Writer Agent")).toBeVisible();
    await expect(page.getByText("Tracker Agent")).toBeVisible();
    await expect(page.getByText("Reporter Agent")).toBeVisible();
  });

  test("event log shows events from run", async ({ page }) => {
    await goToRunDetail(page, "run_001");
    await shot(page, "admin", "51-run-detail-events");
    await expect(page.getByText("Event Log")).toBeVisible();
    await expect(page.getByText(/querying google maps/i)).toBeVisible();
  });

  test("replay button is present", async ({ page }) => {
    await goToRunDetail(page, "run_001");
    await expect(page.getByText(/↺ replay/i)).toBeVisible();
  });

  test("failed run shows error event (run_003)", async ({ page }) => {
    await goToRunDetail(page, "run_003");
    await shot(page, "admin", "52-run-detail-failed");
    await expect(page.getByText(/max retries exceeded/i)).toBeVisible();
  });

  test("404 for unknown run shows inline error", async ({ page }) => {
    await page.goto("/dashboard/runs/run_999");
    await shot(page, "admin", "53-run-detail-404");
    await expect(
      page.getByText(/not found|failed to load/i)
    ).toBeVisible({ timeout: 8_000 });
  });
});

// ─── 7. Settings ──────────────────────────────────────────────────────────────

test.describe("Settings form", () => {
  test("renders heading and API Credentials section", async ({ page }) => {
    await goTo(page, "/dashboard/settings");
    await shot(page, "admin", "60-settings");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(page.getByText("API Credentials", { exact: true })).toBeVisible();
    await expect(page.getByText("Anthropic API Key", { exact: true })).toBeVisible();
    await expect(page.getByText("Google Maps API Key", { exact: true })).toBeVisible();
  });

  test("API key fields are masked (password type)", async ({ page }) => {
    await goTo(page, "/dashboard/settings");
    const pwFields = page.locator('input[type="password"]');
    expect(await pwFields.count()).toBeGreaterThan(0);
  });

  test("eye button toggles field to text type", async ({ page }) => {
    await goTo(page, "/dashboard/settings");
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
    const eyeBtn = page.locator("button:has(svg)").first();
    await eyeBtn.click();
    await shot(page, "admin", "61-settings-key-revealed");
    await expect(page.locator('input[type="text"]').first()).toBeVisible();
  });

  test("shows Pipeline Defaults section", async ({ page }) => {
    await goTo(page, "/dashboard/settings");
    await expect(page.getByText("Pipeline Defaults", { exact: true })).toBeVisible();
    await expect(page.getByText("Score threshold", { exact: true })).toBeVisible();
    await expect(page.getByText("Daily quota", { exact: true })).toBeVisible();
  });

  test("Target Niches shows pre-populated tags (Auto Repair, Plumbing)", async ({ page }) => {
    await goTo(page, "/dashboard/settings");
    await shot(page, "admin", "62-settings-niches");
    await expect(page.getByText("Target Niches")).toBeVisible();
    await expect(page.getByText("Auto Repair").first()).toBeVisible();
    await expect(page.getByText("Plumbing").first()).toBeVisible();
  });

  test("adding a niche tag appends it to the list", async ({ page }) => {
    await goTo(page, "/dashboard/settings");
    const addInputs = page.getByPlaceholder("Add…");
    await addInputs.first().fill("Roofing");
    await addInputs.first().press("Enter");
    await shot(page, "admin", "63-settings-niche-added");
    await expect(page.getByText("Roofing").first()).toBeVisible();
  });

  test("Target Markets shows seeded cities", async ({ page }) => {
    await goTo(page, "/dashboard/settings");
    await expect(page.getByText("Target Markets", { exact: true })).toBeVisible();
    await expect(page.getByText(/Chicago/i).first()).toBeVisible();
    await expect(page.getByText(/Austin/i).first()).toBeVisible();
  });

  test("Save Settings button shows saved confirmation", async ({ page }) => {
    await goTo(page, "/dashboard/settings");
    await page.getByRole("button", { name: /save settings/i }).click();
    await shot(page, "admin", "64-settings-saved");
    await expect(page.getByRole("button", { name: /saved/i })).toBeVisible();
  });
});

// ─── 8. Analytics ────────────────────────────────────────────────────────────

test.describe("Analytics page", () => {
  test("renders heading and KPI strip", async ({ page }) => {
    await goTo(page, "/dashboard/analytics");
    await shot(page, "admin", "70-analytics");
    await expect(page.getByRole("heading", { name: "Analytics" })).toBeVisible();
    await expect(page.getByText("Total Leads", { exact: true })).toBeVisible();
    await expect(page.getByText("Total Sent",  { exact: true })).toBeVisible();
    await expect(page.getByText("Reply Rate",  { exact: true })).toBeVisible();
    await expect(page.getByText("Avg Score",   { exact: true })).toBeVisible();
  });

  test("shows Lead Funnel panel", async ({ page }) => {
    await goTo(page, "/dashboard/analytics");
    await expect(page.getByText("Lead Funnel")).toBeVisible();
    await expect(page.getByText(/Discovery.*Score.*Draft/i)).toBeVisible();
  });

  test("shows Reply Rate chart panel", async ({ page }) => {
    await goTo(page, "/dashboard/analytics");
    await expect(page.getByText("Reply Rate — Last 14 Days")).toBeVisible();
  });

  test("shows Score Distribution panel", async ({ page }) => {
    await goTo(page, "/dashboard/analytics");
    await expect(page.getByText("Score Distribution")).toBeVisible();
  });

  test("shows Niche Breakdown table with data", async ({ page }) => {
    await goTo(page, "/dashboard/analytics");
    await shot(page, "admin", "71-analytics-niche-breakdown");
    await expect(page.getByText("Niche Breakdown")).toBeVisible();
    await expect(page.getByText("Auto Repair").first()).toBeVisible();
    await expect(page.getByText("Pet Grooming").first()).toBeVisible();
  });

  test("recharts SVG elements render", async ({ page }) => {
    await goTo(page, "/dashboard/analytics");
    await page.waitForTimeout(700);
    await shot(page, "admin", "72-analytics-charts");
    const svgs = page.locator("svg");
    expect(await svgs.count()).toBeGreaterThan(0);
  });
});

// ─── 9. Sidebar navigation ───────────────────────────────────────────────────

test.describe("Sidebar navigation", () => {
  test("active link has amber class; inactive links do not", async ({ page }) => {
    await goTo(page, "/dashboard/leads");
    await shot(page, "admin", "80-sidebar-active-leads");
    const activeLink   = page.locator("aside a[href='/dashboard/leads']");
    const inactiveLink = page.locator("aside a[href='/dashboard/runs']");
    await expect(activeLink).toHaveClass(/text-lp-amber/);
    await expect(inactiveLink).not.toHaveClass(/text-lp-amber/);
  });

  test("active Runs link has amber class", async ({ page }) => {
    await goTo(page, "/dashboard/runs");
    const link = page.locator("aside a[href='/dashboard/runs']");
    await expect(link).toHaveClass(/text-lp-amber/);
  });
});
