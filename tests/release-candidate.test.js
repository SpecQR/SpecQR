import test from "node:test";
import assert from "node:assert/strict";
import {
  appendGtinCheckDigit,
  createGs1DigitalLink,
  createGs1ElementString,
  DataTooLongError,
  generate,
  InvalidColorError,
  InvalidEciError,
  InvalidGs1Error,
  InvalidInputError,
  InvalidModeError,
  InvalidOutputError,
  InvalidVersionError,
  mergeStructuredAppendParts,
  normalizeGs1DigitalLink,
  parseGs1DigitalLink,
  parseGs1ElementString,
  parseGs1HumanReadable,
  QRCode
} from "../src/index.js";
import { toBlob } from "../src/browser.js";
import { toPngBuffer } from "../src/node.js";

test("stable release public API examples execute", () => {
  const svg = QRCode.generate("https://example.com", {
    errorCorrectionLevel: "M",
    output: "svg"
  });
  assert.match(svg, /^<svg /);

  const pngDataUrl = QRCode.generate("https://example.com", {
    output: "png-data-url"
  });
  assert.match(pngDataUrl, /^data:image\/png;base64,/);

  const diagnosticResult = QRCode.generate("hello", {
    output: "matrix",
    diagnostics: true
  });
  assert.ok(Array.isArray(diagnosticResult.matrix));
  assert.equal(typeof diagnosticResult.diagnostics.version, "number");

  const gtin = appendGtinCheckDigit("0491234567890");
  const gs1Elements = parseGs1HumanReadable(`(01)${gtin}(10)ABC123(17)251231`);
  const gs1Data = createGs1ElementString(gs1Elements);
  assert.equal(
    createGs1DigitalLink(gs1Elements, { baseUrl: "https://example.com/" }),
    `https://example.com/01/${gtin}/10/ABC123?17=251231`
  );
  assert.equal(
    normalizeGs1DigitalLink(`https://example.com/01/${gtin}?17=251231&10=ABC123`),
    `https://example.com/01/${gtin}/10/ABC123?17=251231`
  );
  assert.deepEqual(parseGs1DigitalLink(`https://example.com/01/${gtin}/10/ABC123?17=251231`), {
    elements: gs1Elements,
    primary: { ai: "01", value: gtin },
    pathElements: [
      { ai: "01", value: gtin },
      { ai: "10", value: "ABC123" }
    ],
    queryElements: [
      { ai: "17", value: "251231" }
    ],
    unknownQuery: []
  });
  const gs1Result = QRCode.generate(gs1Data, {
    gs1: true,
    output: "matrix",
    diagnostics: true
  });
  assert.equal(gs1Result.diagnostics.gs1, true);
  assert.deepEqual(parseGs1ElementString(gs1Data), {
    elements: gs1Elements,
    hasSeparators: true
  });
  assert.deepEqual(QRCode.parseGs1ElementString("010491234567890417251231"), {
    elements: [
      { ai: "01", value: "04912345678904" },
      { ai: "17", value: "251231" }
    ],
    hasSeparators: false
  });
  assert.equal(
    mergeStructuredAppendParts([
      { index: 2, total: 2, parity: 65, data: "AAAAAAAAAA" },
      { index: 1, total: 2, parity: 65, data: "A".repeat(21) }
    ]).data,
    "A".repeat(31)
  );

  const binary = QRCode.generate(new Uint8Array([0x00, 0x01, 0x02, 0xFF]), {
    output: "matrix",
    diagnostics: true
  });
  assert.equal(binary.diagnostics.inputBytes, 4);

  const segmented = QRCode.generateSegments([
    { mode: "alphanumeric", data: "ORDER-" },
    { mode: "numeric", data: "1234567890" },
    { mode: "kanji", data: "こんにちは" }
  ], {
    output: "svg"
  });
  assert.match(segmented, /^<svg /);
});

test("stable release subpath helpers execute without pulling runtime dependencies", async () => {
  const buffer = toPngBuffer("https://example.com");
  assert.ok(Buffer.isBuffer(buffer));
  assert.deepEqual(Array.from(buffer.subarray(0, 8)), [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  const blob = toBlob("https://example.com");
  assert.equal(blob.type, "image/png");
  assert.deepEqual(Array.from(new Uint8Array(await blob.arrayBuffer()).slice(0, 8)), [
    0x89,
    0x50,
    0x4E,
    0x47,
    0x0D,
    0x0A,
    0x1A,
    0x0A
  ]);
});

test("stable release invalid options fail with stable error classes", () => {
  assert.throws(
    () => generate("HELLO", { version: 0 }),
    (error) => error instanceof InvalidVersionError && error.code === "INVALID_VERSION"
  );
  assert.throws(
    () => generate("HELLO", { mode: "latin1" }),
    (error) => error instanceof InvalidModeError && error.code === "INVALID_MODE"
  );
  assert.throws(
    () => generate("HELLO", { output: "pdf" }),
    (error) => error instanceof InvalidOutputError && error.code === "INVALID_OUTPUT"
  );
  assert.throws(
    () => generate("HELLO", { eci: 1000000 }),
    (error) => error instanceof InvalidEciError && error.code === "INVALID_ECI"
  );
  assert.throws(
    () => generate("HELLO", { gs1: "yes" }),
    (error) => error instanceof InvalidGs1Error && error.code === "INVALID_GS1"
  );
  assert.throws(
    () => generate("HELLO", { scale: 0 }),
    (error) => error instanceof InvalidInputError && error.code === "INVALID_INPUT"
  );
  assert.throws(
    () => generate("a".repeat(100), { version: 1, errorCorrectionLevel: "H", mode: "byte" }),
    (error) => error instanceof DataTooLongError && error.code === "DATA_TOO_LONG"
  );
});

test("stable release color and transparency behavior is explicit", () => {
  assert.throws(
    () => generate("HELLO", { output: "png", foreground: "not-a-color" }),
    (error) => error instanceof InvalidColorError && error.code === "INVALID_COLOR"
  );

  const result = generate("HELLO", {
    output: "matrix",
    diagnostics: true,
    background: "transparent"
  });

  assert.equal(result.diagnostics.colors.backgroundAlpha, 0);
  assert.ok(result.diagnostics.warnings.some((warning) => warning.code === "COLOR_ALPHA_USED"));
  assert.ok(result.diagnostics.warnings.some((warning) => warning.code === "SCAN_RISK"));
});
