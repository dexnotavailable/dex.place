import { defineConfig, devices } from "@playwright/test";

const bravePath =
  process.env.DEX_BROWSER_PATH ??
  "C:\\Users\\sanic\\AppData\\Local\\BraveSoftware\\Brave-Browser\\Application\\brave.exe";

export default defineConfig({
  testDir: "./tests",
  outputDir: "./test-results/playwright",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { outputFolder: "test-results/report", open: "never" }]],
  timeout: 45_000,
  expect: {
    timeout: 8_000,
    toHaveScreenshot: {
      animations: "disabled",
      maxDiffPixelRatio: 0.035,
    },
  },
  use: {
    baseURL: "http://127.0.0.1:4173",
    browserName: "chromium",
    colorScheme: "dark",
    launchOptions: { executablePath: bravePath },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "off",
  },
  webServer: {
    command: "pnpm dev -- --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    {
      name: "desktop-brave",
      use: { viewport: { width: 1487, height: 1058 } },
    },
    {
      name: "mobile-brave",
      use: { ...devices["iPhone 13"], viewport: { width: 390, height: 844 } },
    },
  ],
});
