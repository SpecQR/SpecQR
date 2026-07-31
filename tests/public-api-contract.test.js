import test from "node:test";
import assert from "node:assert/strict";
import {
  InvalidInputError,
  InvalidModeError,
  QRCode,
  estimate,
  generate,
  generateSegments,
  generateSegmentsStructuredAppend,
  generateStructuredAppend,
  getCapacity,
  getGs1AiInfo,
  getSupportedGs1Ais,
  validateGs1Elements
} from "../src/index.js";
import { toBlob } from "../src/browser.js";
import { toPngBuffer } from "../src/node.js";

const SIMPLE_SEGMENTS = [{ mode: "alphanumeric", data: "CONTRACT" }];

test("base and Planning APIs preserve permissive option-container behavior", () => {
  const baseline = generate("CONTRACT");

  assert.equal(generate("CONTRACT", null), baseline);
  assert.equal(generate("CONTRACT", []), baseline);
  assert.equal(generate("CONTRACT", { unknownOption: "ignored" }), baseline);
  assert.deepEqual(estimate("CONTRACT", null), estimate("CONTRACT"));
  assert.deepEqual(
    estimate("CONTRACT", { unknownOption: "ignored" }),
    estimate("CONTRACT")
  );

  const inheritedOutput = Object.create({ output: "matrix" });
  assert.equal(generate("CONTRACT", inheritedOutput), baseline);
  assert.equal(typeof generate("CONTRACT", { output: "matrix" }), "object");
});

test("manual segment APIs share the permissive base option policy", () => {
  const baseline = generateSegments(SIMPLE_SEGMENTS);

  assert.equal(generateSegments(SIMPLE_SEGMENTS, null), baseline);
  assert.equal(generateSegments(SIMPLE_SEGMENTS, []), baseline);
  assert.equal(
    generateSegments(SIMPLE_SEGMENTS, { unknownOption: "ignored" }),
    baseline
  );

  const fixedBaseline = generateSegments(
    [{ mode: "byte", data: "ABC" }],
    {
      version: 1,
      errorCorrectionLevel: "L",
      maskPattern: 0,
      output: "matrix"
    }
  );
  assert.deepEqual(
    generateSegments(
      [{ mode: "byte", data: "ABC" }],
      {
        version: 1,
        errorCorrectionLevel: "L",
        maskPattern: 0,
        mode: "numeric",
        optimizeSegments: false,
        output: "matrix"
      }
    ),
    fixedBaseline
  );
});

test("getCapacity keeps its specialized container and alias policy", () => {
  for (const options of [null, []]) {
    assert.throws(
      () => getCapacity(options),
      (error) =>
        error instanceof InvalidInputError &&
        error.code === "INVALID_INPUT" &&
        error.message === "getCapacity options must be an object"
    );
  }

  assert.deepEqual(
    getCapacity({ version: 1, unknownOption: "ignored" }),
    getCapacity({ version: 1 })
  );
  assert.deepEqual(
    getCapacity(Object.create({
      version: 1,
      errorCorrection: "H",
      mode: "byte"
    })),
    getCapacity({ version: 1 })
  );
  assert.equal(
    getCapacity({ version: 1, errorCorrection: "H", mode: "byte" })
      .errorCorrectionLevel,
    "H"
  );
  assert.throws(
    () =>
      getCapacity({
        version: 1,
        errorCorrectionLevel: "L",
        errorCorrection: "H"
      }),
    (error) =>
      error instanceof InvalidInputError &&
      error.message ===
        "errorCorrectionLevel and errorCorrection must match when both are provided"
  );
});

test("known base option behavior keeps stable errors and legacy coercion", () => {
  assert.throws(
    () => generate("CONTRACT", { margin: -1 }),
    (error) =>
      error instanceof InvalidInputError &&
      error.code === "INVALID_INPUT" &&
      error.message === "margin must be a non-negative integer; got -1"
  );

  const diagnosticResult = generate("CONTRACT", { diagnostics: "yes" });
  assert.deepEqual(Object.keys(diagnosticResult), ["matrix", "svg", "diagnostics"]);

  const aliasesAreIgnored = generate("CONTRACT", {
    diagnostics: true,
    errorCorrection: "H",
    mask: 99
  });
  assert.equal(aliasesAreIgnored.diagnostics.requestedErrorCorrectionLevel, "M");
  assert.equal(aliasesAreIgnored.diagnostics.maskPenalties.length, 8);
});

test("Structured Append APIs reject invalid containers and owned aliases", () => {
  const input = "A".repeat(200);

  for (const options of [null, []]) {
    assert.throws(
      () => generateStructuredAppend(input, options),
      (error) =>
        error instanceof InvalidInputError &&
        error.code === "INVALID_INPUT" &&
        error.message === "generateStructuredAppend options must be an object"
    );
  }

  assert.throws(
    () => generateStructuredAppend(input, { errorCorrection: "L" }),
    (error) =>
      error instanceof InvalidModeError &&
      error.code === "INVALID_MODE" &&
      error.message ===
        "generateStructuredAppend uses errorCorrectionLevel; errorCorrection is not supported"
  );
  assert.throws(
    () => generateStructuredAppend(input, { mask: 0 }),
    (error) =>
      error instanceof InvalidModeError &&
      error.message ===
        "generateStructuredAppend uses maskPattern; mask is not supported"
  );
  assert.throws(
    () => generateStructuredAppend(input, { parity: 0 }),
    (error) =>
      error instanceof InvalidModeError &&
      error.message ===
        "generateStructuredAppend computes parity from the original payload bytes; parity override is not supported"
  );
  assert.throws(
    () =>
      generateSegmentsStructuredAppend(
        [{ mode: "byte", data: input }],
        { mode: "byte" }
      ),
    (error) =>
      error instanceof InvalidModeError &&
      error.message ===
        "generateSegmentsStructuredAppend uses caller-provided segment modes; mode is not supported"
  );

  const baseline = generateStructuredAppend("A".repeat(31), {
    version: 1,
    errorCorrectionLevel: "L",
    mode: "alphanumeric",
    output: "matrix"
  });
  assert.deepEqual(
    generateStructuredAppend("A".repeat(31), {
      version: 1,
      errorCorrectionLevel: "L",
      mode: "alphanumeric",
      output: "matrix",
      unknownOption: "ignored"
    }),
    baseline
  );
});

test("Node and browser helpers own output and diagnostics options", async () => {
  const png = toPngBuffer("CONTRACT", {
    diagnostics: true,
    output: "svg",
    margin: 0,
    scale: 1
  });
  assert.equal(Buffer.isBuffer(png), true);
  assert.deepEqual(Array.from(png.subarray(0, 8)), [
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
  ]);

  const blob = toBlob("CONTRACT", {
    diagnostics: true,
    output: "matrix",
    margin: 0,
    scale: 1
  });
  assert.equal(blob.type, "image/png");
  assert.deepEqual(
    Array.from(new Uint8Array(await blob.arrayBuffer()).subarray(0, 8)),
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  );
});

test("GS1 metadata is detached and deeply frozen at the public boundary", () => {
  const supported = getSupportedGs1Ais();
  const lot = getGs1AiInfo("10");

  assert.equal(Object.isFrozen(supported), true);
  assert.equal(Object.isFrozen(lot), true);
  assert.equal(Object.isFrozen(lot.length), true);
  assert.equal(Object.isFrozen(lot.digitalLinkPathForPrimary), true);
  assert.equal(
    Object.values(lot).some((value) => value instanceof RegExp),
    false
  );

  assert.throws(() => supported.push(lot), TypeError);
  assert.throws(() => {
    lot.label = "mutated";
  }, TypeError);
  assert.throws(() => {
    lot.length.max = 999;
  }, TypeError);
  assert.throws(() => lot.digitalLinkPathForPrimary.push("00"), TypeError);

  const nextSupported = QRCode.getSupportedGs1Ais();
  const nextLot = QRCode.getGs1AiInfo("10");
  assert.notEqual(nextSupported, supported);
  assert.notEqual(nextLot, lot);
  assert.deepEqual(nextLot, {
    ai: "10",
    label: "Batch or lot number",
    length: { type: "variable", min: 1, max: 20 },
    valueKind: "text",
    checkDigitRule: "none",
    digitalLinkRole: "key-qualifier",
    digitalLinkPathForPrimary: ["01"],
    separator: "required-when-followed"
  });
  assert.deepEqual(validateGs1Elements([
    { ai: "01", value: "04912345678904" },
    { ai: "10", value: "LOT-A" }
  ]), {
    ok: true,
    elements: [
      { ai: "01", value: "04912345678904" },
      { ai: "10", value: "LOT-A" }
    ],
    warnings: []
  });
});
