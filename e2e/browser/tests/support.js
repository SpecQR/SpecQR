import { test as base, expect } from "@playwright/test";

export const test = base.extend({
  engineVersion: [
    async ({ browser, browserName }, use) => {
      const version = browser.version();
      console.log(`browser-engine ${browserName} ${version}`);
      await use(version);
    },
    { auto: true, scope: "worker" }
  ],
  page: async ({ page }, use) => {
    const failures = [];

    await page.addInitScript(() => {
      globalThis.addEventListener("unhandledrejection", (event) => {
        const reason = event.reason instanceof Error
          ? `${event.reason.name}: ${event.reason.message}`
          : String(event.reason);
        console.error(`unhandledrejection: ${reason}`);
      });
    });

    page.on("console", (message) => {
      if (message.type() === "error") {
        failures.push(`console.error: ${message.text()}`);
      }
    });
    page.on("pageerror", (error) => {
      failures.push(`pageerror: ${error.message}`);
    });
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (
        ["http:", "https:"].includes(url.protocol) &&
        !["127.0.0.1", "localhost"].includes(url.hostname)
      ) {
        failures.push(`external request: ${request.method()} ${request.url()}`);
      }
    });
    page.on("requestfailed", (request) => {
      const url = new URL(request.url());
      if (["127.0.0.1", "localhost"].includes(url.hostname)) {
        failures.push(
          `failed local request: ${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}`
        );
      }
    });
    page.on("response", (response) => {
      const url = new URL(response.url());
      if (
        ["127.0.0.1", "localhost"].includes(url.hostname) &&
        response.status() >= 400
      ) {
        failures.push(`local HTTP ${response.status()}: ${response.url()}`);
      }
    });

    await use(page);
    expect(failures, "browser runtime failures").toEqual([]);
  }
});

export { expect };

export async function openPackedFixture(page) {
  const response = await page.goto("/packed/");
  expect(response?.status()).toBe(200);
  expect(response?.headers()["x-specqr-fixture"]).toBe("packed-fixture");
  await expect
    .poll(() => page.evaluate(() => globalThis.__specqrReady === true))
    .toBe(true);
}

export async function openBuiltPlayground(page) {
  const response = await page.goto("/pages/playground/");
  expect(response?.status()).toBe(200);
  expect(response?.headers()["x-specqr-fixture"]).toBe("built-pages");
  await expect(page.getByTestId("qr-preview").locator("svg")).toHaveCount(1);
  const resourcePaths = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .map((entry) => new URL(entry.name).pathname)
      .filter((pathname) => pathname.endsWith(".js"))
  );
  expect(resourcePaths.length).toBeGreaterThan(0);
  expect(resourcePaths.every((pathname) => pathname.startsWith("/pages/")))
    .toBe(true);
}

export function definitionValue(list, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return list
    .locator("dt")
    .filter({ hasText: new RegExp(`^${escaped}$`) })
    .locator("xpath=following-sibling::dd[1]");
}

export async function readDownloadBytes(download) {
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
