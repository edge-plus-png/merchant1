import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:3100";
const demoMode = process.env.PORTAL_DEMO_MODE ?? "true";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command:
      `PORTAL_DEMO_MODE=${demoMode} npm run dev -- --hostname 127.0.0.1 --port 3100`,
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
