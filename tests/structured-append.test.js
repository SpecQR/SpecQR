import test from "node:test";
import assert from "node:assert/strict";
import {
  generate,
  generateSegments,
  InvalidGs1Error,
  InvalidModeError
} from "../src/index.js";

function matrixRows(result) {
  return result.matrix.map((row) => row.map((module) => module ? "1" : "0").join(""));
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
