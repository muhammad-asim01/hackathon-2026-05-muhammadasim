/**
 * sift.ai Admin Pages — Playwright E2E Tests
 */

import { test, expect, type Page } from "@playwright/test";
import { execSync } from "child_process";
import path from "path";

async function goTo(page: Page, path: string) {
  await page.goto(path, { waitUntil: "networkidle" });
}

// ─── DB seed before entire suite ─────────────────────────────────────────────
// Tests mutate DB state (approve/discard actions). Re-seed once before all tests
// so every run starts from a deterministic baseline.

test.beforeAll(() => {
  const backendDir = path.resolve(__dirname, "../main-project/backend");
  execSync("npx prisma db seed", { cwd: backendDir, stdio: "inherit" });
});

// ─── 1. Dashboard ─────────────────────────────────────────────────────────────

test.describe("Dashboard overview", () => {
  test("renders page title", async ({ page }) => {
    await goTo(page, "/dashboard");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });

  test("shows 4 KPI cards", async ({ page }) => {
    await goTo(page, "/dashboard");
    // Actual labels: Total leads / Emails sent / Replies / Reply rate
    await expect(page.getByText(/total leads/i).first()).toBeVisible();
    await expect(page.getByText(/emails sent/i).first()).toBeVisible();
    await expect(page.getByText(/\bReplies\b/i).first()).toBeVisible();
    await expect(page.getByText(/reply rate/i).first()).toBeVisible();
  });

  test("shows Recent Runs widget with run links", async ({ page }) => {
    await goTo(page, "/dashboard");
    // Exact: true because AgentPanel has "Recent runs" label too
    await expect(page.getByText("Recent Runs", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Auto Repair|Pet Grooming|HVAC|Landscaping/i }).first()
    ).toBeVisible();
  });

  test("shows Recent Leads widget", async ({ page }) => {
    await goTo(page, "/dashboard");
    await expect(page.getByText("Recent Leads", { exact: true })).toBeVisible();
    // At least one lead link (any business) in the Recent Leads section
    const widget = page.locator(".bg-card").filter({ has: page.locator("p", { hasText: "Recent Leads" }) });
    await expect(widget.getByRole("link").first()).toBeVisible();
  });

  test("sidebar has all 6 nav items", async ({ page }) => {
    await goTo(page, "/dashboard");
    const sidebar = page.locator("aside");
    await expect(sidebar.getByRole("link", { name: "Agent" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Leads" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Runs" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Approvals" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Analytics" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Settings" })).toBeVisible();
  });
});

// ─── 2. Leads list ────────────────────────────────────────────────────────────

test.describe("Leads table", () => {
  test("renders page heading", async ({ page }) => {
    await goTo(page, "/dashboard/leads");
    await expect(page.getByRole("heading", { name: "Leads" })).toBeVisible();
  });

  test("shows leads table", async ({ page }) => {
    await goTo(page, "/dashboard/leads");
    await expect(page.locator("table")).toBeVisible();
  });

  test("shows a known business in the table", async ({ page }) => {
    await goTo(page, "/dashboard/leads");
    await expect(page.getByRole("link", { name: "Thornton's Auto Repair" })).toBeVisible();
  });

  test("search filters rows", async ({ page }) => {
    await goTo(page, "/dashboard/leads");
    const searchInput = page.getByPlaceholder(/search business/i);
    await searchInput.fill("thornton");
    await expect(page.getByText("Thornton's Auto Repair")).toBeVisible();
    await expect(page.getByText("Bellini's Ristorante")).not.toBeVisible();
  });

  test("Filters panel toggles open", async ({ page }) => {
    await goTo(page, "/dashboard/leads");
    await page.getByRole("button", { name: /filters/i }).click();
    await expect(page.getByText(/score range/i)).toBeVisible();
    await expect(page.getByText(/status/i).first()).toBeVisible();
  });

  test("status filter — New hides rejected leads", async ({ page }) => {
    await goTo(page, "/dashboard/leads");
    await page.getByRole("button", { name: /filters/i }).click();
    await page.getByRole("button", { name: "New" }).click();
    await expect(page.getByText("Thornton's Auto Repair")).toBeVisible();
    await expect(page.getByText("Ironwood Fitness & Yoga")).not.toBeVisible();
  });

  test("sort by Score header click doesn't crash", async ({ page }) => {
    await goTo(page, "/dashboard/leads");
    await page.getByRole("columnheader", { name: /score/i }).click();
    await expect(page.locator("table")).toBeVisible();
  });

  test("clear filters resets search", async ({ page }) => {
    await goTo(page, "/dashboard/leads");
    const searchInput = page.getByPlaceholder(/search business/i);
    await searchInput.fill("xyz");
    await page.getByRole("button", { name: /clear/i }).click();
    await expect(searchInput).toHaveValue("");
  });

  test("clicking a lead navigates to detail", async ({ page }) => {
    await goTo(page, "/dashboard/leads");
    await page.getByRole("link", { name: "Thornton's Auto Repair" }).click();
    await expect(page).toHaveURL(/\/dashboard\/leads\/lead_001/);
  });
});

// ─── 3. Lead detail ───────────────────────────────────────────────────────────

test.describe("Lead detail page", () => {
  test("renders business name in h1", async ({ page }) => {
    await goTo(page, "/dashboard/leads/lead_001");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Thornton's Auto Repair");
  });

  test("shows business website link", async ({ page }) => {
    await goTo(page, "/dashboard/leads/lead_001");
    // Target the external link specifically
    await expect(page.locator('a[href="https://thorntonsauto.net"]')).toBeVisible();
  });

  test("shows phone number", async ({ page }) => {
    await goTo(page, "/dashboard/leads/lead_001");
    await expect(page.getByText("+1 (312) 847-1928")).toBeVisible();
  });

  test("shows Business meta column", async ({ page }) => {
    await goTo(page, "/dashboard/leads/lead_001");
    await expect(page.getByText("Business", { exact: true })).toBeVisible();
  });

  test("shows Audit Findings column", async ({ page }) => {
    await goTo(page, "/dashboard/leads/lead_001");
    await expect(page.getByText("Audit Findings")).toBeVisible();
    await expect(page.getByText(/immediate outreach/i)).toBeVisible();
  });

  test("shows Primary Issue", async ({ page }) => {
    await goTo(page, "/dashboard/leads/lead_001");
    await expect(page.getByText("Primary Issue")).toBeVisible();
    await expect(page.getByText(/no https/i)).toBeVisible();
  });

  test("shows Outreach column header", async ({ page }) => {
    await goTo(page, "/dashboard/leads/lead_001");
    // exact: true to avoid matching "Immediate outreach" substring
    await expect(page.getByText("Outreach", { exact: true })).toBeVisible();
  });

  test("shows Email Draft section in outreach", async ({ page }) => {
    await goTo(page, "/dashboard/leads/lead_001");
    await expect(page.getByText("Email Draft")).toBeVisible();
  });

  test("Approve & Send button is present for pending draft", async ({ page }) => {
    await goTo(page, "/dashboard/leads/lead_001");
    await expect(page.getByRole("button", { name: /approve & send/i })).toBeVisible();
  });

  test("approve action shows confirmation", async ({ page }) => {
    await goTo(page, "/dashboard/leads/lead_001");
    await page.getByRole("button", { name: /approve & send/i }).click();
    // Resolved state shows "Email sent to {email}" or "Email sent successfully."
    await expect(page.getByText(/email sent/i).first()).toBeVisible({ timeout: 8_000 });
  });

  test("discard action shows confirmation", async ({ page }) => {
    await goTo(page, "/dashboard/leads/lead_002");
    await page.getByRole("button", { name: /discard/i }).click();
    await expect(page.getByText(/draft discarded/i)).toBeVisible();
  });

  test("Edit Draft expands textarea", async ({ page }) => {
    await goTo(page, "/dashboard/leads/lead_001");
    await page.getByRole("button", { name: /edit draft/i }).click();
    await expect(page.locator("textarea")).toBeVisible();
  });

  test("back link navigates to leads list", async ({ page }) => {
    await goTo(page, "/dashboard/leads/lead_001");
    // Breadcrumb back link (first Leads link — sidebar is md:hidden on desktop)
    await page.locator("a", { hasText: "Leads" }).first().click();
    await expect(page).toHaveURL("/dashboard/leads");
  });

  test("404 for unknown lead", async ({ page }) => {
    // Lead detail is a client component — unknown IDs render an inline error (no HTTP 404)
    await page.goto("/dashboard/leads/lead_999");
    await expect(page.getByText(/lead not found|failed to load/i)).toBeVisible({ timeout: 8_000 });
  });
});

// ─── 4. Approvals queue ───────────────────────────────────────────────────────

test.describe("Approvals queue", () => {
  test("renders page heading", async ({ page }) => {
    await goTo(page, "/dashboard/approvals");
    await expect(page.getByRole("heading", { name: "Approval Queue" })).toBeVisible();
  });

  test("shows pending count badge", async ({ page }) => {
    await goTo(page, "/dashboard/approvals");
    await expect(page.getByText(/\d+ pending/i)).toBeVisible();
  });

  test("Pending tab shows known pending draft", async ({ page }) => {
    await goTo(page, "/dashboard/approvals");
    await expect(page.getByText("Thornton's Auto Repair")).toBeVisible();
  });

  test("Sent tab shows sent drafts", async ({ page }) => {
    await goTo(page, "/dashboard/approvals");
    // Tab has the word "Sent" plus a number
    await page.getByRole("button", { name: /sent/i }).first().click();
    await expect(page.getByText("Primrose Bakery & Café")).toBeVisible();
  });

  test("All tab shows both sent and pending drafts", async ({ page }) => {
    await goTo(page, "/dashboard/approvals");
    await page.getByRole("button", { name: /^all/i }).click();
    await expect(page.getByText("Thornton's Auto Repair")).toBeVisible();
    await expect(page.getByText("Primrose Bakery & Café")).toBeVisible();
  });

  test("can expand email body and see draft text", async ({ page }) => {
    await goTo(page, "/dashboard/approvals");
    await page.getByText(/preview email body/i).first().click();
    // Draft 001 body starts with "Hi," and references auto repair in Chicago
    await expect(page.getByText(/Hi,/i).first()).toBeVisible();
  });

  test("approve button triggers resolved state", async ({ page }) => {
    await goTo(page, "/dashboard/approvals");
    await page.getByRole("button", { name: /approve & send/i }).first().click();
    // Resolved state shows "Sent to {email}" or "Email sent" — or toast "Email approved & sent"
    await expect(
      page.getByText(/sent to|email sent|email approved/i).first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test("discard button triggers resolved state", async ({ page }) => {
    await goTo(page, "/dashboard/approvals");
    await page.getByRole("button", { name: /discard/i }).nth(1).click();
    await expect(page.getByText(/draft discarded/i)).toBeVisible();
  });
});

// ─── 5. Runs list ─────────────────────────────────────────────────────────────

test.describe("Pipeline Runs list", () => {
  test("renders page heading", async ({ page }) => {
    await goTo(page, "/dashboard/runs");
    await expect(page.getByRole("heading", { name: "Pipeline Runs" })).toBeVisible();
  });

  test("shows complete and failed summary chips", async ({ page }) => {
    await goTo(page, "/dashboard/runs");
    await expect(page.getByText(/complete/i).first()).toBeVisible();
    await expect(page.getByText(/failed/i).first()).toBeVisible();
  });

  test("shows run rows with niche names", async ({ page }) => {
    await goTo(page, "/dashboard/runs");
    await expect(page.getByText("Auto Repair").first()).toBeVisible();
    await expect(page.getByText("HVAC").first()).toBeVisible();
  });

  test("shows agent timeline abbreviations", async ({ page }) => {
    await goTo(page, "/dashboard/runs");
    await expect(page.getByText("sco").first()).toBeVisible();
    await expect(page.getByText("ana").first()).toBeVisible();
  });

  test("shows leads found and sent counters", async ({ page }) => {
    await goTo(page, "/dashboard/runs");
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

test.describe("Run detail page", () => {
  test("renders niche in h1", async ({ page }) => {
    await goTo(page, "/dashboard/runs/run_001");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Auto Repair");
  });

  test("shows 4 stat cards", async ({ page }) => {
    await goTo(page, "/dashboard/runs/run_001");
    await expect(page.getByText("Leads Found")).toBeVisible();
    await expect(page.getByText("Leads Scored").first()).toBeVisible();
    await expect(page.getByText("Drafts Made")).toBeVisible();
    await expect(page.getByText("Emails Sent")).toBeVisible();
  });

  test("stat card shows correct lead count for run_001", async ({ page }) => {
    await goTo(page, "/dashboard/runs/run_001");
    // run_001 leadsFound = 23
    const foundCard = page.locator(".bg-card").filter({ hasText: "Leads Found" });
    await expect(foundCard.getByText("23")).toBeVisible();
  });

  test("shows all 5 agent steps", async ({ page }) => {
    await goTo(page, "/dashboard/runs/run_001");
    await expect(page.getByText("Scout Agent")).toBeVisible();
    await expect(page.getByText("Analyst Agent")).toBeVisible();
    await expect(page.getByText("Writer Agent")).toBeVisible();
    await expect(page.getByText("Tracker Agent")).toBeVisible();
    await expect(page.getByText("Reporter Agent")).toBeVisible();
  });

  test("event log shows events", async ({ page }) => {
    await goTo(page, "/dashboard/runs/run_001");
    await expect(page.getByText("Event Log")).toBeVisible();
    await expect(page.getByText(/querying google maps/i)).toBeVisible();
  });

  test("replay button is present", async ({ page }) => {
    await goTo(page, "/dashboard/runs/run_001");
    await expect(page.getByText(/↺ replay/i)).toBeVisible();
  });

  test("failed run shows error event", async ({ page }) => {
    await goTo(page, "/dashboard/runs/run_003");
    await expect(page.getByText(/max retries exceeded/i)).toBeVisible();
  });

  test("404 for unknown run", async ({ page }) => {
    // Run detail is a client component — unknown IDs render an inline error (no HTTP 404)
    await page.goto("/dashboard/runs/run_999");
    await expect(page.getByText(/not found|failed to load/i)).toBeVisible({ timeout: 8_000 });
  });
});

// ─── 7. Settings ──────────────────────────────────────────────────────────────

test.describe("Settings form", () => {
  test("renders page heading", async ({ page }) => {
    await goTo(page, "/dashboard/settings");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  });

  test("shows API Credentials section", async ({ page }) => {
    await goTo(page, "/dashboard/settings");
    // exact: true — "API Credentials" also appears as a substring in the page description
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
    // There's a field for Anthropic API Key (first password field)
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
    // Click the first visible eye icon button (the toggle)
    const eyeBtn = page.locator("button:has(svg)").first();
    await eyeBtn.click();
    // Now at least one text input should be visible
    await expect(page.locator('input[type="text"]').first()).toBeVisible();
  });

  test("shows Pipeline Defaults section", async ({ page }) => {
    await goTo(page, "/dashboard/settings");
    // exact: true — "Pipeline Defaults" appears as substring in the page description
    await expect(page.getByText("Pipeline Defaults", { exact: true })).toBeVisible();
    await expect(page.getByText("Score threshold", { exact: true })).toBeVisible();
    await expect(page.getByText("Daily quota", { exact: true })).toBeVisible();
  });

  test("Target Niches shows pre-populated tags", async ({ page }) => {
    await goTo(page, "/dashboard/settings");
    await expect(page.getByText("Target Niches")).toBeVisible();
    await expect(page.getByText("Auto Repair").first()).toBeVisible();
    await expect(page.getByText("Plumbing").first()).toBeVisible();
  });

  test("adding a niche tag appends it", async ({ page }) => {
    await goTo(page, "/dashboard/settings");
    const addInputs = page.getByPlaceholder("Add…");
    await addInputs.first().fill("Roofing");
    await addInputs.first().press("Enter");
    await expect(page.getByText("Roofing").first()).toBeVisible();
  });

  test("shows Target Markets with cities", async ({ page }) => {
    await goTo(page, "/dashboard/settings");
    await expect(page.getByText("Target Markets", { exact: true })).toBeVisible();
    // Cities are populated from the Settings seed data
    await expect(page.getByText(/Chicago/i).first()).toBeVisible();
    await expect(page.getByText(/Austin/i).first()).toBeVisible();
  });

  test("Save Settings button shows confirmation", async ({ page }) => {
    await goTo(page, "/dashboard/settings");
    await page.getByRole("button", { name: /save settings/i }).click();
    await expect(page.getByRole("button", { name: /saved/i })).toBeVisible();
  });
});

// ─── 8. Analytics ────────────────────────────────────────────────────────────

test.describe("Analytics page", () => {
  test("renders page heading", async ({ page }) => {
    await goTo(page, "/dashboard/analytics");
    await expect(page.getByRole("heading", { name: "Analytics" })).toBeVisible();
  });

  test("shows KPI strip", async ({ page }) => {
    await goTo(page, "/dashboard/analytics");
    await expect(page.getByText("Total Leads", { exact: true })).toBeVisible();
    await expect(page.getByText("Total Sent", { exact: true })).toBeVisible();
    // exact: true — "Reply Rate" also appears in "Reply Rate — Last 14 Days" panel title
    await expect(page.getByText("Reply Rate", { exact: true })).toBeVisible();
    await expect(page.getByText("Avg Score", { exact: true })).toBeVisible();
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
    await expect(page.getByText("Niche Breakdown")).toBeVisible();
    await expect(page.getByText("Auto Repair").first()).toBeVisible();
    await expect(page.getByText("Pet Grooming").first()).toBeVisible();
  });

  test("recharts SVG elements render", async ({ page }) => {
    await goTo(page, "/dashboard/analytics");
    await page.waitForTimeout(700);
    const svgs = page.locator("svg");
    expect(await svgs.count()).toBeGreaterThan(0);
  });
});

// ─── 9. Sidebar navigation ───────────────────────────────────────────────────

test.describe("Sidebar navigation", () => {
  test("active Leads link has amber class", async ({ page }) => {
    await goTo(page, "/dashboard/leads");
    const link = page.locator("aside a[href='/dashboard/leads']");
    await expect(link).toHaveClass(/text-lp-amber/);
  });

  test("active Runs link has amber class", async ({ page }) => {
    await goTo(page, "/dashboard/runs");
    const link = page.locator("aside a[href='/dashboard/runs']");
    await expect(link).toHaveClass(/text-lp-amber/);
  });

  test("inactive links do not have amber class", async ({ page }) => {
    await goTo(page, "/dashboard/leads");
    const link = page.locator("aside a[href='/dashboard/runs']");
    await expect(link).not.toHaveClass(/text-lp-amber/);
  });
});
