import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  calculateStructuredAppendParity,
  DataTooLongError,
  generate,
  generateSegmentsStructuredAppend,
  generateStructuredAppend,
  generateSegments,
  InvalidGs1Error,
  InvalidInputError,
  InvalidModeError,
  mergeStructuredAppendParts
} from "../src/index.js";
import { QRCode } from "../src/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const highLevelFixtures = JSON.parse(
  readFileSync(path.join(root, "fixtures", "structured-append-high-level.json"), "utf8")
);
const manualSegmentsFixtures = JSON.parse(
  readFileSync(path.join(root, "fixtures", "structured-append-segments.json"), "utf8")
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

function stringPartsFromStructuredAppend(result, input) {
  const characters = Array.from(input);
  return result.diagnostics.symbols.map((symbol) => ({
    index: symbol.index,
    total: symbol.total,
    parity: symbol.parity,
    data: characters.slice(symbol.inputStart, symbol.inputStart + symbol.inputLength).join("")
  }));
}

function binaryPartsFromStructuredAppend(result, bytes) {
  return result.diagnostics.symbols.map((symbol) => ({
    index: symbol.index,
    total: symbol.total,
    parity: symbol.parity,
    data: bytes.subarray(symbol.byteStart, symbol.byteStart + symbol.byteLength)
  }));
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

test("calculateStructuredAppendParity computes original payload byte XOR", () => {
  assert.equal(calculateStructuredAppendParity("ABC"), xorBytes(new TextEncoder().encode("ABC")));
  assert.equal(calculateStructuredAppendParity("こんにちは"), xorBytes(new TextEncoder().encode("こんにちは")));
  assert.equal(calculateStructuredAppendParity(""), 0);
  assert.equal(calculateStructuredAppendParity(Uint8Array.from([])), 0);

  const payload = Uint8Array.from([0x00, 0xff, 0x41, 0x7e]);
  assert.equal(calculateStructuredAppendParity(payload), xorBytes(payload));
  assert.equal(calculateStructuredAppendParity(payload.buffer), xorBytes(payload));
  assert.equal(calculateStructuredAppendParity([0x00, 0xff, 0x41, 0x7e]), xorBytes(payload));

  const backing = Uint8Array.from([0xaa, 0x10, 0x20, 0xbb]);
  assert.equal(calculateStructuredAppendParity(new Uint8Array(backing.buffer, 1, 2)), 0x10 ^ 0x20);
  assert.equal(calculateStructuredAppendParity(new DataView(backing.buffer, 1, 2)), 0x10 ^ 0x20);
  assert.equal(QRCode.calculateStructuredAppendParity(payload), xorBytes(payload));
});

test("calculateStructuredAppendParity rejects invalid input as InvalidInputError", () => {
  const invalidInputs = [
    null,
    undefined,
    true,
    {},
    () => {},
    [-1],
    [256],
    [1.5],
    [NaN],
    ["1"]
  ];

  for (const input of invalidInputs) {
    assert.throws(
      () => calculateStructuredAppendParity(input),
      (error) => error instanceof InvalidInputError
    );
  }
});

test("calculateStructuredAppendParity matches Structured Append generation and merge validation", () => {
  const input = "A".repeat(31);
  const generated = generateStructuredAppend(input, {
    version: 1,
    errorCorrectionLevel: "L",
    mode: "alphanumeric",
    output: "matrix",
    diagnostics: true
  });
  const parity = calculateStructuredAppendParity(input);
  const parts = stringPartsFromStructuredAppend(generated, input);
  const merged = mergeStructuredAppendParts(parts);

  assert.equal(generated.parity, parity);
  assert.equal(merged.parity, parity);
  assert.equal(merged.diagnostics.parityCheck.actual, parity);

  const payload = Uint8Array.from(Array.from({ length: 31 }, (_, index) => index));
  const binaryGenerated = generateStructuredAppend(payload, {
    version: 1,
    errorCorrectionLevel: "L",
    mode: "byte",
    output: "matrix",
    diagnostics: true
  });
  const binaryParts = binaryPartsFromStructuredAppend(binaryGenerated, payload);
  const binaryMerged = QRCode.mergeStructuredAppendParts(binaryParts);

  assert.equal(binaryGenerated.parity, calculateStructuredAppendParity(payload));
  assert.equal(binaryMerged.parity, calculateStructuredAppendParity(payload));
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

test("generateSegmentsStructuredAppend splits manual segments at segment boundaries", () => {
  const input = [
    { mode: "alphanumeric", data: "ABCDEFGHIJKLMNOPQRSTU" },
    { mode: "numeric", data: "12345678901234567890" },
    { mode: "byte", data: Uint8Array.from([0x00, 0x01, 0x02, 0xff]) }
  ];
  const result = generateSegmentsStructuredAppend(input, {
    version: 1,
    errorCorrectionLevel: "L",
    maskPattern: 0,
    output: "matrix",
    diagnostics: true
  });

  assert.equal(result.total, 2);
  assert.equal(result.parity, xorBytes([
    ...new TextEncoder().encode("ABCDEFGHIJKLMNOPQRSTU12345678901234567890"),
    0x00,
    0x01,
    0x02,
    0xff
  ]));
  assert.equal(result.inputLength, 3);
  assert.equal(result.byteLength, 45);
  assert.equal(result.diagnostics.version, 1);
  assert.equal(result.diagnostics.splitStrategy, "segment-boundary-byte-chunk");
  assert.deepEqual(
    result.symbols.map((symbol) => symbol.diagnostics.segments.map((segment) => segment.mode)),
    [
      ["structured-append", "alphanumeric"],
      ["structured-append", "numeric", "byte"]
    ]
  );
  assert.deepEqual(
    result.diagnostics.symbols.map((symbol) => ({
      index: symbol.index,
      total: symbol.total,
      parity: symbol.parity,
      sourceSegmentStart: symbol.sourceSegmentStart,
      sourceSegmentEnd: symbol.sourceSegmentEnd,
      splitUnitStart: symbol.splitUnitStart,
      splitUnitLength: symbol.splitUnitLength,
      byteStart: symbol.byteStart,
      byteLength: symbol.byteLength
    })),
    [
      {
        index: 1,
        total: 2,
        parity: result.parity,
        sourceSegmentStart: 0,
        sourceSegmentEnd: 1,
        splitUnitStart: 0,
        splitUnitLength: 1,
        byteStart: 0,
        byteLength: 21
      },
      {
        index: 2,
        total: 2,
        parity: result.parity,
        sourceSegmentStart: 1,
        sourceSegmentEnd: 3,
        splitUnitStart: 1,
        splitUnitLength: 5,
        byteStart: 21,
        byteLength: 24
      }
    ]
  );
});

test("QRCode.generateSegmentsStructuredAppend static API returns normal output shapes", () => {
  const segments = [
    { mode: "alphanumeric", data: "ABCDEFGHIJKLMNOPQRSTU" },
    { mode: "numeric", data: "12345678901234567890" }
  ];

  const svg = QRCode.generateSegmentsStructuredAppend(segments, {
    version: 1,
    errorCorrectionLevel: "L",
    output: "svg"
  });
  assert.equal(svg.total, 2);
  assert.equal(typeof svg.symbols[0], "string");
  assert.match(svg.symbols[0], /^<svg /);
  assert.equal(svg.diagnostics.symbols[0].version, 1);

  const png = QRCode.generateSegmentsStructuredAppend(segments, {
    version: 1,
    errorCorrectionLevel: "L",
    output: "png"
  });
  assert.equal(png.total, 2);
  assert.ok(png.symbols[0] instanceof Uint8Array);
  assert.deepEqual(Array.from(png.symbols[0].slice(0, 8)), [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
});

test("generateSegmentsStructuredAppend chunks byte binary data with offset-aware parity", () => {
  const payload = Uint8Array.from(Array.from({ length: 31 }, (_, index) => index === 0 ? 0x00 : index === 30 ? 0xff : index));
  const backing = Uint8Array.from([0xaa, ...payload, 0xbb]);
  const view = new Uint8Array(backing.buffer, 1, payload.length);
  const result = generateSegmentsStructuredAppend([
    { mode: "byte", data: view }
  ], {
    version: 1,
    errorCorrectionLevel: "L",
    output: "matrix",
    diagnostics: true
  });

  assert.equal(result.total, 3);
  assert.equal(result.parity, xorBytes(payload));
  assert.equal(result.inputLength, 1);
  assert.equal(result.byteLength, payload.length);
  assert.deepEqual(
    result.diagnostics.symbols.map((symbol) => ({
      splitUnitStart: symbol.splitUnitStart,
      splitUnitLength: symbol.splitUnitLength,
      byteStart: symbol.byteStart,
      byteLength: symbol.byteLength,
      index: symbol.index,
      total: symbol.total,
      parity: symbol.parity
    })),
    [
      { splitUnitStart: 0, splitUnitLength: 15, byteStart: 0, byteLength: 15, index: 1, total: 3, parity: result.parity },
      { splitUnitStart: 15, splitUnitLength: 15, byteStart: 15, byteLength: 15, index: 2, total: 3, parity: result.parity },
      { splitUnitStart: 30, splitUnitLength: 1, byteStart: 30, byteLength: 1, index: 3, total: 3, parity: result.parity }
    ]
  );
  assert.deepEqual(
    result.symbols.map((symbol) => symbol.diagnostics.segments.at(1).byteCount),
    [15, 15, 1]
  );
});

test("generateSegmentsStructuredAppend chunks byte string data on Unicode code point boundaries", () => {
  const text = "😀".repeat(8);
  const result = generateSegmentsStructuredAppend([
    { mode: "byte", data: text }
  ], {
    version: 1,
    errorCorrectionLevel: "L",
    output: "matrix",
    diagnostics: true
  });

  assert.equal(result.total, 3);
  assert.equal(result.parity, xorBytes(new TextEncoder().encode(text)));
  assert.deepEqual(
    result.symbols.map((symbol) => symbol.diagnostics.segments.at(1).characterCount),
    [3, 3, 2]
  );
  assert.deepEqual(
    result.symbols.map((symbol) => symbol.diagnostics.segments.at(1).byteCount),
    [12, 12, 8]
  );
});

test("generateSegmentsStructuredAppend auto version chooses the smallest common split version", () => {
  const result = generateSegmentsStructuredAppend([
    { mode: "alphanumeric", data: "ABCDEFGHIJKLMNOPQRSTU" },
    { mode: "numeric", data: "12345678901234567890" },
    { mode: "byte", data: Uint8Array.from([0x00, 0x01, 0x02, 0xff]) }
  ], {
    errorCorrectionLevel: "L",
    output: "matrix"
  });

  assert.equal(result.total, 2);
  assert.equal(result.diagnostics.version, 1);
  assert.equal(result.diagnostics.versionSelection, "auto-minimum");
});

test("generateSegmentsStructuredAppend keeps numeric, alphanumeric, and Kanji segments atomic", () => {
  const cases = [
    { mode: "numeric", data: "1".repeat(60) },
    { mode: "alphanumeric", data: "A".repeat(60) },
    { mode: "kanji", data: "漢".repeat(11) }
  ];

  for (const segment of cases) {
    assert.throws(
      () => generateSegmentsStructuredAppend([segment], {
        version: 1,
        errorCorrectionLevel: "L"
      }),
      (error) => error instanceof DataTooLongError && /cannot be split/.test(error.message)
    );
  }
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

test("mergeStructuredAppendParts merges generated string parts and normalizes metadata", () => {
  const input = "A".repeat(31);
  const generated = generateStructuredAppend(input, {
    version: 1,
    errorCorrectionLevel: "L",
    mode: "alphanumeric",
    output: "matrix",
    diagnostics: true
  });
  const parts = stringPartsFromStructuredAppend(generated, input);
  const merged = mergeStructuredAppendParts([parts[1], parts[0]]);

  assert.equal(merged.data, input);
  assert.equal(merged.total, 2);
  assert.equal(merged.parity, generated.parity);
  assert.deepEqual(merged.parts, [
    { index: 1, total: 2, parity: generated.parity, dataType: "string", byteLength: 21 },
    { index: 2, total: 2, parity: generated.parity, dataType: "string", byteLength: 10 }
  ]);
  assert.deepEqual(merged.diagnostics, {
    partCount: 2,
    total: 2,
    parity: generated.parity,
    dataType: "string",
    byteLength: 31,
    missing: [],
    duplicate: [],
    parityCheck: {
      expected: generated.parity,
      actual: generated.parity,
      matches: true
    }
  });
});

test("QRCode.mergeStructuredAppendParts static API merges manual segment parts", () => {
  const generated = generateSegmentsStructuredAppend([
    { mode: "alphanumeric", data: "ABCDEFGHIJKLMNOPQRSTU" },
    { mode: "numeric", data: "12345678901234567890" },
    { mode: "byte", data: "XYZ" }
  ], {
    version: 1,
    errorCorrectionLevel: "L",
    maskPattern: 0,
    output: "matrix",
    diagnostics: true
  });
  const parts = [
    {
      index: generated.diagnostics.symbols[0].index,
      total: generated.total,
      parity: generated.parity,
      data: "ABCDEFGHIJKLMNOPQRSTU"
    },
    {
      index: generated.diagnostics.symbols[1].index,
      total: generated.total,
      parity: generated.parity,
      data: "12345678901234567890XYZ"
    }
  ];

  const merged = QRCode.mergeStructuredAppendParts(parts);
  assert.equal(merged.data, "ABCDEFGHIJKLMNOPQRSTU12345678901234567890XYZ");
  assert.equal(merged.total, generated.total);
  assert.equal(merged.parity, generated.parity);
  assert.equal(merged.diagnostics.byteLength, generated.byteLength);
});

test("mergeStructuredAppendParts merges binary parts as Uint8Array", () => {
  const payload = Uint8Array.from(Array.from({ length: 31 }, (_, index) => index === 0 ? 0x00 : index === 30 ? 0xff : index));
  const backing = Uint8Array.from([0xaa, ...payload, 0xbb]);
  const view = new Uint8Array(backing.buffer, 1, payload.length);
  const generated = generateStructuredAppend(view, {
    version: 1,
    errorCorrectionLevel: "L",
    mode: "byte",
    output: "matrix",
    diagnostics: true
  });
  const parts = binaryPartsFromStructuredAppend(generated, payload);
  const merged = mergeStructuredAppendParts([parts[2], parts[0], parts[1]]);

  assert.ok(merged.data instanceof Uint8Array);
  assert.deepEqual(Array.from(merged.data), Array.from(payload));
  assert.equal(merged.total, 3);
  assert.equal(merged.parity, generated.parity);
  assert.equal(merged.diagnostics.dataType, "binary");
  assert.equal(merged.diagnostics.byteLength, payload.length);
  assert.deepEqual(
    merged.parts.map((part) => part.byteLength),
    [15, 15, 1]
  );
});

test("mergeStructuredAppendParts rejects unsafe or incomplete parts", () => {
  const input = "A".repeat(31);
  const generated = generateStructuredAppend(input, {
    version: 1,
    errorCorrectionLevel: "L",
    mode: "alphanumeric",
    output: "matrix",
    diagnostics: true
  });
  const parts = stringPartsFromStructuredAppend(generated, input);

  assert.throws(
    () => mergeStructuredAppendParts("not parts"),
    (error) => error instanceof InvalidInputError && /must be an array/.test(error.message)
  );
  assert.throws(
    () => mergeStructuredAppendParts([]),
    (error) => error instanceof InvalidInputError && /must not be empty/.test(error.message)
  );
  assert.throws(
    () => mergeStructuredAppendParts([parts[0]]),
    (error) => error instanceof InvalidInputError && /missing index/.test(error.message)
  );
  assert.throws(
    () => mergeStructuredAppendParts([parts[0], parts[0]]),
    (error) => error instanceof InvalidInputError && /duplicate index 1/.test(error.message)
  );
  assert.throws(
    () => mergeStructuredAppendParts([parts[0], { ...parts[1], total: 3 }]),
    (error) => error instanceof InvalidInputError && /total mismatch/.test(error.message)
  );
  assert.throws(
    () => mergeStructuredAppendParts([parts[0], { ...parts[1], parity: parts[1].parity ^ 1 }]),
    (error) => error instanceof InvalidInputError && /parity mismatch/.test(error.message)
  );
  assert.throws(
    () => mergeStructuredAppendParts([parts[0], { ...parts[1], data: "B".repeat(parts[1].data.length - 1) }]),
    (error) => error instanceof InvalidInputError && /parity check failed/.test(error.message)
  );
  assert.throws(
    () => mergeStructuredAppendParts([parts[0], { ...parts[1], data: Uint8Array.from([0x41]) }]),
    (error) => error instanceof InvalidInputError && /mix string and binary/.test(error.message)
  );
  assert.throws(
    () => mergeStructuredAppendParts([{ index: 0, total: 2, parity: 0, data: "A" }, parts[1]]),
    (error) => error instanceof InvalidInputError && /index must be an integer/.test(error.message)
  );
  assert.throws(
    () => mergeStructuredAppendParts([{ index: 1, total: 2, parity: 0, data: [0x41] }, { index: 2, total: 2, parity: 0, data: "A" }]),
    (error) => error instanceof InvalidInputError && /must be a string/.test(error.message)
  );
  assert.throws(
    () => mergeStructuredAppendParts(parts, { dataType: "string" }),
    (error) => error instanceof InvalidModeError && /Unsupported/.test(error.message)
  );
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

test("generateSegmentsStructuredAppend rejects invalid, single-symbol, too-long, and incompatible inputs", () => {
  for (const maxSymbols of [1, 17, 2.5]) {
    assert.throws(
      () => generateSegmentsStructuredAppend([{ mode: "byte", data: Uint8Array.from({ length: 31 }, (_, index) => index) }], { maxSymbols }),
      (error) => error instanceof InvalidModeError && /maxSymbols/.test(error.message)
    );
  }

  assert.throws(
    () => generateSegmentsStructuredAppend([
      { mode: "alphanumeric", data: "HELLO" },
      { mode: "numeric", data: "12345" }
    ], { version: 1 }),
    (error) => error instanceof InvalidInputError && /fit in one/.test(error.message)
  );
  assert.throws(
    () => generateSegmentsStructuredAppend([], { version: 1 }),
    (error) => error instanceof InvalidInputError && /at least/.test(error.message)
  );
  assert.throws(
    () => generateSegmentsStructuredAppend([
      { mode: "byte", data: Uint8Array.from({ length: 31 }, (_, index) => index) }
    ], {
      version: 1,
      errorCorrectionLevel: "L",
      maxSymbols: 2
    }),
    (error) => error instanceof DataTooLongError && /2 or fewer/.test(error.message)
  );
  assert.throws(
    () => generateSegmentsStructuredAppend([
      { mode: "alphanumeric", data: "A".repeat(200) }
    ], {
      version: 1,
      errorCorrectionLevel: "L"
    }),
    (error) => error instanceof DataTooLongError && /cannot be split/.test(error.message)
  );
  assert.throws(
    () => generateSegmentsStructuredAppend([{ mode: "byte", data: "A".repeat(31) }], { eci: true }),
    (error) => error instanceof InvalidModeError && /ECI/.test(error.message)
  );
  assert.throws(
    () => generateSegmentsStructuredAppend([{ mode: "byte", data: "A".repeat(31) }], { gs1: true }),
    (error) => error instanceof InvalidGs1Error && /gs1/.test(error.message)
  );
  assert.throws(
    () => generateSegmentsStructuredAppend([{ mode: "byte", data: "A".repeat(31) }], { fnc1Second: "37" }),
    (error) => error instanceof InvalidModeError && /FNC1 second/.test(error.message)
  );
  assert.throws(
    () => generateSegmentsStructuredAppend([{ mode: "byte", data: "A".repeat(31) }], { structuredAppend: { index: 1, total: 2, parity: 0 } }),
    (error) => error instanceof InvalidModeError && /structuredAppend option/.test(error.message)
  );
  assert.throws(
    () => generateSegmentsStructuredAppend([{ mode: "byte", data: "A".repeat(31) }], { mode: "byte" }),
    (error) => error instanceof InvalidModeError && /mode is not supported/.test(error.message)
  );
  assert.throws(
    () => generateSegmentsStructuredAppend([{ mode: "byte", data: "A".repeat(31) }], { encoding: "utf-8" }),
    (error) => error instanceof InvalidModeError && /encoding is not supported/.test(error.message)
  );
  assert.throws(
    () => generateSegmentsStructuredAppend([{ mode: "byte", data: "A".repeat(31) }], { optimizeSegments: false }),
    (error) => error instanceof InvalidModeError && /optimizeSegments/.test(error.message)
  );
  assert.throws(
    () => generateSegmentsStructuredAppend([{ mode: "byte", data: "A".repeat(31) }], { parity: 0 }),
    (error) => error instanceof InvalidModeError && /parity override/.test(error.message)
  );
  assert.throws(
    () => generateSegmentsStructuredAppend([{ mode: "byte", data: "A".repeat(31) }], { errorCorrection: "L" }),
    (error) => error instanceof InvalidModeError && /errorCorrectionLevel/.test(error.message)
  );
  assert.throws(
    () => generateSegmentsStructuredAppend([{ mode: "byte", data: "A".repeat(31) }], { mask: 0 }),
    (error) => error instanceof InvalidModeError && /maskPattern/.test(error.message)
  );
  assert.throws(
    () => generateSegmentsStructuredAppend([{ mode: "byte", data: "A".repeat(31) }], { boostErrorCorrection: true }),
    (error) => error instanceof InvalidModeError && /boostErrorCorrection/.test(error.message)
  );
});

test("generateSegmentsStructuredAppend rejects manual control segments", () => {
  assert.throws(
    () => generateSegmentsStructuredAppend([
      { mode: "eci", assignmentNumber: 26 },
      { mode: "byte", data: "A".repeat(31) }
    ]),
    (error) => error instanceof InvalidModeError && /manual ECI/.test(error.message)
  );
  assert.throws(
    () => generateSegmentsStructuredAppend([
      { mode: "fnc1" },
      { mode: "numeric", data: "0104912345678904" }
    ]),
    (error) => error instanceof InvalidGs1Error && /FNC1 first/.test(error.message)
  );
  assert.throws(
    () => generateSegmentsStructuredAppend([
      { mode: "fnc1-second", applicationIndicator: "37" },
      { mode: "byte", data: "A".repeat(31) }
    ]),
    (error) => error instanceof InvalidModeError && /FNC1 second/.test(error.message)
  );
  assert.throws(
    () => generateSegmentsStructuredAppend([
      { mode: "structured-append", index: 1, total: 2, parity: 0 },
      { mode: "byte", data: "A".repeat(31) }
    ]),
    (error) => error instanceof InvalidModeError && /manual structured-append/.test(error.message)
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

for (const fixture of manualSegmentsFixtures) {
  test(`generateSegmentsStructuredAppend golden fixture: ${fixture.id}`, () => {
    const result = generateSegmentsStructuredAppend(fixture.segments, {
      ...fixture.options,
      diagnostics: true
    });

    assert.equal(result.total, fixture.expected.total);
    assert.equal(result.parity, fixture.expected.parity);
    assert.equal(result.inputLength, fixture.expected.inputLength);
    assert.equal(result.byteLength, fixture.expected.byteLength);
    assert.deepEqual(result.diagnostics.splitUnits, fixture.expected.splitUnits);
    assert.deepEqual(
      result.diagnostics.symbols.map((symbol) => ({
        index: symbol.index,
        total: symbol.total,
        parity: symbol.parity,
        sequenceIndex: symbol.sequenceIndex,
        sequenceTotal: symbol.sequenceTotal,
        sequenceIndicator: symbol.sequenceIndicator,
        sourceSegmentStart: symbol.sourceSegmentStart,
        sourceSegmentEnd: symbol.sourceSegmentEnd,
        splitUnitStart: symbol.splitUnitStart,
        splitUnitLength: symbol.splitUnitLength,
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
