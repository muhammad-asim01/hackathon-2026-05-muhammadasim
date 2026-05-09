/**
 * Auth flow — E2E tests
 *
 * Covers:
 *   • Login page rendering + validation
 *   • Signup page rendering + validation
 *   • Full register → login → dashboard flow
 *   • Logout → redirected to /login
 *   • Post-logout back-button blocked (Cache-Control: no-store)
 *   • Logged-in redirect away from /login and /signup
 *
 * These tests run WITHOUT the global storageState so every request
 * starts unauthenticated. The override below clears the injected cookie.
 *
 * Screenshots → .playwright/screenshots/auth/
 */

import { test, expect, type Page } from "@playwright/test";
import { shot, goTo, apiPost } from "./helpers";

// ─── Clear global auth cookie for this entire file ───────────────────────────
// Without this, globalSetup's auth.json would auto-authenticate every request.
test.use({ storageState: { cookies: [], origins: [] } });

// ─── Test user (created in beforeAll if not already exists) ──────────────────

const TEST_EMAIL    = "playwright-auth@sift.ai";
const TEST_PASSWORD = "Playwright123!";
const TEST_NAME     = "Playwright Tester";

async function registerTestUser(): Promise<void> {
  try {
    const res = await apiPost<{ id: string }>("/auth/register", {
      email:    TEST_EMAIL,
      password: TEST_PASSWORD,
      name:     TEST_NAME,
    });
    if (res.ok) {
      console.log("✓ Test user registered:", TEST_EMAIL);
    } else {
      // 409 Conflict = already exists from a previous run — that's fine
      console.log("• Test user already exists (skipping registration)");
    }
  } catch (err) {
    // Backend may not be running — individual tests will fail with clear messages
    console.warn("⚠  Backend not reachable for registration (auth flow tests will likely fail):", (err as Error).message);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function fillLogin(page: Page, email: string, password: string): Promise<void> {
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
}

async function fillSignup(page: Page, opts: { name?: string; email: string; password: string }): Promise<void> {
  if (opts.name) await page.getByLabel(/name/i).fill(opts.name);
  await page.getByLabel(/email/i).fill(opts.email);
  await page.getByLabel(/password/i).fill(opts.password);
}

async function clickSubmit(page: Page): Promise<void> {
  await page.getByRole("button", { name: /sign in|create account/i }).click();
}

// ─── Suite setup ─────────────────────────────────────────────────────────────

test.beforeAll(async () => {
  await registerTestUser();
});

// ─── 1. Login page ────────────────────────────────────────────────────────────

test.describe("Login page", () => {
  test("renders heading and all fields", async ({ page }) => {
    await goTo(page, "/login");
    await shot(page, "auth", "01-login-page");
    await expect(page.getByRole("heading", { name: /sign in|welcome back/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("shows Google sign-in button", async ({ page }) => {
    await goTo(page, "/login");
    await expect(page.getByRole("button", { name: /google/i })).toBeVisible();
  });

  test("shows link to signup page", async ({ page }) => {
    await goTo(page, "/login");
    await expect(page.getByRole("link", { name: /sign up|create account/i })).toBeVisible();
  });

  test("shows success banner when registered=1 query param present", async ({ page }) => {
    await goTo(page, "/login?registered=1");
    await shot(page, "auth", "02-login-registered-banner");
    await expect(page.getByText(/account created|sign in below/i)).toBeVisible();
  });

  test("invalid email format — shows validation error", async ({ page }) => {
    await goTo(page, "/login");
    await fillLogin(page, "not-an-email", TEST_PASSWORD);
    await clickSubmit(page);
    await shot(page, "auth", "03-login-invalid-email");
    // Either browser native validation or server-side error
    await expect(
      page.getByText(/invalid email|valid email/i).or(page.locator(":invalid"))
    ).toBeVisible({ timeout: 5_000 });
  });

  test("wrong password — shows error message", async ({ page }) => {
    await goTo(page, "/login");
    await fillLogin(page, TEST_EMAIL, "wrong-password-xyz");
    await clickSubmit(page);
    await shot(page, "auth", "04-login-wrong-password");
    await expect(
      page.getByText(/invalid credentials|incorrect password|sign in failed/i)
    ).toBeVisible({ timeout: 8_000 });
  });

  test("unknown email — shows error message", async ({ page }) => {
    await goTo(page, "/login");
    await fillLogin(page, "unknown@nobody.com", TEST_PASSWORD);
    await clickSubmit(page);
    await shot(page, "auth", "05-login-unknown-email");
    await expect(
      page.getByText(/invalid credentials|no account|not found/i)
    ).toBeVisible({ timeout: 8_000 });
  });

  test("valid credentials — redirects to dashboard", async ({ page }) => {
    await goTo(page, "/login");
    await fillLogin(page, TEST_EMAIL, TEST_PASSWORD);
    await shot(page, "auth", "06-login-filled");
    await clickSubmit(page);
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
    await shot(page, "auth", "07-login-success-dashboard");
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();
  });
});

// ─── 2. Signup page ───────────────────────────────────────────────────────────

test.describe("Signup page", () => {
  test("renders heading and all fields", async ({ page }) => {
    await goTo(page, "/signup");
    await shot(page, "auth", "10-signup-page");
    await expect(page.getByRole("heading", { name: /create account|sign up/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /create account/i })).toBeVisible();
  });

  test("shows link back to login page", async ({ page }) => {
    await goTo(page, "/signup");
    await expect(page.getByRole("link", { name: /sign in|already have an account/i })).toBeVisible();
  });

  test("password too short — shows validation error", async ({ page }) => {
    await goTo(page, "/signup");
    await fillSignup(page, { email: "short@test.com", password: "abc" });
    await clickSubmit(page);
    await shot(page, "auth", "11-signup-short-password");
    await expect(
      page.getByText(/at least 8 characters|password.*short|too short/i)
    ).toBeVisible({ timeout: 5_000 });
  });

  test("invalid email format — shows validation error", async ({ page }) => {
    await goTo(page, "/signup");
    await fillSignup(page, { email: "bademail", password: "ValidPass123!" });
    await clickSubmit(page);
    await shot(page, "auth", "12-signup-invalid-email");
    await expect(
      page.getByText(/invalid email|valid email/i).or(page.locator(":invalid"))
    ).toBeVisible({ timeout: 5_000 });
  });

  test("existing email — shows error message", async ({ page }) => {
    await goTo(page, "/signup");
    await fillSignup(page, { email: TEST_EMAIL, password: "ValidPass123!" });
    await clickSubmit(page);
    await shot(page, "auth", "13-signup-existing-email");
    await expect(
      page.getByText(/already exists|already registered|email taken/i)
    ).toBeVisible({ timeout: 8_000 });
  });

  test("new user — redirects to /login?registered=1 with success banner", async ({ page }) => {
    const uniqueEmail = `playwright-new-${Date.now()}@sift.ai`;
    await goTo(page, "/signup");
    await fillSignup(page, { name: "New User", email: uniqueEmail, password: "NewUser123!" });
    await shot(page, "auth", "14-signup-new-user-filled");
    await clickSubmit(page);
    await page.waitForURL(/\/login/, { timeout: 15_000 });
    await shot(page, "auth", "15-signup-success-redirect");
    await expect(page).toHaveURL(/registered=1/);
    await expect(page.getByText(/account created|sign in below/i)).toBeVisible();
  });
});

// ─── 3. Full flow: register → login → dashboard → logout ─────────────────────

test.describe("Full auth flow", () => {
  test("login → dashboard → logout → blocked from dashboard", async ({ page }) => {
    // Step 1: login
    await goTo(page, "/login");
    await fillLogin(page, TEST_EMAIL, TEST_PASSWORD);
    await clickSubmit(page);
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
    await shot(page, "auth", "20-full-flow-dashboard");
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();

    // Step 2: find and click logout button
    // Logout may be in user menu or sidebar
    const logoutBtn = page.getByRole("button", { name: /sign out|log out|logout/i });
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
    } else {
      // Try user avatar / menu first
      const avatarBtn = page.getByRole("button", { name: /account|user|menu/i }).first();
      if (await avatarBtn.isVisible()) {
        await avatarBtn.click();
        await page.getByRole("menuitem", { name: /sign out|log out|logout/i }).click();
      }
    }

    await page.waitForURL(/\/login/, { timeout: 10_000 });
    await shot(page, "auth", "21-full-flow-after-logout");
    await expect(page).toHaveURL(/\/login/);

    // Step 3: attempt to access dashboard directly → should redirect to login
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await shot(page, "auth", "22-full-flow-dashboard-blocked");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: /sign in|welcome back/i })).toBeVisible();
  });

  test("logout + back button — dashboard not served from cache", async ({ page }) => {
    // Login first
    await goTo(page, "/login");
    await fillLogin(page, TEST_EMAIL, TEST_PASSWORD);
    await clickSubmit(page);
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });

    // Logout
    const logoutBtn = page.getByRole("button", { name: /sign out|log out|logout/i });
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
    } else {
      const avatarBtn = page.getByRole("button", { name: /account|user|menu/i }).first();
      if (await avatarBtn.isVisible()) {
        await avatarBtn.click();
        await page.getByRole("menuitem", { name: /sign out|log out|logout/i }).click();
      }
    }
    await page.waitForURL(/\/login/, { timeout: 10_000 });

    // Hit the browser back button — should NOT restore cached dashboard
    await page.goBack();
    await shot(page, "auth", "23-back-button-after-logout");
    // Cache-Control: no-store forces a server round-trip → auth check fails → /login
    await expect(page).toHaveURL(/\/login/);
  });
});

// ─── 4. Redirect rules ────────────────────────────────────────────────────────

test.describe("Redirect rules (logged-in user)", () => {
  // For these tests we need a logged-in session. Login manually first.
  async function loginAndGetSession(page: Page): Promise<void> {
    await goTo(page, "/login");
    await fillLogin(page, TEST_EMAIL, TEST_PASSWORD);
    await clickSubmit(page);
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
  }

  test("logged-in user visiting /login → redirected to /dashboard", async ({ page }) => {
    await loginAndGetSession(page);
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await shot(page, "auth", "30-loggedin-visit-login");
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("logged-in user visiting /signup → redirected to /dashboard", async ({ page }) => {
    await loginAndGetSession(page);
    await page.goto("/signup", { waitUntil: "domcontentloaded" });
    await shot(page, "auth", "31-loggedin-visit-signup");
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("unauthenticated user visiting /dashboard → redirected to /login", async ({ page }) => {
    // Already unauthenticated (storageState cleared at file level)
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await shot(page, "auth", "32-unauthed-dashboard-redirect");
    await expect(page).toHaveURL(/\/login/);
  });
});
