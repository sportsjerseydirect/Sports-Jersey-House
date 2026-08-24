import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.SJH_BASE_URL ?? "https://sports-jersey-house.vercel.app";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  outputDir: "test-results",
  timeout: 180_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    ignoreHTTPSErrors: false
  },
  projects: [
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(process.env.PW_USE_SYSTEM_CHROME === "1" ? { channel: "chrome" as const } : {})
      }
    },
    {
      name: "mobile-chromium",
      use: {
        ...devices["Pixel 7"],
        ...(process.env.PW_USE_SYSTEM_CHROME === "1" ? { channel: "chrome" as const } : {})
      }
    }
  ]
});
