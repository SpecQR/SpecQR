import { defineConfig } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const baseURL = process.env.SPECQR_E2E_BASE_URL;

if (!baseURL) {
  throw new Error(
    "SPECQR_E2E_BASE_URL is not set. Run the suite with: npm run verify:browser:e2e"
  );
}

export default defineConfig({
  testDir: path.join(directory, "tests"),
  outputDir: path.join(directory, "test-results", "artifacts"),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  expect: {
    timeout: 5_000
  },
  forbidOnly: Boolean(process.env.CI),
  reporter: [
    ["list"],
    ["json", { outputFile: path.join(directory, "test-results", "results.json") }],
    ["html", { outputFolder: path.join(directory, "playwright-report"), open: "never" }]
  ],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    serviceWorkers: "block"
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "firefox", use: { browserName: "firefox" } },
    { name: "webkit", use: { browserName: "webkit" } }
  ]
});
