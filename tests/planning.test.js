import test from "node:test";
import assert from "node:assert/strict";
import {
  DataTooLongError,
  InvalidInputError,
  InvalidModeError,
  InvalidColorError,
  InvalidVersionError,
  QRCode,
  analyzeSegments,
  createGs1ElementString,
  estimate,
  generate,
  generateSegments,
  getCapacity
} from "../src/index.js";

test("estimate matches generate diagnostics for planning fields", () => {
  const input = "HELLO-123-こんにちは";
  const options = {
    errorCorrectionLevel: "Q",
    minVersion: 1,
    maxVersion: 12,
    margin: 1,
    foreground: "#777777",
    background: "#888888",
    printDpi: 600,
    boostErrorCorrection: true
  };
  const planned = estimate(input, options);
  const generated = generate(input, {
    ...options,
    diagnostics: true
  });

  assert.equal(planned.ok, true);
  assertPlanningMatchesGenerated(planned, generated.diagnostics);
  assert.equal(planned.diagnostics.phase, "planning");
  assert.equal(planned.diagnostics.renderPlanned, false);
  assert.equal(planned.diagnostics.maskEvaluated, false);
  assert.equal(planned.diagnostics.codewordsBuilt, false);
  assert.equal("maskPattern" in planned.diagnostics, false);
  assert.equal("dataCodewords" in planned.diagnostics, false);
});

test("estimate handles binary, Kanji, GS1, FNC1 second, and low-level Structured Append planning", () => {
  const binary = new Uint8Array(Uint8Array.from([0xaa, 0x00, 0xff, 0xbb]).buffer, 1, 2);
  assertPlanningMatchesGenerated(
    estimate(binary, { version: 1, errorCorrectionLevel: "L", mode: "byte" }),
    generate(binary, { version: 1, errorCorrectionLevel: "L", mode: "byte", diagnostics: true }).diagnostics
  );

  assertPlanningMatchesGenerated(
    QRCode.estimate("漢字", { version: 1, errorCorrectionLevel: "L", mode: "kanji" }),
    QRCode.generate("漢字", { version: 1, errorCorrectionLevel: "L", mode: "kanji", diagnostics: true }).diagnostics
  );

  const gs1 = createGs1ElementString([
    { ai: "01", value: "04912345678904" },
    { ai: "17", value: "251231" }
  ]);
  assertPlanningMatchesGenerated(
    estimate(gs1, { gs1: true, version: 2, errorCorrectionLevel: "M" }),
    generate(gs1, { gs1: true, version: 2, errorCorrectionLevel: "M", diagnostics: true }).diagnostics
  );

  assertPlanningMatchesGenerated(
    estimate("AA1234BBB112", { fnc1Second: "37", mode: "alphanumeric", version: 1, errorCorrectionLevel: "Q" }),
    generate("AA1234BBB112", {
      fnc1Second: "37",
      mode: "alphanumeric",
      version: 1,
      errorCorrectionLevel: "Q",
      diagnostics: true
    }).diagnostics
  );

  assertPlanningMatchesGenerated(
    estimate("HELLO", {
      structuredAppend: { index: 2, total: 5, parity: 167 },
      mode: "alphanumeric",
      version: 1,
      errorCorrectionLevel: "M"
    }),
    generate("HELLO", {
      structuredAppend: { index: 2, total: 5, parity: 167 },
      mode: "alphanumeric",
      version: 1,
      errorCorrectionLevel: "M",
      diagnostics: true
    }).diagnostics
  );
});

test("analyzeSegments matches generateSegments diagnostics for manual data and control segments", () => {
  const mixedSegments = [
    { mode: "eci", assignmentNumber: 26 },
    { mode: "byte", data: "hello" },
    { mode: "numeric", data: "12345" },
    { mode: "kanji", data: "漢字" }
  ];
  assertPlanningMatchesGenerated(
    analyzeSegments(mixedSegments, { version: 3, errorCorrectionLevel: "M" }),
    generateSegments(mixedSegments, { version: 3, errorCorrectionLevel: "M", diagnostics: true }).diagnostics
  );

  const fnc1SecondSegments = [
    { mode: "fnc1-second", applicationIndicator: "37" },
    { mode: "alphanumeric", data: "AA1234BBB112" }
  ];
  assertPlanningMatchesGenerated(
    QRCode.analyzeSegments(fnc1SecondSegments, { version: 1, errorCorrectionLevel: "Q" }),
    QRCode.generateSegments(fnc1SecondSegments, { version: 1, errorCorrectionLevel: "Q", diagnostics: true }).diagnostics
  );

  const structuredAppendSegments = [
    { mode: "structured-append", index: 2, total: 5, parity: 167 },
    { mode: "alphanumeric", data: "HELLO" }
  ];
  assertPlanningMatchesGenerated(
    analyzeSegments(structuredAppendSegments, { version: 1, errorCorrectionLevel: "M" }),
    generateSegments(structuredAppendSegments, { version: 1, errorCorrectionLevel: "M", diagnostics: true }).diagnostics
  );
});

test("estimate and analyzeSegments return ok false instead of throwing on data-too-long", () => {
  const fixed = estimate("a".repeat(100), {
    version: 1,
    errorCorrectionLevel: "H",
    mode: "byte"
  });

  assert.equal(fixed.ok, false);
  assert.equal(fixed.reason, "data-too-long");
  assert.equal(fixed.selectedVersion, 1);
  assert.equal(fixed.versionSelection, "fixed");
  assert.equal(fixed.error.name, "DataTooLongError");
  assert.equal(fixed.error.code, "DATA_TOO_LONG");
  assert.ok(fixed.remainingBits < 0);
  assert.equal(fixed.overflowBits, -fixed.remainingBits);
  assert.throws(
    () => generate("a".repeat(100), { version: 1, errorCorrectionLevel: "H", mode: "byte" }),
    (error) => error instanceof DataTooLongError
  );

  const auto = estimate("A".repeat(100), {
    minVersion: 1,
    maxVersion: 1,
    errorCorrectionLevel: "H",
    mode: "byte"
  });
  assert.equal(auto.ok, false);
  assert.equal(auto.selectedVersion, null);
  assert.equal(auto.versionSelection, "auto-range");
  assert.equal(auto.diagnostics.version, null);

  const manual = analyzeSegments([{ mode: "byte", data: "a".repeat(100) }], {
    version: 1,
    errorCorrectionLevel: "H"
  });
  assert.equal(manual.ok, false);
  assert.equal(manual.reason, "data-too-long");
});

test("getCapacity exposes table capacity and mode payload capacity", () => {
  assert.deepEqual(getCapacity({ version: 1, errorCorrectionLevel: "L" }), {
    version: 1,
    errorCorrectionLevel: "L",
    size: 21,
    dataCodewords: 19,
    totalCodewords: 26,
    capacityBits: 152,
    mode: null,
    characterCountBits: null,
    modeIndicatorBits: null,
    controlBits: 0,
    payloadBits: null,
    maxCharacters: null,
    maxBytes: null
  });

  assert.deepEqual(QRCode.getCapacity({ version: 1, errorCorrection: "L", mode: "byte", controlBits: 4 }), {
    version: 1,
    errorCorrectionLevel: "L",
    size: 21,
    dataCodewords: 19,
    totalCodewords: 26,
    capacityBits: 152,
    mode: "byte",
    characterCountBits: 8,
    modeIndicatorBits: 4,
    controlBits: 4,
    payloadBits: 136,
    maxCharacters: null,
    maxBytes: 17
  });

  assert.equal(getCapacity({ version: 10, errorCorrectionLevel: "M", mode: "numeric" }).characterCountBits, 12);
  assert.equal(getCapacity({ version: 27, errorCorrectionLevel: "M", mode: "alphanumeric" }).characterCountBits, 13);
  assert.equal(getCapacity({ version: 40, errorCorrectionLevel: "H", mode: "kanji" }).maxCharacters, 784);
});

test("getCapacity validates version, mode, error correction, and control bits", () => {
  assert.throws(
    () => getCapacity({ version: 0 }),
    (error) => error instanceof InvalidVersionError
  );
  assert.throws(
    () => getCapacity({ version: 1, mode: "auto" }),
    (error) => error instanceof InvalidModeError
  );
  assert.throws(
    () => getCapacity({ version: 1, errorCorrectionLevel: "L", errorCorrection: "H" }),
    (error) => error instanceof InvalidInputError
  );
  assert.throws(
    () => getCapacity({ version: 1, controlBits: -1 }),
    (error) => error instanceof InvalidInputError
  );
});

test("estimate validates raster colors with the existing color error class", () => {
  assert.throws(
    () => estimate("HELLO", { output: "png", foreground: "not-a-color" }),
    (error) => error instanceof InvalidColorError && error.code === "INVALID_COLOR"
  );
});

function assertPlanningMatchesGenerated(planned, diagnostics) {
  assert.equal(planned.ok, true);
  assert.equal(planned.selectedVersion, diagnostics.version);
  assert.equal(planned.diagnostics.version, diagnostics.version);
  assert.equal(planned.diagnostics.size, diagnostics.size);
  assert.equal(planned.errorCorrectionLevel, diagnostics.errorCorrectionLevel);
  assert.equal(planned.requestedErrorCorrectionLevel, diagnostics.requestedErrorCorrectionLevel);
  assert.equal(planned.boostedErrorCorrection, diagnostics.boostedErrorCorrection);
  assert.equal(planned.versionSelection, diagnostics.versionSelection);
  assert.equal(planned.versionSelectionReason, diagnostics.versionSelectionReason);
  assert.equal(planned.mode, diagnostics.mode);
  assert.deepEqual(planned.controlSegments, diagnostics.controlSegments);
  assert.equal(planned.diagnostics.eciAssignmentNumber, diagnostics.eciAssignmentNumber);
  assert.equal(planned.diagnostics.fnc1, diagnostics.fnc1);
  assert.deepEqual(planned.diagnostics.fnc1Second, diagnostics.fnc1Second);
  assert.deepEqual(planned.diagnostics.structuredAppend, diagnostics.structuredAppend);
  assert.equal(planned.diagnostics.gs1, diagnostics.gs1);
  assert.deepEqual(planned.diagnostics.gs1Validation, diagnostics.gs1Validation);
  assert.deepEqual(planned.segments, diagnostics.segments);
  assert.equal(planned.dataBitLength, diagnostics.dataBitLength);
  assert.equal(planned.capacityBits, diagnostics.capacityBits);
  assert.equal(planned.remainingBits, diagnostics.remainingBits);
  assert.equal(planned.usageRatio, diagnostics.capacityUtilization);
  assert.equal(planned.capacityUtilization, diagnostics.capacityUtilization);
  assert.equal(planned.inputBytes, diagnostics.inputBytes);
  assert.deepEqual(planned.diagnostics.quietZone, diagnostics.quietZone);
  assert.deepEqual(planned.diagnostics.colors, diagnostics.colors);
  assert.deepEqual(planned.diagnostics.print, diagnostics.print);
  assert.deepEqual(planned.warnings, diagnostics.warnings);
}
