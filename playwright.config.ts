import { defineConfig, devices } from "@playwright/test";
import { STORAGE_STATE } from "./tests/auth-setup";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false, // Sequential so auth.json is written before tests use it
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  reporter: "html",

  globalSetup: "./tests/auth-setup",

  use: {
    baseURL: "http://localhost:3000",
    storageState: STORAGE_STATE,
    trace: "on-first-retry",
    // Generous timeout for dev server routes
    navigationTimeout: 20_000,
    actionTimeout: 10_000,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command: "cd main-project/frontend && npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
