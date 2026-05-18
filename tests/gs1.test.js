import test from "node:test";
import assert from "node:assert/strict";
import {
  appendGtinCheckDigit,
  appendSsccCheckDigit,
  calculateGs1CheckDigit,
  calculateGtinCheckDigit,
  calculateSsccCheckDigit,
  createGs1ElementString,
  DataTooLongError,
  GS1_FNC1_SEPARATOR,
  InvalidGs1Error,
  QRCode,
  generate,
  generateSegments,
  parseGs1HumanReadable,
  validateGs1CheckDigit,
  validateGtinCheckDigit,
  validateSsccCheckDigit
} from "../src/index.js";
import { getSegmentsBitLength, normalizeManualSegments } from "../src/encoding/modes.js";

test("gs1 option prepends FNC1 first position and reports diagnostics", () => {
  const result = generate("0104912345678904", {
    gs1: true,
    version: 1,
    errorCorrectionLevel: "H",
    mode: "numeric",
    output: "matrix",
    diagnostics: true
  });

  assert.equal(result.diagnostics.gs1, true);
  assert.equal(result.diagnostics.fnc1, "first-position");
  assert.equal(result.diagnostics.mode, "numeric");
  assert.deepEqual(
    result.diagnostics.segments.map((segment) => segment.mode),
    ["fnc1", "numeric"]
  );
  assert.deepEqual(
    result.diagnostics.segments.map((segment) => segment.bitLength),
    [4, 68]
  );
  assert.equal(result.diagnostics.dataBitLength, 72);
  assert.equal(result.diagnostics.capacityBits, 72);
  assert.equal(result.diagnostics.remainingBits, 0);

  assert.throws(
    () => generate("01049123456789040", {
      gs1: true,
      version: 1,
      errorCorrectionLevel: "H",
      mode: "numeric"
    }),
    (error) => error instanceof DataTooLongError && error.code === "DATA_TOO_LONG"
  );
});

test("manual fnc1 segment encodes first position control mode", () => {
  const segments = normalizeManualSegments([
    { mode: "fnc1" },
    { mode: "numeric", data: "0104912345678904" }
  ]);
  const result = generateSegments(segments, {
    version: 1,
    errorCorrectionLevel: "H",
    output: "matrix",
    diagnostics: true
  });

  assert.equal(getSegmentsBitLength(segments, 1), 72);
  assert.equal(result.diagnostics.gs1, true);
  assert.equal(result.diagnostics.fnc1, "first-position");
  assert.deepEqual(
    result.diagnostics.segments.map((segment) => segment.mode),
    ["fnc1", "numeric"]
  );
});

test("gs1 option and manual fnc1 or ECI combinations fail clearly", () => {
  assert.throws(
    () => generateSegments([
      { mode: "fnc1" },
      { mode: "numeric", data: "01" }
    ], { gs1: true }),
    (error) => error instanceof InvalidGs1Error && error.code === "INVALID_GS1"
  );

  assert.throws(
    () => generate("HELLO", { gs1: true, eci: true }),
    (error) => error instanceof InvalidGs1Error && error.code === "INVALID_GS1"
  );

  assert.throws(
    () => generateSegments([
      { mode: "fnc1" },
      { mode: "eci", assignmentNumber: 26 },
      { mode: "byte", data: "ABC" }
    ]),
    (error) => error instanceof InvalidGs1Error && error.code === "INVALID_GS1"
  );

  assert.throws(
    () => generateSegments([
      { mode: "numeric", data: "01" },
      { mode: "fnc1" }
    ]),
    (error) => error instanceof InvalidGs1Error && error.code === "INVALID_GS1"
  );
});

test("GS1 element string helper inserts separators after variable-length elements", () => {
  const data = createGs1ElementString([
    { ai: "01", value: "04912345678904" },
    { ai: "10", value: "ABC123" },
    { ai: "17", value: "251231" }
  ]);

  assert.equal(data, `010491234567890410ABC123${GS1_FNC1_SEPARATOR}17251231`);

  const result = QRCode.generate(data, {
    gs1: true,
    output: "matrix",
    diagnostics: true
  });
  assert.equal(result.diagnostics.gs1, true);
  assert.equal(result.diagnostics.segments[0].mode, "fnc1");
});

test("GS1 helper leaves final variable-length element unterminated", () => {
  const data = QRCode.createGs1ElementString([
    { ai: "01", value: "04912345678904" },
    { ai: "17", value: "251231" },
    { ai: "10", value: "ABC123" }
  ]);

  assert.equal(data, "01049123456789041725123110ABC123");
});

test("GS1 helper validates representative AI lengths and raw values", () => {
  assert.equal(
    createGs1ElementString([
      { ai: "3102", value: "001234" },
      { ai: "21", value: "SERIAL-1" }
    ]),
    "310200123421SERIAL-1"
  );

  assert.throws(
    () => createGs1ElementString([{ ai: "01", value: "123" }]),
    (error) => error instanceof InvalidGs1Error && error.code === "INVALID_GS1"
  );
  assert.throws(
    () => createGs1ElementString([{ ai: "17", value: "ABC123" }]),
    (error) => error instanceof InvalidGs1Error && error.code === "INVALID_GS1"
  );
  assert.throws(
    () => createGs1ElementString([{ ai: "30", value: "123456789" }]),
    (error) => error instanceof InvalidGs1Error && error.code === "INVALID_GS1"
  );
  assert.throws(
    () => createGs1ElementString([{ ai: "30", value: "12A" }]),
    (error) => error instanceof InvalidGs1Error && error.code === "INVALID_GS1"
  );
  assert.throws(
    () => createGs1ElementString([{ ai: "10", value: `ABC${GS1_FNC1_SEPARATOR}` }]),
    (error) => error instanceof InvalidGs1Error && error.code === "INVALID_GS1"
  );
  assert.throws(
    () => createGs1ElementString([{ ai: "9999", value: "ABC" }]),
    (error) => error instanceof InvalidGs1Error && error.code === "INVALID_GS1"
  );
  assert.throws(
    () => createGs1ElementString([{ ai: "30", value: 123 }]),
    (error) => error instanceof InvalidGs1Error && error.code === "INVALID_GS1"
  );
});

test("GS1 check digit helpers calculate and validate GTIN and SSCC values", () => {
  assert.equal(calculateGs1CheckDigit("0491234567890"), "4");
  assert.equal(validateGs1CheckDigit("04912345678904"), true);
  assert.equal(validateGs1CheckDigit("04912345678905"), false);

  assert.equal(calculateGtinCheckDigit("0491234567890"), "4");
  assert.equal(appendGtinCheckDigit("0491234567890"), "04912345678904");
  assert.equal(validateGtinCheckDigit("04912345678904"), true);
  assert.equal(validateGtinCheckDigit("04912345678905"), false);
  assert.equal(QRCode.appendGtinCheckDigit("0491234567890"), "04912345678904");
  assert.equal(QRCode.validateGtinCheckDigit("04912345678904"), true);

  assert.equal(calculateSsccCheckDigit("12345678901234567"), "5");
  assert.equal(appendSsccCheckDigit("12345678901234567"), "123456789012345675");
  assert.equal(validateSsccCheckDigit("123456789012345675"), true);
  assert.equal(validateSsccCheckDigit("123456789012345670"), false);

  assert.throws(
    () => calculateGtinCheckDigit("123"),
    (error) => error instanceof InvalidGs1Error && error.code === "INVALID_GS1"
  );
  assert.throws(
    () => validateSsccCheckDigit("123"),
    (error) => error instanceof InvalidGs1Error && error.code === "INVALID_GS1"
  );
});

test("GS1 helper validates GTIN and SSCC check digits for supported AIs", () => {
  assert.equal(
    createGs1ElementString([
      { ai: "00", value: appendSsccCheckDigit("12345678901234567") },
      { ai: "01", value: appendGtinCheckDigit("0491234567890") },
      { ai: "422", value: "392" },
      { ai: "10", value: "LOT-A" }
    ]),
    `00123456789012345675010491234567890442239210LOT-A`
  );

  assert.throws(
    () => createGs1ElementString([{ ai: "01", value: "04912345678905" }]),
    (error) => error instanceof InvalidGs1Error && error.code === "INVALID_GS1"
  );
  assert.throws(
    () => createGs1ElementString([{ ai: "00", value: "123456789012345670" }]),
    (error) => error instanceof InvalidGs1Error && error.code === "INVALID_GS1"
  );
  assert.throws(
    () => createGs1ElementString([{ ai: "422", value: "JP1" }]),
    (error) => error instanceof InvalidGs1Error && error.code === "INVALID_GS1"
  );
});

test("GS1 human-readable parser returns validated elements", () => {
  const elements = parseGs1HumanReadable("(01)04912345678904(17)251231(10)ABC123");

  assert.deepEqual(elements, [
    { ai: "01", value: "04912345678904" },
    { ai: "17", value: "251231" },
    { ai: "10", value: "ABC123" }
  ]);
  assert.deepEqual(QRCode.parseGs1HumanReadable("(3102)001234(21)SERIAL-1"), [
    { ai: "3102", value: "001234" },
    { ai: "21", value: "SERIAL-1" }
  ]);
});

test("GS1 human-readable parser round-trips through raw element string creation", () => {
  const elements = parseGs1HumanReadable("(01)04912345678904(10)ABC123(17)251231");
  const data = createGs1ElementString(elements);

  assert.equal(data, `010491234567890410ABC123${GS1_FNC1_SEPARATOR}17251231`);

  const result = generate(data, {
    gs1: true,
    output: "matrix",
    diagnostics: true
  });

  assert.equal(result.diagnostics.gs1, true);
  assert.equal(result.diagnostics.fnc1, "first-position");
  assert.equal(result.diagnostics.segments[0].mode, "fnc1");
});

test("GS1 human-readable parser omits separator after a final variable-length AI", () => {
  const elements = parseGs1HumanReadable("(01)04912345678904(17)251231(10)ABC123");
  const data = createGs1ElementString(elements);

  assert.equal(data, "01049123456789041725123110ABC123");
});

test("GS1 human-readable parser rejects malformed input and unsupported AI values", () => {
  assert.throws(
    () => parseGs1HumanReadable("01)04912345678904"),
    (error) => error instanceof InvalidGs1Error && error.code === "INVALID_GS1"
  );
  assert.throws(
    () => parseGs1HumanReadable("(01 04912345678904"),
    (error) => error instanceof InvalidGs1Error && error.code === "INVALID_GS1"
  );
  assert.throws(
    () => parseGs1HumanReadable("(9999)ABC"),
    (error) => error instanceof InvalidGs1Error && error.code === "INVALID_GS1"
  );
  assert.throws(
    () => parseGs1HumanReadable("(01)123"),
    (error) => error instanceof InvalidGs1Error && error.code === "INVALID_GS1"
  );
  assert.throws(
    () => parseGs1HumanReadable("(17)ABC123"),
    (error) => error instanceof InvalidGs1Error && error.code === "INVALID_GS1"
  );
  assert.throws(
    () => parseGs1HumanReadable("(10)ロット1"),
    (error) => error instanceof InvalidGs1Error && error.code === "INVALID_GS1"
  );
  assert.throws(
    () => parseGs1HumanReadable("(10)ABC(123"),
    (error) => error instanceof InvalidGs1Error && error.code === "INVALID_GS1"
  );
});
