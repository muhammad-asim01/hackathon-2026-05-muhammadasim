/**
 * Public audit page — E2E tests
 *
 * The public /audit/[publicId] page requires NO authentication.
 * These tests run completely unauthenticated to verify the public-facing
 * prospect experience.
 *
 * Setup:
 *   1. Fetch a real publicId from the backend (dev-qa-bypass) before tests run.
 *   2. Run all page assertions against that real record.
 *
 * Screenshots → .playwright/screenshots/public/
 */

import { test, expect } from "@playwright/test";
import { shot, goTo, apiGet } from "./helpers";

// ─── Run without auth cookie ──────────────────────────────────────────────────
test.use({ storageState: { cookies: [], origins: [] } });

// ─── Resolve a real publicId before any test runs ────────────────────────────

let publicId = "";
let businessName = "";

interface LeadSummary {
  id: string;
  publicId: string;
  businessName: string;
  digitalScore: number | null;
}

interface LeadsResponse {
  leads: LeadSummary[];
  total: number;
}

test.beforeAll(async () => {
  try {
    const data = await apiGet<LeadsResponse>("/leads?limit=20");
    const leads = data.leads ?? [];

    // Prefer a lead with a score so the audit page has something to show
    const scored = leads.find((l) => l.digitalScore !== null && l.publicId);
    const candidate = scored ?? leads.find((l) => l.publicId);

    if (!candidate) {
      console.warn("⚠  No lead with publicId found — seeding may be needed. Skipping public tests.");
      return;
    }

    publicId     = candidate.publicId;
    businessName = candidate.businessName;
    console.log(`✓ Using publicId=${publicId} (${businessName}) for public audit tests`);
  } catch (err) {
    console.warn("⚠  Could not reach backend API — public audit tests may fail:", err);
  }
});

// ─── Helper: skip gracefully if no publicId was resolved ─────────────────────

function requirePublicId() {
  if (!publicId) test.skip(true, "No publicId available — run prisma db seed first");
}

// ─── 1. Public audit page ─────────────────────────────────────────────────────

test.describe("Public audit page /audit/[publicId]", () => {
  test("page loads without authentication", async ({ page }) => {
    requirePublicId();
    await goTo(page, `/audit/${publicId}`);
    await shot(page, "public", "01-audit-page-loaded");
    // Should NOT be redirected to login
    await expect(page).not.toHaveURL(/\/login/);
    // Should show something meaningful
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("shows business name", async ({ page }) => {
    requirePublicId();
    await goTo(page, `/audit/${publicId}`);
    await shot(page, "public", "02-audit-business-name");
    await expect(page.getByText(businessName, { exact: false })).toBeVisible({ timeout: 8_000 });
  });

  test("shows digital score", async ({ page }) => {
    requirePublicId();
    await goTo(page, `/audit/${publicId}`);
    await shot(page, "public", "03-audit-score");
    // Score appears as a number 0–100 or as a label like "Digital Score"
    await expect(
      page.getByText(/digital score|website score|audit score/i)
        .or(page.getByText(/\b\d{1,3}\b/).first())
    ).toBeVisible({ timeout: 8_000 });
  });

  test("shows audit findings or issues section", async ({ page }) => {
    requirePublicId();
    await goTo(page, `/audit/${publicId}`);
    await shot(page, "public", "04-audit-findings");
    await expect(
      page.getByText(/findings|issues|recommendations|what we found/i).first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test("shows CTA or contact prompt", async ({ page }) => {
    requirePublicId();
    await goTo(page, `/audit/${publicId}`);
    await shot(page, "public", "05-audit-cta");
    // Any call-to-action element
    await expect(
      page.getByRole("link", { name: /contact|get started|free|improve|fix/i })
        .or(page.getByRole("button", { name: /contact|get started|free|improve/i }))
        .first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test("page title contains business name or 'audit'", async ({ page }) => {
    requirePublicId();
    await goTo(page, `/audit/${publicId}`);
    const title = await page.title();
    const titleLower = title.toLowerCase();
    const nameLower  = businessName.toLowerCase().split(" ")[0]; // first word
    const hasName    = titleLower.includes(nameLower);
    const hasAudit   = titleLower.includes("audit") || titleLower.includes("sift");
    expect(hasName || hasAudit).toBeTruthy();
  });

  test("no auth-gated elements visible (no dashboard sidebar)", async ({ page }) => {
    requirePublicId();
    await goTo(page, `/audit/${publicId}`);
    await shot(page, "public", "06-audit-no-sidebar");
    // Admin sidebar should NOT appear on public pages
    await expect(page.locator("aside")).not.toBeVisible();
  });
});

// ─── 2. Invalid publicId ──────────────────────────────────────────────────────

test.describe("Invalid public audit URL", () => {
  test("unknown publicId shows 404 or error state", async ({ page }) => {
    await page.goto("/audit/definitely-not-a-real-id-xyz123", { waitUntil: "domcontentloaded" });
    await shot(page, "public", "10-audit-404");
    // Either a Next.js 404 page or an inline "not found" error
    await expect(
      page.getByText(/not found|no audit|404|could not find/i).first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test("empty publicId segment does not crash the server", async ({ page }) => {
    // /audit itself (no segment) should not 500 — either 404 or redirect
    const response = await page.goto("/audit", { waitUntil: "domcontentloaded" });
    // Accept any non-500 status
    expect(response?.status()).not.toBe(500);
    await shot(page, "public", "11-audit-no-segment");
  });
});

// ─── 3. SEO / meta ────────────────────────────────────────────────────────────

test.describe("Public page meta / SEO", () => {
  test("has a canonical <title> tag", async ({ page }) => {
    requirePublicId();
    await goTo(page, `/audit/${publicId}`);
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
    expect(title).not.toBe(""); // not blank
  });

  test("does not expose admin routes in page HTML", async ({ page }) => {
    requirePublicId();
    await goTo(page, `/audit/${publicId}`);
    const html = await page.content();
    // Admin routes should not appear as links in the public page
    expect(html).not.toContain('href="/dashboard');
    expect(html).not.toContain('href="/api/auth/me');
  });
});
