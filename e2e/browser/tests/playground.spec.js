import {
  definitionValue,
  expect,
  openBuiltPlayground,
  readDownloadBytes,
  test
} from "./support.js";

test.beforeEach(async ({ page }) => {
  await openBuiltPlayground(page);
});

test("Single QR updates preview, Planning, diagnostics, and PNG download", async ({ page }) => {
  await page.getByRole("textbox", { name: "入力" }).fill("PLAYWRIGHT-123");

  await expect(page.getByTestId("qr-preview").locator("svg")).toHaveCount(1);
  await expect(
    definitionValue(page.getByTestId("qr-planning"), "Status")
  ).toHaveText("ok");
  await expect(
    definitionValue(page.getByTestId("qr-diagnostics"), "Mode")
  ).toHaveText("Single QR");
  await expect(
    definitionValue(page.getByTestId("qr-diagnostics"), "Input kind")
  ).toHaveText("Text / URL");
  await expect(page.getByTestId("qr-error")).toBeHidden();

  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("download-png").click();
  const download = await downloadPromise;
  const bytes = await readDownloadBytes(download);
  expect(download.suggestedFilename()).toBe("specqr.png");
  expect(Array.from(bytes.subarray(0, 8))).toEqual([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
  ]);
});

test("fixed Version overflow exposes Planning failure without a preview", async ({ page }) => {
  await page.getByLabel("ECC").selectOption("H");
  await page.getByLabel("Version").selectOption("1");
  await page.getByRole("textbox", { name: "入力" }).fill("a".repeat(100));

  await expect(
    definitionValue(page.getByTestId("qr-planning"), "Status")
  ).toHaveText("data-too-long");
  await expect(
    definitionValue(page.getByTestId("qr-planning"), "Reason")
  ).toHaveText("data-too-long");
  await expect(
    definitionValue(page.getByTestId("qr-diagnostics"), "Status")
  ).toHaveText("data-too-long");
  await expect(page.getByTestId("qr-error")).toContainText(
    "Version 1-H の容量を"
  );
  await expect(page.getByTestId("qr-preview").locator("svg")).toHaveCount(0);
  await expect(page.getByTestId("download-png")).toHaveAttribute(
    "aria-disabled",
    "true"
  );
});

test("GS1 QR flow validates human-readable data and generates FNC1 first position", async ({ page }) => {
  await page.getByLabel("入力形式").selectOption("gs1");
  await page
    .getByRole("textbox", { name: "入力" })
    .fill("(01)04912345678904(17)251231(10)LOT-A");

  await expect(page.getByTestId("qr-preview").locator("svg")).toHaveCount(1);
  await expect(
    definitionValue(page.getByTestId("qr-planning"), "Status")
  ).toHaveText("ok");
  await expect(
    definitionValue(page.getByTestId("qr-diagnostics"), "Input kind")
  ).toHaveText("GS1 QR Code / FNC1 first");
  await expect(
    definitionValue(page.getByTestId("qr-diagnostics"), "GS1")
  ).toHaveText("yes");
  await expect(page.getByTestId("qr-error")).toBeHidden();
});

test("GS1 Digital Link flow reports normalization and unknown-query policy", async ({ page }) => {
  await page.getByLabel("入力形式").selectOption("digital-link");
  await page
    .getByRole("textbox", { name: "入力" })
    .fill(
      "https://example.com/01/04912345678904?17=251231&10=LOT-A&linkType=all"
    );

  await expect(
    definitionValue(
      page.getByTestId("qr-diagnostics"),
      "Digital Link validation"
    )
  ).toHaveText("ok");
  await expect(
    definitionValue(page.getByTestId("qr-diagnostics"), "Unknown query")
  ).toHaveText("1");
  await expect(
    definitionValue(page.getByTestId("qr-diagnostics"), "Normalized URI")
  ).toHaveText(
    "https://example.com/01/04912345678904/10/LOT-A?17=251231&linkType=all"
  );
  await expect(page.getByTestId("qr-warnings")).toContainText(
    "GS1_DIGITAL_LINK_UNKNOWN_QUERY_PRESERVED"
  );

  await page.getByLabel("Unknown query").selectOption("reject");
  await expect(page.getByTestId("qr-error")).toContainText(
    "GS1_DIGITAL_LINK_UNKNOWN_QUERY"
  );
  await expect(page.getByTestId("qr-preview").locator("svg")).toHaveCount(0);
});

test("Structured Append renders multiple symbols with usable PNG links", async ({ page }) => {
  await page.getByRole("textbox", { name: "入力" }).fill("A".repeat(31));
  await page.getByLabel("ECC").selectOption("L");
  await page.getByLabel("Version").selectOption("1");
  await page.getByLabel("生成").selectOption("structured");

  const cards = page.getByRole("article");
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0).getByRole("heading")).toHaveText("Symbol 1 / 2");
  await expect(cards.nth(1).getByRole("heading")).toHaveText("Symbol 2 / 2");
  await expect(
    definitionValue(page.getByTestId("qr-planning"), "Status")
  ).toHaveText("data-too-long");
  await expect(
    definitionValue(page.getByTestId("qr-diagnostics"), "Mode")
  ).toHaveText("Structured Append");
  await expect(
    definitionValue(page.getByTestId("qr-diagnostics"), "Symbols")
  ).toHaveText("2");
  await expect(
    definitionValue(
      page.getByTestId("qr-diagnostics"),
      "Manual split detail"
    )
  ).toHaveText("summary");
  await expect(
    definitionValue(
      page.getByTestId("qr-diagnostics"),
      "Manual split units"
    )
  ).toHaveText("31");
  await expect(
    definitionValue(
      page.getByTestId("qr-diagnostics"),
      "Materialized split units"
    )
  ).toHaveCount(0);

  await page.getByLabel("Manual split detail").selectOption("full");
  await expect(
    definitionValue(
      page.getByTestId("qr-diagnostics"),
      "Manual split detail"
    )
  ).toHaveText("full");
  await expect(
    definitionValue(
      page.getByTestId("qr-diagnostics"),
      "Materialized split units"
    )
  ).toHaveText("31");
  await expect(cards).toHaveCount(2);
  await expect(page.getByTestId("qr-warnings")).toContainText(
    "STRUCTURED_APPEND_DECODER_SUPPORT_VARIES"
  );
  await expect(page.getByTestId("qr-error")).toBeHidden();

  const pngLink = cards.nth(0).getByRole("link", { name: "PNG" });
  await expect(pngLink).toHaveAttribute(
    "download",
    "specqr-structured-1.png"
  );
  const png = await pngLink.evaluate(async (link) => {
    const response = await fetch(link.href);
    const bytes = new Uint8Array(await response.arrayBuffer());
    return {
      protocol: new URL(link.href).protocol,
      type: response.headers.get("content-type"),
      signature: Array.from(bytes.subarray(0, 8))
    };
  });
  expect(png.protocol).toBe("blob:");
  expect(png.type).toBe("image/png");
  expect(png.signature).toEqual([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
  ]);
});

test("Single QR print fit uses exact density and does not change preview or downloads", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.getByLabel("Version").selectOption("6");
  await page.getByText("印刷サイズを確認", { exact: true }).click();
  await expect(page.getByLabel("ドット数 / モジュール")).toHaveValue("4");

  const preview = page.getByTestId("qr-preview").locator("svg");
  const svg = await preview.evaluate(element => element.outerHTML);
  const pngHref = await page.getByTestId("download-png").getAttribute("href");
  const result = page.locator("#qr-print-result");

  await page.getByLabel("印刷可能幅 (mm)").fill("20.5");
  await page.getByLabel("ドット数 / モジュール").fill("5");
  await expect(result).toContainText("幅に収まりません。");
  await expect(result).toContainText("20.744 mm");
  await page.getByLabel("解像度の単位").selectOption("dots/mm");
  await page.getByLabel("解像度", { exact: true }).fill("12");
  await expect(result).toContainText("幅に収まります。");
  await expect(result).toContainText("20.417 mm");
  await expect(result).toContainText("245 ドット");
  expect(await preview.evaluate(element => element.outerHTML)).toBe(svg);
  await expect(page.getByTestId("download-png")).toHaveAttribute("href", pngHref);

  await page.getByLabel("Margin", { exact: true }).fill("5");
  await expect(result).toContainText("幅に収まりません。");
  await page.getByLabel("Margin", { exact: true }).fill("0");
  await expect(result).toContainText("余白を 4 に補っています");

  await page.getByRole("textbox", { name: "入力", exact: true }).fill("a".repeat(300));
  await expect(result).toHaveText("QR を生成すると、印刷サイズを確認できます。");
  await page.getByLabel("生成").selectOption("structured");
  await expect(page.locator("#qr-print-check")).toBeHidden();
  await page.getByLabel("生成").selectOption("single");
  await page.getByRole("textbox", { name: "入力", exact: true }).fill("test");
  await expect(result).toContainText("幅に収まります。");
});
