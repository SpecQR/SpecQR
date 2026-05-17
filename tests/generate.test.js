import test from "node:test";
import assert from "node:assert/strict";
import { QRCode, generate } from "../src/index.js";

test("generates a version 1 matrix for small byte-mode text", () => {
  const result = generate("HELLO", {
    errorCorrectionLevel: "M",
    output: "matrix",
    diagnostics: true
  });

  assert.equal(result.diagnostics.version, 1);
  assert.equal(result.diagnostics.size, 21);
  assert.equal(result.matrix.length, 21);
  assert.equal(result.matrix[0].length, 21);
  assert.equal(typeof result.diagnostics.maskPattern, "number");
  assert.equal(result.diagnostics.versionSelection, "auto-minimum");
  assert.ok(result.diagnostics.dataBitLength <= result.diagnostics.capacityBits);
  assert.equal(
    result.diagnostics.remainingBits,
    result.diagnostics.capacityBits - result.diagnostics.dataBitLength
  );
});

test("generates SVG with quiet zone and module dimensions", () => {
  const svg = QRCode.generate("https://example.com", {
    errorCorrectionLevel: "M",
    output: "svg",
    margin: 4,
    scale: 8
  });

  assert.match(svg, /^<svg /);
  assert.match(svg, /width="264"/);
  assert.match(svg, /height="264"/);
  assert.match(svg, /<path fill="#000000"/);
});

test("generates SVG and PNG data URLs", () => {
  const svgDataUrl = QRCode.generate("HELLO", {
    output: "svg-data-url"
  });
  const pngDataUrl = QRCode.generate("HELLO", {
    output: "png-data-url"
  });

  assert.match(svgDataUrl, /^data:image\/svg\+xml;charset=utf-8,/);
  assert.match(pngDataUrl, /^data:image\/png;base64,/);
});

test("generates PNG bytes with expected dimensions", () => {
  const png = QRCode.generate("HELLO", {
    output: "png",
    margin: 4,
    scale: 8
  });

  assert.ok(png instanceof Uint8Array);
  assert.deepEqual(Array.from(png.slice(0, 8)), [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  assert.equal(readUint32(png, 16), 232);
  assert.equal(readUint32(png, 20), 232);
  assert.equal(png[25], 6);
});

test("auto mode can use QR kanji mode for Shift_JIS-compatible Japanese input", () => {
  const result = generate("こんにちは", {
    output: "matrix",
    diagnostics: true
  });

  assert.equal(result.diagnostics.mode, "kanji");
  assert.equal(result.diagnostics.inputBytes, 15);
  assert.equal(result.matrix.length, result.diagnostics.size);
});

test("explicit byte mode preserves UTF-8 byte encoding", () => {
  const result = generate("こんにちは", {
    mode: "byte",
    output: "matrix",
    diagnostics: true
  });

  assert.equal(result.diagnostics.mode, "byte");
  assert.equal(result.diagnostics.segments[0].byteCount, 15);
});

test("auto mode uses numeric mode for digit-only input", () => {
  const numeric = generate("1234567890123456789012345678901234567890", {
    output: "matrix",
    diagnostics: true
  });
  const byte = generate("1234567890123456789012345678901234567890", {
    mode: "byte",
    output: "matrix",
    diagnostics: true
  });

  assert.equal(numeric.diagnostics.mode, "numeric");
  assert.ok(numeric.diagnostics.version < byte.diagnostics.version);
});

test("auto mode uses alphanumeric mode for QR alphanumeric input", () => {
  const result = generate("HELLO WORLD 123", {
    output: "matrix",
    diagnostics: true
  });

  assert.equal(result.diagnostics.mode, "alphanumeric");
  assert.equal(result.diagnostics.segments.length, 1);
});

test("auto mode optimizes mixed input into multiple segments", () => {
  const optimized = generate("abc123456789012345678901234567890def", {
    output: "matrix",
    diagnostics: true
  });
  const byteOnly = generate("abc123456789012345678901234567890def", {
    mode: "byte",
    output: "matrix",
    diagnostics: true
  });

  assert.equal(optimized.diagnostics.mode, "mixed");
  assert.deepEqual(
    optimized.diagnostics.segments.map((segment) => segment.mode),
    ["byte", "numeric", "byte"]
  );
  assert.ok(optimized.diagnostics.dataBitLength < byteOnly.diagnostics.dataBitLength);
});

test("can boost error correction without increasing version", () => {
  const result = generate("HELLO", {
    errorCorrectionLevel: "L",
    boostErrorCorrection: true,
    output: "matrix",
    diagnostics: true
  });

  assert.equal(result.diagnostics.version, 1);
  assert.equal(result.diagnostics.requestedErrorCorrectionLevel, "L");
  assert.equal(result.diagnostics.errorCorrectionLevel, "H");
  assert.equal(result.diagnostics.boostedErrorCorrection, true);
});

test("does not boost error correction when data would no longer fit", () => {
  const result = generate("a".repeat(14), {
    version: 1,
    errorCorrectionLevel: "M",
    boostErrorCorrection: true,
    output: "matrix",
    diagnostics: true
  });

  assert.equal(result.diagnostics.version, 1);
  assert.equal(result.diagnostics.errorCorrectionLevel, "M");
  assert.equal(result.diagnostics.boostedErrorCorrection, false);
});

test("can include UTF-8 ECI metadata", () => {
  const result = generate("こんにちは", {
    eci: true,
    output: "matrix",
    diagnostics: true
  });

  assert.equal(result.diagnostics.eciAssignmentNumber, 26);
  assert.deepEqual(
    result.diagnostics.segments.map((segment) => segment.mode),
    ["eci", "byte"]
  );
  assert.equal(result.diagnostics.segments[0].bitLength, 12);
});

test("can include an explicit ECI assignment number", () => {
  const result = generate("A", {
    mode: "byte",
    eci: 300,
    output: "matrix",
    diagnostics: true
  });

  assert.equal(result.diagnostics.eciAssignmentNumber, 300);
  assert.equal(result.diagnostics.segments[0].bitLength, 20);
});

test("rejects data that does not fit a fixed version", () => {
  assert.throws(
    () => generate("a".repeat(100), { version: 1, errorCorrectionLevel: "H" }),
    /requires .* bits/
  );
});

test("can generate a large version 40 symbol", () => {
  const result = generate("a".repeat(1200), {
    version: 40,
    errorCorrectionLevel: "H",
    output: "matrix",
    diagnostics: true
  });

  assert.equal(result.diagnostics.version, 40);
  assert.equal(result.matrix.length, 177);
  assert.equal(result.matrix[176].length, 177);
});

test("draws version 7 alignment patterns that overlap timing rows and columns", () => {
  const matrix = generate("Version 7", {
    version: 7,
    errorCorrectionLevel: "L",
    maskPattern: 0,
    output: "matrix"
  });

  assertAlignmentPattern(matrix, 6, 22);
  assertAlignmentPattern(matrix, 22, 6);
});

function assertAlignmentPattern(matrix, centerX, centerY) {
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      const distance = Math.max(Math.abs(dx), Math.abs(dy));
      assert.equal(matrix[centerY + dy][centerX + dx], distance !== 1);
    }
  }
}

function readUint32(bytes, offset) {
  return (
    (bytes[offset] << 24) |
    (bytes[offset + 1] << 16) |
    (bytes[offset + 2] << 8) |
    bytes[offset + 3]
  ) >>> 0;
}
