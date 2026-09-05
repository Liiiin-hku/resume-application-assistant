import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ["list"],
    ["json", { outputFile: "artifacts/e2e-results.json" }],
    ["html", { outputFolder: "artifacts/playwright-report", open: "never" }],
  ],
  outputDir: "artifacts/test-results",
  webServer: {
    command: "node scripts/server.mjs",
    url: "http://127.0.0.1:4173/native.html",
    reuseExistingServer: false,
  },
  use: { trace: "retain-on-failure", screenshot: "only-on-failure" },
});
