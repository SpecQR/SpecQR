import test from "node:test";
import assert from "node:assert/strict";
import {
  applyControlSegments,
  getControlSegmentBitLength,
  getFirstEciAssignmentNumber,
  getFirstFnc1Mode,
  getFirstFnc1SecondApplicationIndicator,
  getFirstFnc1SecondApplicationIndicatorCodeword,
  isControlSegment
} from "../src/encoding/control-segments.js";
import { getSegmentsBitLength, normalizeManualSegments } from "../src/encoding/modes.js";
import { generate, generateSegments, InvalidGs1Error, InvalidModeError } from "../src/index.js";

function matrixRows(result) {
  return result.matrix.map((row) => row.map((module) => module ? "1" : "0").join(""));
}

test("internal control segment model preserves option ECI bit accounting", () => {
  const dataSegments = [
    { mode: "byte", data: "a" },
    { mode: "numeric", data: "111111111" },
    { mode: "byte", data: "bb" }
  ];
  const normalizedDataSegments = normalizeManualSegments(dataSegments);
  const plannedSegments = applyControlSegments(normalizedDataSegments, { eciAssignmentNumber: 26 });
  const withOption = generateSegments(dataSegments, {
    version: 1,
    errorCorrectionLevel: "Q",
    eci: true,
    output: "matrix",
    diagnostics: true
  });
  const withPlannedSegments = generateSegments(plannedSegments, {
    version: 1,
    errorCorrectionLevel: "Q",
    output: "matrix",
    diagnostics: true
  });

  assert.deepEqual(plannedSegments.map((segment) => segment.mode), ["eci", "byte", "numeric", "byte"]);
  assert.equal(isControlSegment(plannedSegments[0]), true);
  assert.equal(getFirstEciAssignmentNumber(plannedSegments), 26);
  assert.equal(getFirstFnc1Mode(plannedSegments), null);
  assert.equal(getControlSegmentBitLength(plannedSegments[0]), 12);
  assert.equal(getSegmentsBitLength(plannedSegments, 1), withOption.diagnostics.dataBitLength);
  assert.equal(withPlannedSegments.diagnostics.dataBitLength, withOption.diagnostics.dataBitLength);
  assert.deepEqual(withPlannedSegments.diagnostics.segments, withOption.diagnostics.segments);
  assert.deepEqual(matrixRows(withPlannedSegments), matrixRows(withOption));
});

test("internal control segment model preserves FNC1 first position behavior", () => {
  const dataSegments = normalizeManualSegments([
    { mode: "numeric", data: "0104912345678904" }
  ]);
  const plannedSegments = applyControlSegments(dataSegments, { fnc1First: true });
  const withGs1Option = generate("0104912345678904", {
    gs1: true,
    version: 1,
    errorCorrectionLevel: "H",
    mode: "numeric",
    output: "matrix",
    diagnostics: true
  });
  const withPlannedSegments = generateSegments(plannedSegments, {
    version: 1,
    errorCorrectionLevel: "H",
    output: "matrix",
    diagnostics: true
  });

  assert.deepEqual(plannedSegments.map((segment) => segment.mode), ["fnc1", "numeric"]);
  assert.equal(isControlSegment(plannedSegments[0]), true);
  assert.equal(getFirstFnc1Mode(plannedSegments), "first-position");
  assert.equal(getFirstEciAssignmentNumber(plannedSegments), null);
  assert.equal(getControlSegmentBitLength(plannedSegments[0]), 4);
  assert.equal(getSegmentsBitLength(plannedSegments, 1), withGs1Option.diagnostics.dataBitLength);
  assert.equal(withPlannedSegments.diagnostics.dataBitLength, withGs1Option.diagnostics.dataBitLength);
  assert.deepEqual(withPlannedSegments.diagnostics.segments, withGs1Option.diagnostics.segments);
  assert.deepEqual(matrixRows(withPlannedSegments), matrixRows(withGs1Option));
});

test("internal control segment model preserves invalid ECI and FNC1 combinations", () => {
  assert.throws(
    () => applyControlSegments([{ mode: "fnc1" }, { mode: "numeric", text: "01" }], { eciAssignmentNumber: 26 }),
    (error) => error instanceof InvalidGs1Error &&
      /eci cannot be combined with FNC1 first position/.test(error.message)
  );
  assert.throws(
    () => applyControlSegments([{ mode: "eci", assignmentNumber: 26 }, { mode: "byte", text: "ABC" }], { fnc1First: true }),
    (error) => error instanceof InvalidGs1Error &&
      /gs1 and eci cannot be combined/.test(error.message)
  );
  assert.throws(
    () => applyControlSegments([{ mode: "byte", text: "ABC" }], { eciAssignmentNumber: 26, fnc1First: true }),
    (error) => error instanceof InvalidGs1Error &&
      /gs1 and eci cannot be combined/.test(error.message)
  );
});

test("internal control segment model supports FNC1 second position accounting", () => {
  const dataSegments = normalizeManualSegments([
    { mode: "alphanumeric", data: "AA1234BBB112" }
  ]);
  const plannedSegments = applyControlSegments(dataSegments, { fnc1Second: "37" });
  const withOption = generate("AA1234BBB112", {
    fnc1Second: "37",
    mode: "alphanumeric",
    version: 1,
    errorCorrectionLevel: "Q",
    maskPattern: 3,
    output: "matrix",
    diagnostics: true
  });
  const withPlannedSegments = generateSegments(plannedSegments, {
    version: 1,
    errorCorrectionLevel: "Q",
    maskPattern: 3,
    output: "matrix",
    diagnostics: true
  });

  assert.deepEqual(plannedSegments.map((segment) => segment.mode), ["fnc1-second", "alphanumeric"]);
  assert.equal(isControlSegment(plannedSegments[0]), true);
  assert.equal(getFirstFnc1Mode(plannedSegments), "second-position");
  assert.equal(getFirstFnc1SecondApplicationIndicator(plannedSegments), "37");
  assert.equal(getFirstFnc1SecondApplicationIndicatorCodeword(plannedSegments), 37);
  assert.equal(getFirstEciAssignmentNumber(plannedSegments), null);
  assert.equal(getControlSegmentBitLength(plannedSegments[0]), 12);
  assert.equal(getSegmentsBitLength(plannedSegments, 1), withOption.diagnostics.dataBitLength);
  assert.equal(withPlannedSegments.diagnostics.dataBitLength, withOption.diagnostics.dataBitLength);
  assert.deepEqual(withPlannedSegments.diagnostics.segments, withOption.diagnostics.segments);
  assert.deepEqual(matrixRows(withPlannedSegments), matrixRows(withOption));
});

test("internal control segment model rejects FNC1 second conflicts", () => {
  assert.throws(
    () => applyControlSegments([{ mode: "fnc1" }, { mode: "numeric", text: "01" }], { fnc1Second: "37" }),
    (error) => error instanceof InvalidGs1Error &&
      /FNC1 first position cannot be combined with FNC1 second position/.test(error.message)
  );
  assert.throws(
    () => applyControlSegments([{ mode: "eci", assignmentNumber: 26 }, { mode: "byte", text: "ABC" }], { fnc1Second: "37" }),
    (error) => error instanceof InvalidModeError &&
      /FNC1 second position cannot be combined with ECI/.test(error.message)
  );
  assert.throws(
    () => applyControlSegments([{ mode: "byte", text: "ABC" }], { eciAssignmentNumber: 26, fnc1Second: "37" }),
    (error) => error instanceof InvalidModeError &&
      /FNC1 second position cannot be combined with ECI/.test(error.message)
  );
});
