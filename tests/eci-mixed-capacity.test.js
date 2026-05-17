import test from "node:test";
import assert from "node:assert/strict";
import { getDataCodewordCount } from "../src/core/tables.js";
import {
  createSegments,
  getSegmentsBitLength,
  normalizeManualSegments
} from "../src/encoding/modes.js";
import { DataTooLongError, generate, generateSegments } from "../src/index.js";

test("option ECI contributes to exact-fit auto mixed-segment capacity", () => {
  const text = `a${"1".repeat(9)}bb`;
  const result = generate(text, {
    version: 1,
    errorCorrectionLevel: "Q",
    eci: true,
    output: "matrix",
    diagnostics: true
  });
  const segments = createSegments(text, "auto", 1, true, 26);
  const capacityBits = getDataCodewordCount(1, "Q") * 8;

  assert.equal(result.diagnostics.dataBitLength, 104);
  assert.equal(result.diagnostics.capacityBits, capacityBits);
  assert.equal(result.diagnostics.remainingBits, 0);
  assert.equal(getSegmentsBitLength(segments, 1), result.diagnostics.dataBitLength);
  assert.deepEqual(
    result.diagnostics.segments.map((segment) => segment.mode),
    ["eci", "byte", "numeric", "byte"]
  );
  assert.deepEqual(
    result.diagnostics.segments.map((segment) => segment.bitLength),
    [12, 20, 44, 28]
  );

  assert.throws(
    () => generate(`${text}b`, {
      version: 1,
      errorCorrectionLevel: "Q",
      eci: true,
      output: "matrix"
    }),
    (error) => error instanceof DataTooLongError && error.code === "DATA_TOO_LONG"
  );
});

test("manual ECI segment and option ECI have equivalent mixed-segment bit accounting", () => {
  const dataSegments = [
    { mode: "byte", data: "a" },
    { mode: "numeric", data: "111111111" },
    { mode: "byte", data: "bb" }
  ];
  const withOption = generateSegments(dataSegments, {
    version: 1,
    errorCorrectionLevel: "Q",
    eci: true,
    output: "matrix",
    diagnostics: true
  });
  const withManual = generateSegments([
    { mode: "eci", assignmentNumber: 26 },
    ...dataSegments
  ], {
    version: 1,
    errorCorrectionLevel: "Q",
    output: "matrix",
    diagnostics: true
  });
  const normalizedManual = normalizeManualSegments([
    { mode: "eci", assignmentNumber: 26 },
    ...dataSegments
  ]);

  assert.equal(withOption.diagnostics.dataBitLength, 104);
  assert.equal(withManual.diagnostics.dataBitLength, 104);
  assert.equal(withOption.diagnostics.remainingBits, 0);
  assert.equal(withManual.diagnostics.remainingBits, 0);
  assert.equal(getSegmentsBitLength(normalizedManual, 1), 104);
  assert.deepEqual(
    withOption.diagnostics.segments.map((segment) => segment.mode),
    withManual.diagnostics.segments.map((segment) => segment.mode)
  );

  assert.throws(
    () => generateSegments([
      { mode: "eci", assignmentNumber: 26 },
      { mode: "byte", data: "a" },
      { mode: "numeric", data: "111111111" },
      { mode: "byte", data: "bbb" }
    ], {
      version: 1,
      errorCorrectionLevel: "Q",
      output: "matrix"
    }),
    (error) => error instanceof DataTooLongError && error.code === "DATA_TOO_LONG"
  );
});

test("manual ECI mixed segments can include numeric, alphanumeric, byte, and Kanji at capacity edge", () => {
  const segments = [
    { mode: "eci", assignmentNumber: 26 },
    { mode: "numeric", data: "1" },
    { mode: "alphanumeric", data: "A" },
    { mode: "byte", data: new Uint8Array([0x41, 0xff]) },
    { mode: "kanji", data: "漢漢漢" }
  ];
  const result = generateSegments(segments, {
    version: 2,
    errorCorrectionLevel: "H",
    output: "matrix",
    diagnostics: true
  });
  const normalizedSegments = normalizeManualSegments(segments);

  assert.equal(result.diagnostics.dataBitLength, 128);
  assert.equal(result.diagnostics.capacityBits, 128);
  assert.equal(result.diagnostics.remainingBits, 0);
  assert.equal(getSegmentsBitLength(normalizedSegments, 2), 128);
  assert.deepEqual(
    result.diagnostics.segments.map((segment) => segment.mode),
    ["eci", "numeric", "alphanumeric", "byte", "kanji"]
  );
  assert.deepEqual(
    result.diagnostics.segments.map((segment) => segment.bitLength),
    [12, 18, 19, 28, 51]
  );

  assert.throws(
    () => generateSegments([
      { mode: "eci", assignmentNumber: 26 },
      { mode: "numeric", data: "1" },
      { mode: "alphanumeric", data: "A" },
      { mode: "byte", data: new Uint8Array([0x41, 0xff, 0x00]) },
      { mode: "kanji", data: "漢漢漢" }
    ], {
      version: 2,
      errorCorrectionLevel: "H",
      output: "matrix"
    }),
    (error) => error instanceof DataTooLongError && error.code === "DATA_TOO_LONG"
  );
});

test("large ECI assignment width is counted in fixed-version capacity checks", () => {
  const input = "A".repeat(5);
  const result = generate(input, {
    version: 1,
    errorCorrectionLevel: "H",
    mode: "byte",
    eci: 300,
    output: "matrix",
    diagnostics: true
  });

  assert.equal(result.diagnostics.dataBitLength, 72);
  assert.equal(result.diagnostics.capacityBits, 72);
  assert.equal(result.diagnostics.remainingBits, 0);
  assert.deepEqual(
    result.diagnostics.segments.map((segment) => segment.bitLength),
    [20, 52]
  );

  assert.throws(
    () => generate(`${input}A`, {
      version: 1,
      errorCorrectionLevel: "H",
      mode: "byte",
      eci: 300,
      output: "matrix"
    }),
    (error) => error instanceof DataTooLongError && error.code === "DATA_TOO_LONG"
  );
});
