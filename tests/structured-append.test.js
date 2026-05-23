import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DataTooLongError,
  generate,
  generateStructuredAppend,
  generateSegments,
  InvalidGs1Error,
  InvalidInputError,
  InvalidModeError
} from "../src/index.js";
import { QRCode } from "../src/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const highLevelFixtures = JSON.parse(
  readFileSync(path.join(root, "fixtures", "structured-append-high-level.json"), "utf8")
);

function matrixRows(result) {
  return result.matrix.map((row) => row.map((module) => module ? "1" : "0").join(""));
}

function matrixHash(matrix) {
  return createHash("sha256").update(matrixRows({ matrix }).join("\n")).digest("hex");
}

function countDarkModules(matrix) {
  return matrix.reduce((total, row) => total + row.filter(Boolean).length, 0);
}

function xorBytes(bytes) {
  return Array.from(bytes).reduce((parity, byte) => parity ^ byte, 0);
}

test("structuredAppend option encodes low-level Structured Append diagnostics", () => {
  const result = generate("HELLO", {
    structuredAppend: { index: 2, total: 5, parity: 0xa7 },
    mode: "alphanumeric",
    version: 1,
    errorCorrectionLevel: "M",
    maskPattern: 0,
    output: "matrix",
    diagnostics: true
  });

  assert.deepEqual(result.diagnostics.structuredAppend, {
    enabled: true,
    index: 2,
    total: 5,
    parity: 0xa7,
    sequenceIndex: 1,
    sequenceTotal: 4,
    sequenceIndicator: 0x14
  });
  assert.equal(result.diagnostics.fnc1, null);
  assert.equal(result.diagnostics.gs1, false);
  assert.equal(result.diagnostics.eciAssignmentNumber, null);
  assert.deepEqual(result.diagnostics.controlSegments, [
    {
      mode: "structured-append",
      index: 2,
      total: 5,
      parity: 0xa7,
      sequenceIndex: 1,
      sequenceTotal: 4,
      sequenceIndicator: 0x14
    }
  ]);
  assert.deepEqual(
    result.diagnostics.segments.map((segment) => segment.mode),
    ["structured-append", "alphanumeric"]
  );
  assert.deepEqual(
    result.diagnostics.segments.map((segment) => segment.bitLength),
    [20, 41]
  );
  assert.equal(result.diagnostics.dataBitLength, 61);
});

test("manual structured-append segment and option have matching bit accounting and matrix output", () => {
  const options = {
    version: 1,
    errorCorrectionLevel: "M",
    maskPattern: 2,
    output: "matrix",
    diagnostics: true
  };
  const withOption = generate("HELLO", {
    ...options,
    mode: "alphanumeric",
    structuredAppend: { index: 2, total: 5, parity: 0xa7 }
  });
  const withManual = generateSegments([
    { mode: "structured-append", index: 2, total: 5, parity: 0xa7 },
    { mode: "alphanumeric", data: "HELLO" }
  ], options);

  assert.equal(withManual.diagnostics.dataBitLength, withOption.diagnostics.dataBitLength);
  assert.deepEqual(withManual.diagnostics.segments, withOption.diagnostics.segments);
  assert.deepEqual(withManual.diagnostics.controlSegments, withOption.diagnostics.controlSegments);
  assert.deepEqual(matrixRows(withManual), matrixRows(withOption));
});

test("structuredAppend rejects invalid header values", () => {
  const invalidValues = [
    null,
    true,
    {},
    { index: 0, total: 2, parity: 0 },
    { index: 3, total: 2, parity: 0 },
    { index: 1, total: 1, parity: 0 },
    { index: 1, total: 17, parity: 0 },
    { index: 1.5, total: 2, parity: 0 },
    { index: 1, total: 2, parity: -1 },
    { index: 1, total: 2, parity: 256 },
    { index: 1, total: 2, parity: 1.5 }
  ];

  for (const structuredAppend of invalidValues) {
    assert.throws(
      () => generate("ABC", { structuredAppend }),
      (error) => error instanceof InvalidModeError
    );
  }

  assert.throws(
    () => generateSegments([
      { mode: "structured-append", index: 1, total: 17, parity: 0 },
      { mode: "byte", data: "ABC" }
    ]),
    (error) => error instanceof InvalidModeError &&
      /segments\[0\]\.total must be an integer from 2 to 16/.test(error.message)
  );
});

test("generateStructuredAppend splits string input with matching parity and diagnostics", () => {
  const input = "A".repeat(31);
  const result = generateStructuredAppend(input, {
    version: 1,
    errorCorrectionLevel: "L",
    mode: "alphanumeric",
    output: "matrix",
    diagnostics: true
  });

  assert.equal(result.total, 2);
  assert.equal(result.parity, xorBytes(new TextEncoder().encode(input)));
  assert.equal(result.inputLength, 31);
  assert.equal(result.byteLength, 31);
  assert.equal(result.diagnostics.version, 1);
  assert.equal(result.diagnostics.errorCorrectionLevel, "L");
  assert.equal(result.diagnostics.versionSelection, "fixed");
  assert.equal(result.diagnostics.splitStrategy, "greedy-largest-fitting");
  assert.deepEqual(
    result.diagnostics.symbols.map((symbol) => symbol.inputLength),
    [21, 10]
  );
  assert.deepEqual(
    result.symbols.map((symbol) => symbol.diagnostics.structuredAppend),
    [
      {
        enabled: true,
        index: 1,
        total: 2,
        parity: result.parity,
        sequenceIndex: 0,
        sequenceTotal: 1,
        sequenceIndicator: 0x01
      },
      {
        enabled: true,
        index: 2,
        total: 2,
        parity: result.parity,
        sequenceIndex: 1,
        sequenceTotal: 1,
        sequenceIndicator: 0x11
      }
    ]
  );
  assert.ok(result.diagnostics.warnings.some((warning) => warning.code === "STRUCTURED_APPEND_DECODER_SUPPORT_VARIES"));
});

test("QRCode.generateStructuredAppend static API returns normal output shapes", () => {
  const svg = QRCode.generateStructuredAppend("A".repeat(31), {
    version: 1,
    errorCorrectionLevel: "L",
    mode: "alphanumeric",
    output: "svg"
  });
  assert.equal(svg.total, 2);
  assert.equal(typeof svg.symbols[0], "string");
  assert.match(svg.symbols[0], /^<svg /);
  assert.equal(svg.diagnostics.symbols[0].version, 1);

  const png = QRCode.generateStructuredAppend("A".repeat(31), {
    version: 1,
    errorCorrectionLevel: "L",
    mode: "alphanumeric",
    output: "png"
  });
  assert.equal(png.total, 2);
  assert.ok(png.symbols[0] instanceof Uint8Array);
  assert.deepEqual(Array.from(png.symbols[0].slice(0, 8)), [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
});

test("generateStructuredAppend splits binary ArrayBufferView input with offset-aware parity", () => {
  const payload = Uint8Array.from(Array.from({ length: 31 }, (_, index) => index === 0 ? 0x00 : index === 30 ? 0xff : index));
  const backing = Uint8Array.from([0xaa, ...payload, 0xbb]);
  const view = new Uint8Array(backing.buffer, 1, payload.length);
  const result = generateStructuredAppend(view, {
    version: 1,
    errorCorrectionLevel: "L",
    mode: "byte",
    output: "matrix",
    diagnostics: true
  });

  assert.equal(result.total, 3);
  assert.equal(result.parity, xorBytes(payload));
  assert.equal(result.inputLength, payload.length);
  assert.equal(result.byteLength, payload.length);
  assert.deepEqual(
    result.diagnostics.symbols.map((symbol) => ({
      inputStart: symbol.inputStart,
      inputLength: symbol.inputLength,
      byteStart: symbol.byteStart,
      byteLength: symbol.byteLength,
      index: symbol.index,
      total: symbol.total,
      parity: symbol.parity
    })),
    [
      { inputStart: 0, inputLength: 15, byteStart: 0, byteLength: 15, index: 1, total: 3, parity: result.parity },
      { inputStart: 15, inputLength: 15, byteStart: 15, byteLength: 15, index: 2, total: 3, parity: result.parity },
      { inputStart: 30, inputLength: 1, byteStart: 30, byteLength: 1, index: 3, total: 3, parity: result.parity }
    ]
  );

  const arrayBufferResult = generateStructuredAppend(payload.buffer, {
    version: 1,
    errorCorrectionLevel: "L",
    mode: "byte",
    output: "matrix"
  });
  assert.equal(arrayBufferResult.total, 3);
  assert.equal(arrayBufferResult.parity, xorBytes(payload));
  assert.equal(arrayBufferResult.byteLength, payload.length);
});

test("generateStructuredAppend auto version chooses the smallest common split version", () => {
  const result = generateStructuredAppend("A".repeat(31), {
    errorCorrectionLevel: "L",
    mode: "alphanumeric",
    output: "matrix"
  });

  assert.equal(result.total, 2);
  assert.equal(result.diagnostics.version, 1);
  assert.equal(result.diagnostics.versionSelection, "auto-minimum");
});

test("generateStructuredAppend warns when it uses maxSymbols", () => {
  const result = generateStructuredAppend(Uint8Array.from({ length: 31 }, (_, index) => index), {
    version: 1,
    errorCorrectionLevel: "L",
    mode: "byte",
    output: "matrix",
    maxSymbols: 3
  });

  assert.equal(result.total, 3);
  assert.ok(result.diagnostics.warnings.some((warning) => warning.code === "STRUCTURED_APPEND_MAX_SYMBOLS_NEAR_LIMIT"));
});

test("generateStructuredAppend rejects invalid, single-symbol, too-long, and incompatible inputs", () => {
  for (const maxSymbols of [1, 17, 2.5]) {
    assert.throws(
      () => generateStructuredAppend("A".repeat(31), { maxSymbols }),
      (error) => error instanceof InvalidModeError && /maxSymbols/.test(error.message)
    );
  }

  assert.throws(
    () => generateStructuredAppend("HELLO", { version: 1, mode: "alphanumeric" }),
    (error) => error instanceof InvalidInputError && /fits in one/.test(error.message)
  );
  assert.throws(
    () => generateStructuredAppend("", { version: 1 }),
    (error) => error instanceof InvalidInputError && /at least two/.test(error.message)
  );
  assert.throws(
    () => generateStructuredAppend(Uint8Array.from({ length: 31 }, (_, index) => index), {
      version: 1,
      errorCorrectionLevel: "L",
      mode: "byte",
      maxSymbols: 2
    }),
    (error) => error instanceof DataTooLongError && /2 or fewer/.test(error.message)
  );
  assert.throws(
    () => generateStructuredAppend("A".repeat(31), { eci: true }),
    (error) => error instanceof InvalidModeError && /ECI/.test(error.message)
  );
  assert.throws(
    () => generateStructuredAppend("0104912345678904", { gs1: true }),
    (error) => error instanceof InvalidGs1Error && /gs1/.test(error.message)
  );
  assert.throws(
    () => generateStructuredAppend("A".repeat(31), { fnc1Second: "37" }),
    (error) => error instanceof InvalidModeError && /FNC1 second/.test(error.message)
  );
  assert.throws(
    () => generateStructuredAppend("A".repeat(31), { structuredAppend: { index: 1, total: 2, parity: 0 } }),
    (error) => error instanceof InvalidModeError && /structuredAppend option/.test(error.message)
  );
  assert.throws(
    () => generateStructuredAppend("A".repeat(31), { parity: 0 }),
    (error) => error instanceof InvalidModeError && /parity override/.test(error.message)
  );
  assert.throws(
    () => generateStructuredAppend("A".repeat(31), { errorCorrection: "L" }),
    (error) => error instanceof InvalidModeError && /errorCorrectionLevel/.test(error.message)
  );
  assert.throws(
    () => generateStructuredAppend("A".repeat(31), { mask: 0 }),
    (error) => error instanceof InvalidModeError && /maskPattern/.test(error.message)
  );
  assert.throws(
    () => generateStructuredAppend("A".repeat(31), { boostErrorCorrection: true }),
    (error) => error instanceof InvalidModeError && /boostErrorCorrection/.test(error.message)
  );
});

for (const fixture of highLevelFixtures) {
  test(`generateStructuredAppend golden fixture: ${fixture.id}`, () => {
    const result = generateStructuredAppend(fixture.input, {
      ...fixture.options,
      diagnostics: true
    });

    assert.equal(result.total, fixture.expected.total);
    assert.equal(result.parity, fixture.expected.parity);
    assert.equal(result.inputLength, fixture.expected.inputLength);
    assert.equal(result.byteLength, fixture.expected.byteLength);
    assert.deepEqual(
      result.diagnostics.symbols.map((symbol) => ({
        index: symbol.index,
        total: symbol.total,
        parity: symbol.parity,
        sequenceIndex: symbol.sequenceIndex,
        sequenceTotal: symbol.sequenceTotal,
        sequenceIndicator: symbol.sequenceIndicator,
        inputStart: symbol.inputStart,
        inputLength: symbol.inputLength,
        byteStart: symbol.byteStart,
        byteLength: symbol.byteLength,
        version: symbol.version,
        errorCorrectionLevel: symbol.errorCorrectionLevel,
        dataBitLength: symbol.dataBitLength,
        capacityBits: symbol.capacityBits,
        remainingBits: symbol.remainingBits,
        maskPattern: symbol.maskPattern
      })),
      fixture.expected.chunks.map(({ matrixSha256, darkModules, ...chunk }) => chunk)
    );
    assert.deepEqual(
      result.symbols.map((symbol) => matrixHash(symbol.matrix)),
      fixture.expected.chunks.map((chunk) => chunk.matrixSha256)
    );
    assert.deepEqual(
      result.symbols.map((symbol) => countDarkModules(symbol.matrix)),
      fixture.expected.chunks.map((chunk) => chunk.darkModules)
    );
  });
}

test("structuredAppend rejects unsafe control mode combinations", () => {
  assert.throws(
    () => generate("ABC", { gs1: true, structuredAppend: { index: 1, total: 2, parity: 0 } }),
    (error) => error instanceof InvalidGs1Error &&
      /structuredAppend and gs1 cannot be combined/.test(error.message)
  );
  assert.throws(
    () => generate("ABC", { eci: true, structuredAppend: { index: 1, total: 2, parity: 0 } }),
    (error) => error instanceof InvalidModeError &&
      /structuredAppend and eci cannot be combined/.test(error.message)
  );
  assert.throws(
    () => generate("ABC", { fnc1Second: "37", structuredAppend: { index: 1, total: 2, parity: 0 } }),
    (error) => error instanceof InvalidModeError &&
      /structuredAppend and fnc1Second cannot be combined/.test(error.message)
  );
  assert.throws(
    () => generateSegments([
      { mode: "structured-append", index: 1, total: 2, parity: 0 },
      { mode: "byte", data: "ABC" }
    ], { gs1: true }),
    (error) => error instanceof InvalidGs1Error &&
      /FNC1 first position cannot be combined with Structured Append/.test(error.message)
  );
  assert.throws(
    () => generateSegments([
      { mode: "structured-append", index: 1, total: 2, parity: 0 },
      { mode: "byte", data: "ABC" }
    ], { eci: true }),
    (error) => error instanceof InvalidModeError &&
      /ECI cannot be combined with Structured Append/.test(error.message)
  );
  assert.throws(
    () => generateSegments([
      { mode: "structured-append", index: 1, total: 2, parity: 0 },
      { mode: "byte", data: "ABC" }
    ], { fnc1Second: "37" }),
    (error) => error instanceof InvalidModeError &&
      /FNC1 second position cannot be combined with Structured Append/.test(error.message)
  );
});
