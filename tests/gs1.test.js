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
import * as gs1Entrypoint from "../src/gs1.js";
import {
  GS1_AI_DICTIONARY,
  getGs1AiDictionaryEntry,
  getGs1AiSpec
} from "../src/gs1/ai-dictionary.js";
import {
  getGs1ElementStringDiagnostics,
  parseGs1ElementString,
  validateGs1ElementString
} from "../src/gs1/validator.js";
import { getSegmentsBitLength, normalizeManualSegments } from "../src/encoding/modes.js";

test("GS1 compatibility entrypoint preserves public helper exports", () => {
  assert.equal(gs1Entrypoint.GS1_FNC1_SEPARATOR, GS1_FNC1_SEPARATOR);
  assert.equal(typeof gs1Entrypoint.createGs1ElementString, "function");
  assert.equal(typeof gs1Entrypoint.parseGs1HumanReadable, "function");
  assert.equal(typeof gs1Entrypoint.calculateGs1CheckDigit, "function");
  assert.equal(typeof gs1Entrypoint.appendGtinCheckDigit, "function");
  assert.equal(typeof gs1Entrypoint.appendSsccCheckDigit, "function");
  assert.equal(typeof gs1Entrypoint.validateGtinCheckDigit, "function");
  assert.equal(typeof gs1Entrypoint.validateSsccCheckDigit, "function");
  assert.equal(
    gs1Entrypoint.createGs1ElementString([{ ai: "01", value: "04912345678904" }]),
    "0104912345678904"
  );
});

test("GS1 AI dictionary covers the current supported exact and family entries", () => {
  assert.deepEqual(
    GS1_AI_DICTIONARY.exact.map((metadata) => metadata.ai),
    [
      "00",
      "01",
      "02",
      "10",
      "11",
      "12",
      "13",
      "15",
      "16",
      "17",
      "20",
      "21",
      "22",
      "30",
      "37",
      "240",
      "241",
      "400",
      "410",
      "411",
      "412",
      "413",
      "414",
      "415",
      "420",
      "422",
      "424",
      "425",
      "426"
    ]
  );

  assert.equal(getGs1AiDictionaryEntry("01").checkDigitRule, "gtin");
  assert.equal(getGs1AiDictionaryEntry("10").separator, "required-when-followed");
  assert.equal(getGs1AiDictionaryEntry("3102").exactLength, 6);
  assert.equal(getGs1AiDictionaryEntry("91").maxLength, 90);
  assert.equal(getGs1AiDictionaryEntry("250"), null);
});

test("GS1 AI dictionary adapts metadata to the validator spec shape", () => {
  assert.deepEqual(getGs1AiSpec("01"), {
    content: "numeric",
    variable: false,
    length: 14,
    checkDigit: "gtin"
  });
  assert.deepEqual(getGs1AiSpec("10"), {
    content: "text",
    variable: true,
    maxLength: 20
  });
  assert.deepEqual(getGs1AiSpec("3105"), {
    content: "numeric",
    variable: false,
    length: 6
  });
  assert.deepEqual(getGs1AiSpec("99"), {
    content: "text",
    variable: true,
    maxLength: 90
  });
  assert.equal(getGs1AiSpec("9999"), null);
});

test("internal GS1 element string validator parses fixed-length sequences", () => {
  assert.deepEqual(parseGs1ElementString("010491234567890417251231"), [
    { ai: "01", value: "04912345678904" },
    { ai: "17", value: "251231" }
  ]);
  assert.equal(validateGs1ElementString("010491234567890417251231"), true);
});

test("internal GS1 element string diagnostics summarize raw validation", () => {
  assert.deepEqual(
    getGs1ElementStringDiagnostics(`010491234567890410ABC123${GS1_FNC1_SEPARATOR}17251231`),
    {
      enabled: true,
      elementCount: 3,
      ais: ["01", "10", "17"],
      hasSeparators: true
    }
  );
});

test("internal GS1 element string validator parses variable-length final elements", () => {
  assert.deepEqual(parseGs1ElementString("010491234567890410ABC123"), [
    { ai: "01", value: "04912345678904" },
    { ai: "10", value: "ABC123" }
  ]);
});

test("internal GS1 element string validator parses variable-length separators", () => {
  assert.deepEqual(parseGs1ElementString(`010491234567890410ABC123${GS1_FNC1_SEPARATOR}17251231`), [
    { ai: "01", value: "04912345678904" },
    { ai: "10", value: "ABC123" },
    { ai: "17", value: "251231" }
  ]);
});

test("internal GS1 element string validator accepts builder round trips", () => {
  const elements = [
    { ai: "01", value: "04912345678904" },
    { ai: "10", value: "ABC123" },
    { ai: "17", value: "251231" }
  ];
  const data = createGs1ElementString(elements);

  assert.deepEqual(parseGs1ElementString(data), elements);
});

test("internal GS1 element string validator accepts human-readable round trips", () => {
  const elements = parseGs1HumanReadable("(01)04912345678904(17)251231(10)ABC123");
  const data = createGs1ElementString(elements);

  assert.deepEqual(parseGs1ElementString(data), elements);
});

test("internal GS1 element string validator rejects malformed raw element strings", () => {
  assert.throws(
    () => parseGs1ElementString(`010491234567890410ABC12317251231`),
    (error) => error instanceof InvalidGs1Error && error.code === "INVALID_GS1"
  );
  assert.throws(
    () => parseGs1ElementString("250ABC"),
    (error) => error instanceof InvalidGs1Error && error.code === "INVALID_GS1"
  );
  assert.throws(
    () => parseGs1ElementString("010491234567890"),
    (error) => error instanceof InvalidGs1Error && error.code === "INVALID_GS1"
  );
  assert.throws(
    () => parseGs1ElementString("10ロット1"),
    (error) => error instanceof InvalidGs1Error && error.code === "INVALID_GS1"
  );
  assert.throws(
    () => parseGs1ElementString("0104912345678905"),
    (error) => error instanceof InvalidGs1Error && error.code === "INVALID_GS1"
  );
  assert.throws(
    () => parseGs1ElementString("00123456789012345670"),
    (error) => error instanceof InvalidGs1Error && error.code === "INVALID_GS1"
  );
  assert.throws(
    () => parseGs1ElementString(`10ABC${GS1_FNC1_SEPARATOR}`),
    (error) => error instanceof InvalidGs1Error && error.code === "INVALID_GS1"
  );
  assert.throws(
    () => parseGs1ElementString(`0104912345678904${GS1_FNC1_SEPARATOR}17251231`),
    (error) => error instanceof InvalidGs1Error && error.code === "INVALID_GS1"
  );
  assert.throws(
    () => parseGs1ElementString("(01)04912345678904"),
    (error) => error instanceof InvalidGs1Error && error.code === "INVALID_GS1"
  );
});

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
  assert.deepEqual(result.diagnostics.gs1Validation, {
    enabled: true,
    elementCount: 1,
    ais: ["01"],
    hasSeparators: false
  });
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
    () => generate("010491234567890417251231", {
      gs1: true,
      version: 1,
      errorCorrectionLevel: "H",
      mode: "numeric"
    }),
    (error) => error instanceof DataTooLongError && error.code === "DATA_TOO_LONG"
  );
});

test("gs1 option validates raw element strings before generation", () => {
  const data = createGs1ElementString([
    { ai: "01", value: "04912345678904" },
    { ai: "10", value: "ABC123" },
    { ai: "17", value: "251231" }
  ]);
  const result = QRCode.generate(data, {
    gs1: true,
    output: "matrix",
    diagnostics: true
  });

  assert.equal(result.diagnostics.gs1, true);
  assert.deepEqual(result.diagnostics.gs1Validation, {
    enabled: true,
    elementCount: 3,
    ais: ["01", "10", "17"],
    hasSeparators: true
  });
});

test("gs1 option rejects invalid raw element strings clearly", () => {
  const cases = [
    [`010491234567890410ABC12317251231`, /missing an FNC1 separator/],
    ["250ABC", /Unsupported GS1 AI/],
    ["010491234567890", /exactly 14 characters/],
    ["10ロット1", /printable ASCII/],
    ["0104912345678905", /invalid GTIN check digit/],
    ["00123456789012345670", /invalid SSCC check digit/]
  ];

  for (const [input, message] of cases) {
    assert.throws(
      () => generate(input, { gs1: true }),
      (error) => error instanceof InvalidGs1Error &&
        error.code === "INVALID_GS1" &&
        message.test(error.message)
    );
  }
});

test("gs1 option rejects human-readable and binary inputs before generation", () => {
  assert.throws(
    () => generate("(01)04912345678904", { gs1: true }),
    (error) => error instanceof InvalidGs1Error &&
      error.code === "INVALID_GS1" &&
      /parseGs1HumanReadable\(\).*createGs1ElementString\(\)/.test(error.message)
  );

  assert.throws(
    () => generate(new Uint8Array([0x30, 0x31]), { gs1: true }),
    (error) => error instanceof InvalidGs1Error &&
      error.code === "INVALID_GS1" &&
      /not binary input/.test(error.message)
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
  assert.deepEqual(result.diagnostics.gs1Validation, {
    enabled: true,
    elementCount: null,
    ais: [],
    hasSeparators: false
  });
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
  assert.deepEqual(result.diagnostics.gs1Validation, {
    enabled: true,
    elementCount: 3,
    ais: ["01", "10", "17"],
    hasSeparators: true
  });
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
  assert.deepEqual(result.diagnostics.gs1Validation, {
    enabled: true,
    elementCount: 3,
    ais: ["01", "10", "17"],
    hasSeparators: true
  });
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
