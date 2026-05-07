import { test, expect } from "@playwright/test";

test("debug - check URL and content after /dashboard navigation", async ({ page }) => {
  await page.goto("/dashboard", { waitUntil: "networkidle" });
  const url = page.url();
  const h1s = await page.locator("h1").allTextContents();
  const bodyText = await page.locator("body").textContent() ?? "";
  console.log("URL:", url);
  console.log("H1s:", h1s);
  console.log("Body (first 500):", bodyText.slice(0, 500));
  console.log("Has 'Dashboard':", bodyText.includes("Dashboard"));
  console.log("Has 'Sign in':", bodyText.includes("Sign in") || bodyText.includes("login"));
  // Just log, don't assert
  expect(url).toBeTruthy();
});
