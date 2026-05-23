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

test("fnc1Second option encodes FNC1 second position diagnostics", () => {
  const result = generate("AA1234BBB112", {
    fnc1Second: "37",
    mode: "alphanumeric",
    version: 1,
    errorCorrectionLevel: "Q",
    maskPattern: 0,
    output: "matrix",
    diagnostics: true
  });

  assert.equal(result.diagnostics.fnc1, "second-position");
  assert.deepEqual(result.diagnostics.fnc1Second, {
    enabled: true,
    applicationIndicator: "37",
    applicationIndicatorCodeword: 37
  });
  assert.equal(result.diagnostics.gs1, false);
  assert.equal(result.diagnostics.eciAssignmentNumber, null);
  assert.deepEqual(result.diagnostics.controlSegments, [
    { mode: "fnc1-second", applicationIndicator: "37", applicationIndicatorCodeword: 37 }
  ]);
  assert.deepEqual(
    result.diagnostics.segments.map((segment) => segment.mode),
    ["fnc1-second", "alphanumeric"]
  );
  assert.deepEqual(
    result.diagnostics.segments.map((segment) => segment.bitLength),
    [12, 79]
  );
  assert.equal(result.diagnostics.dataBitLength, 91);
});

test("manual fnc1-second segment encodes alphabetic application indicators", () => {
  const result = generateSegments([
    { mode: "fnc1-second", applicationIndicator: "A" },
    { mode: "byte", data: "abc" }
  ], {
    version: 1,
    errorCorrectionLevel: "L",
    maskPattern: 1,
    output: "matrix",
    diagnostics: true
  });

  assert.equal(result.diagnostics.fnc1, "second-position");
  assert.deepEqual(result.diagnostics.fnc1Second, {
    enabled: true,
    applicationIndicator: "A",
    applicationIndicatorCodeword: 165
  });
  assert.deepEqual(result.diagnostics.controlSegments, [
    { mode: "fnc1-second", applicationIndicator: "A", applicationIndicatorCodeword: 165 }
  ]);
  assert.equal(result.diagnostics.segments[0].applicationIndicator, "A");
  assert.equal(result.diagnostics.segments[0].applicationIndicatorCodeword, 165);
  assert.equal(result.diagnostics.segments[0].bitLength, 12);
});

test("fnc1Second option and manual segment have matching bit accounting and matrix output", () => {
  const options = {
    version: 1,
    errorCorrectionLevel: "Q",
    maskPattern: 2,
    output: "matrix",
    diagnostics: true
  };
  const withOption = generate("AA1234BBB112", {
    ...options,
    mode: "alphanumeric",
    fnc1Second: "37"
  });
  const withManual = generateSegments([
    { mode: "fnc1-second", applicationIndicator: "37" },
    { mode: "alphanumeric", data: "AA1234BBB112" }
  ], options);

  assert.equal(withManual.diagnostics.dataBitLength, withOption.diagnostics.dataBitLength);
  assert.deepEqual(withManual.diagnostics.segments, withOption.diagnostics.segments);
  assert.deepEqual(withManual.diagnostics.controlSegments, withOption.diagnostics.controlSegments);
  assert.deepEqual(matrixRows(withManual), matrixRows(withOption));
});

test("fnc1Second rejects invalid application indicators", () => {
  const invalidValues = ["", "7", "123", "1A", "AB", "é", 37, true, null];

  for (const fnc1Second of invalidValues) {
    assert.throws(
      () => generate("ABC", { fnc1Second }),
      (error) => error instanceof InvalidModeError &&
        /fnc1Second must be a two-digit number or a single Latin alphabetic character/.test(error.message)
    );
  }

  assert.throws(
    () => generateSegments([
      { mode: "fnc1-second", applicationIndicator: "123" },
      { mode: "byte", data: "ABC" }
    ]),
    (error) => error instanceof InvalidModeError &&
      /segments\[0\]\.applicationIndicator must be a two-digit number or a single Latin alphabetic character/.test(error.message)
  );
});

test("fnc1Second rejects unsafe control mode combinations", () => {
  assert.throws(
    () => generate("ABC", { gs1: true, fnc1Second: "37" }),
    (error) => error instanceof InvalidGs1Error &&
      /gs1 and fnc1Second cannot be combined/.test(error.message)
  );
  assert.throws(
    () => generate("ABC", { eci: true, fnc1Second: "37" }),
    (error) => error instanceof InvalidModeError &&
      /fnc1Second and eci cannot be combined/.test(error.message)
  );
  assert.throws(
    () => generateSegments([
      { mode: "fnc1-second", applicationIndicator: "37" },
      { mode: "byte", data: "ABC" }
    ], { gs1: true }),
    (error) => error instanceof InvalidGs1Error &&
      /FNC1 first position cannot be combined with FNC1 second position/.test(error.message)
  );
  assert.throws(
    () => generateSegments([
      { mode: "fnc1-second", applicationIndicator: "37" },
      { mode: "byte", data: "ABC" }
    ], { eci: true }),
    (error) => error instanceof InvalidModeError &&
      /ECI cannot be combined with FNC1 second position/.test(error.message)
  );
  assert.throws(
    () => generateSegments([
      { mode: "eci", assignmentNumber: 26 },
      { mode: "byte", data: "ABC" }
    ], { fnc1Second: "37" }),
    (error) => error instanceof InvalidModeError &&
      /FNC1 second position cannot be combined with ECI/.test(error.message)
  );
});
