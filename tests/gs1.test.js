import test from "node:test";
import assert from "node:assert/strict";
import {
  appendGtinCheckDigit,
  appendSsccCheckDigit,
  calculateGs1CheckDigit,
  calculateGtinCheckDigit,
  calculateSsccCheckDigit,
  createGs1DigitalLink,
  createGs1ElementString,
  DataTooLongError,
  getGs1AiInfo,
  getSupportedGs1Ais,
  GS1_FNC1_SEPARATOR,
  InvalidGs1Error,
  QRCode,
  generate,
  generateSegments,
  normalizeGs1DigitalLink,
  parseGs1DigitalLink,
  parseGs1ElementString,
  parseGs1HumanReadable,
  validateGs1DigitalLink,
  validateGs1CheckDigit,
  validateGs1Elements,
  validateGs1ElementString as validatePublicGs1ElementString,
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
  parseGs1ElementString as parseInternalGs1ElementString,
  validateGs1ElementString
} from "../src/gs1/validator.js";
import { getSegmentsBitLength, normalizeManualSegments } from "../src/encoding/modes.js";

test("GS1 compatibility entrypoint preserves public helper exports", () => {
  assert.equal(gs1Entrypoint.GS1_FNC1_SEPARATOR, GS1_FNC1_SEPARATOR);
  assert.equal(typeof gs1Entrypoint.createGs1ElementString, "function");
  assert.equal(typeof gs1Entrypoint.createGs1DigitalLink, "function");
  assert.equal(typeof gs1Entrypoint.parseGs1DigitalLink, "function");
  assert.equal(typeof gs1Entrypoint.normalizeGs1DigitalLink, "function");
  assert.equal(typeof gs1Entrypoint.parseGs1HumanReadable, "function");
  assert.equal(typeof gs1Entrypoint.getSupportedGs1Ais, "function");
  assert.equal(typeof gs1Entrypoint.getGs1AiInfo, "function");
  assert.equal(typeof gs1Entrypoint.validateGs1Elements, "function");
  assert.equal(typeof gs1Entrypoint.validateGs1ElementString, "function");
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
  assert.equal(getGs1AiDictionaryEntry("01").digitalLinkRole, "primary-key");
  assert.equal(getGs1AiDictionaryEntry("10").separator, "required-when-followed");
  assert.equal(getGs1AiDictionaryEntry("10").digitalLinkRole, "key-qualifier");
  assert.deepEqual(getGs1AiDictionaryEntry("10").digitalLinkPathForPrimary, ["01"]);
  assert.equal(getGs1AiDictionaryEntry("17").digitalLinkRole, "data-attribute");
  assert.equal(getGs1AiDictionaryEntry("3102").exactLength, 6);
  assert.equal(getGs1AiDictionaryEntry("3102").digitalLinkRole, "data-attribute");
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

test("public GS1 AI introspection returns stable concrete metadata", () => {
  assert.deepEqual(
    getSupportedGs1Ais().map((metadata) => metadata.ai),
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
      "426",
      "3100",
      "3101",
      "3102",
      "3103",
      "3104",
      "3105",
      "3200",
      "3201",
      "3202",
      "3203",
      "3204",
      "3205",
      "91",
      "92",
      "93",
      "94",
      "95",
      "96",
      "97",
      "98",
      "99"
    ]
  );

  assert.deepEqual(getGs1AiInfo("01"), {
    ai: "01",
    label: "Global trade item number",
    length: { type: "fixed", exact: 14 },
    valueKind: "numeric",
    checkDigitRule: "gtin",
    digitalLinkRole: "primary-key",
    separator: "none"
  });
  assert.deepEqual(getGs1AiInfo("3102"), {
    ai: "3102",
    label: "Net weight in kilograms",
    length: { type: "fixed", exact: 6 },
    valueKind: "numeric",
    checkDigitRule: "none",
    digitalLinkRole: "data-attribute",
    separator: "none"
  });
  assert.deepEqual(QRCode.getGs1AiInfo("10"), {
    ai: "10",
    label: "Batch or lot number",
    length: { type: "variable", min: 1, max: 20 },
    valueKind: "text",
    checkDigitRule: "none",
    digitalLinkRole: "key-qualifier",
    digitalLinkPathForPrimary: ["01"],
    separator: "required-when-followed"
  });
  assert.equal(getGs1AiInfo("250"), null);
  assert.equal(getGs1AiInfo(1), null);
  assert.equal(QRCode.getSupportedGs1Ais().some((metadata) => metadata.ai === "99"), true);
});

test("internal GS1 element string validator parses fixed-length sequences", () => {
  assert.deepEqual(parseInternalGs1ElementString("010491234567890417251231"), [
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
  assert.deepEqual(parseInternalGs1ElementString("010491234567890410ABC123"), [
    { ai: "01", value: "04912345678904" },
    { ai: "10", value: "ABC123" }
  ]);
});

test("internal GS1 element string validator parses variable-length separators", () => {
  assert.deepEqual(parseInternalGs1ElementString(`010491234567890410ABC123${GS1_FNC1_SEPARATOR}17251231`), [
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

  assert.deepEqual(parseInternalGs1ElementString(data), elements);
});

test("internal GS1 element string validator accepts human-readable round trips", () => {
  const elements = parseGs1HumanReadable("(01)04912345678904(17)251231(10)ABC123");
  const data = createGs1ElementString(elements);

  assert.deepEqual(parseInternalGs1ElementString(data), elements);
});

test("internal GS1 element string validator rejects malformed raw element strings", () => {
  assert.throws(
    () => parseInternalGs1ElementString(`010491234567890410ABC12317251231`),
    (error) => error instanceof InvalidGs1Error && error.code === "INVALID_GS1"
  );
  assert.throws(
    () => parseInternalGs1ElementString("250ABC"),
    (error) => error instanceof InvalidGs1Error && error.code === "INVALID_GS1"
  );
  assert.throws(
    () => parseInternalGs1ElementString("010491234567890"),
    (error) => error instanceof InvalidGs1Error && error.code === "INVALID_GS1"
  );
  assert.throws(
    () => parseInternalGs1ElementString("10ロット1"),
    (error) => error instanceof InvalidGs1Error && error.code === "INVALID_GS1"
  );
  assert.throws(
    () => parseInternalGs1ElementString("0104912345678905"),
    (error) => error instanceof InvalidGs1Error && error.code === "INVALID_GS1"
  );
  assert.throws(
    () => parseInternalGs1ElementString("00123456789012345670"),
    (error) => error instanceof InvalidGs1Error && error.code === "INVALID_GS1"
  );
  assert.throws(
    () => parseInternalGs1ElementString(`10ABC${GS1_FNC1_SEPARATOR}`),
    (error) => error instanceof InvalidGs1Error && error.code === "INVALID_GS1"
  );
  assert.throws(
    () => parseInternalGs1ElementString(`0104912345678904${GS1_FNC1_SEPARATOR}17251231`),
    (error) => error instanceof InvalidGs1Error && error.code === "INVALID_GS1"
  );
  assert.throws(
    () => parseInternalGs1ElementString("(01)04912345678904"),
    (error) => error instanceof InvalidGs1Error && error.code === "INVALID_GS1"
  );
});

test("public GS1 element string parser returns elements and separator metadata", () => {
  assert.deepEqual(parseGs1ElementString("010491234567890417251231"), {
    elements: [
      { ai: "01", value: "04912345678904" },
      { ai: "17", value: "251231" }
    ],
    hasSeparators: false
  });

  assert.deepEqual(QRCode.parseGs1ElementString("010491234567890410ABC123"), {
    elements: [
      { ai: "01", value: "04912345678904" },
      { ai: "10", value: "ABC123" }
    ],
    hasSeparators: false
  });

  assert.deepEqual(parseGs1ElementString(`010491234567890410ABC123${GS1_FNC1_SEPARATOR}17251231`), {
    elements: [
      { ai: "01", value: "04912345678904" },
      { ai: "10", value: "ABC123" },
      { ai: "17", value: "251231" }
    ],
    hasSeparators: true
  });
});

test("public GS1 element string parser accepts builder and human-readable round trips", () => {
  const elements = [
    { ai: "01", value: "04912345678904" },
    { ai: "10", value: "ABC123" },
    { ai: "17", value: "251231" }
  ];
  const data = createGs1ElementString(elements);

  assert.deepEqual(parseGs1ElementString(data), {
    elements,
    hasSeparators: true
  });

  const humanReadableElements = parseGs1HumanReadable("(01)04912345678904(17)251231(10)ABC123");
  const humanReadableData = createGs1ElementString(humanReadableElements);

  assert.deepEqual(parseGs1ElementString(humanReadableData), {
    elements: humanReadableElements,
    hasSeparators: false
  });
});

test("public GS1 element string parser rejects malformed raw element strings", () => {
  const cases = [
    ["(01)04912345678904", /parseGs1HumanReadable\(\).*createGs1ElementString\(\)/],
    [`010491234567890410ABC12317251231`, /missing an FNC1 separator/],
    ["250ABC", /Unsupported GS1 AI/],
    ["010491234567890", /exactly 14 characters/],
    ["10ロット1", /printable ASCII/],
    ["0104912345678905", /invalid GTIN check digit/],
    ["00123456789012345670", /invalid SSCC check digit/]
  ];

  for (const [input, message] of cases) {
    assert.throws(
      () => parseGs1ElementString(input),
      (error) => error instanceof InvalidGs1Error &&
        error.code === "INVALID_GS1" &&
        message.test(error.message)
    );
  }
});

test("public GS1 validation API returns non-throwing success results", () => {
  const elements = [
    { ai: "01", value: "04912345678904" },
    { ai: "10", value: "ABC123" },
    { ai: "17", value: "251231" }
  ];
  const raw = createGs1ElementString(elements);

  assert.deepEqual(validateGs1Elements(elements), {
    ok: true,
    elements,
    warnings: []
  });
  assert.deepEqual(QRCode.validateGs1Elements(elements, { context: "digital-link" }), {
    ok: true,
    elements,
    warnings: []
  });
  assert.deepEqual(validatePublicGs1ElementString(raw), {
    ok: true,
    elements,
    hasSeparators: true,
    warnings: []
  });
  assert.deepEqual(QRCode.validateGs1ElementString("010491234567890417251231"), {
    ok: true,
    elements: [
      { ai: "01", value: "04912345678904" },
      { ai: "17", value: "251231" }
    ],
    hasSeparators: false,
    warnings: []
  });
});

test("public GS1 element validation collects structured errors", () => {
  const result = validateGs1Elements([
    { ai: "01", value: "0491234567890" },
    { ai: "30", value: "12A" },
    { ai: "9999", value: "ABC" }
  ]);

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors.map((error) => error.code), [
    "GS1_INVALID_LENGTH",
    "GS1_INVALID_CHARSET",
    "GS1_UNSUPPORTED_AI"
  ]);
  assert.deepEqual(result.errors.map((error) => error.elementIndex), [0, 1, 2]);
  assert.deepEqual(result.errors.map((error) => error.ai), ["01", "30", "9999"]);

  const firstOnly = validateGs1Elements([
    { ai: "01", value: "0491234567890" },
    { ai: "30", value: "12A" }
  ], { collectAllErrors: false });
  assert.equal(firstOnly.ok, false);
  assert.equal(firstOnly.errors.length, 1);
  assert.equal(firstOnly.errors[0].code, "GS1_INVALID_LENGTH");
});

test("public GS1 raw element string validation maps detailed error codes", () => {
  const cases = [
    ["(01)04912345678904", "GS1_INVALID_INPUT", undefined],
    [`010491234567890410ABC12317251231`, "GS1_MISSING_SEPARATOR", "10"],
    ["250ABC", "GS1_UNSUPPORTED_AI", "250"],
    ["010491234567890", "GS1_INVALID_LENGTH", "01"],
    ["10ロット1", "GS1_INVALID_CHARSET", "10"],
    ["0104912345678905", "GS1_INVALID_CHECK_DIGIT", "01"],
    [`10ABC${GS1_FNC1_SEPARATOR}`, "GS1_UNEXPECTED_SEPARATOR", undefined],
    [`0104912345678904${GS1_FNC1_SEPARATOR}17251231`, "GS1_UNEXPECTED_SEPARATOR", undefined]
  ];

  for (const [input, code, ai] of cases) {
    const result = validatePublicGs1ElementString(input);
    assert.equal(result.ok, false);
    assert.equal(result.errors.length, 1);
    assert.equal(result.errors[0].code, code, input);
    assert.equal(result.errors[0].ai, ai);
  }
});

test("public GS1 validation rejects invalid validation options without throwing", () => {
  assert.deepEqual(validateGs1Elements([{ ai: "01", value: "04912345678904" }], { context: "other" }), {
    ok: false,
    errors: [
      {
        code: "GS1_INVALID_INPUT",
        message: "GS1 validation options.context must be \"element-string\" or \"digital-link\"",
        reason: "invalid-options",
        expected: "element-string or digital-link"
      }
    ],
    warnings: []
  });
  assert.deepEqual(validatePublicGs1ElementString("0104912345678904", { allowUnsupportedAi: true }), {
    ok: false,
    errors: [
      {
        code: "GS1_INVALID_INPUT",
        message: "GS1 validation options.allowUnsupportedAi must be false",
        reason: "invalid-options",
        expected: false
      }
    ],
    warnings: []
  });
});

test("public GS1 element validation reports Digital Link context placement issues", () => {
  assert.deepEqual(validateGs1Elements([{ ai: "17", value: "251231" }], { context: "digital-link" }), {
    ok: false,
    errors: [
      {
        code: "GS1_INVALID_DIGITAL_LINK_PLACEMENT",
        message: "GS1 Digital Link elements must include a primary AI 00, 01, or 414",
        reason: "invalid-digital-link-placement",
        expected: "primary AI 00, 01, or 414"
      }
    ],
    warnings: []
  });
});

test("GS1 Digital Link helper creates stable URL QR payloads", () => {
  const elements = [
    { ai: "01", value: "04912345678904" },
    { ai: "10", value: "ABC123" },
    { ai: "17", value: "251231" }
  ];

  assert.equal(
    createGs1DigitalLink(elements, { baseUrl: "https://example.com" }),
    "https://example.com/01/04912345678904/10/ABC123?17=251231"
  );
  assert.equal(
    createGs1DigitalLink([
      { ai: "01", value: "04912345678904" },
      { ai: "21", value: "SER123" },
      { ai: "3102", value: "001234" }
    ], { baseUrl: "https://example.com" }),
    "https://example.com/01/04912345678904/21/SER123?3102=001234"
  );
  assert.equal(
    createGs1DigitalLink(elements, { baseUrl: "https://example.com/" }),
    "https://example.com/01/04912345678904/10/ABC123?17=251231"
  );
  assert.equal(
    createGs1DigitalLink(elements, { baseUrl: "https://example.com/prefix/" }),
    "https://example.com/prefix/01/04912345678904/10/ABC123?17=251231"
  );
  assert.equal(
    QRCode.createGs1DigitalLink(elements, { baseUrl: new URL("https://example.com") }),
    "https://example.com/01/04912345678904/10/ABC123?17=251231"
  );
});

test("GS1 Digital Link helper accepts parseGs1ElementString result input", () => {
  const raw = `010491234567890410ABC123${GS1_FNC1_SEPARATOR}17251231`;
  const parsed = parseGs1ElementString(raw);

  assert.equal(
    createGs1DigitalLink(parsed, { baseUrl: "https://example.com/" }),
    "https://example.com/01/04912345678904/10/ABC123?17=251231"
  );
});

test("GS1 Digital Link parser round-trips builder output", () => {
  const elements = [
    { ai: "01", value: "04912345678904" },
    { ai: "10", value: "ABC123" },
    { ai: "17", value: "251231" }
  ];
  const uri = createGs1DigitalLink(elements, { baseUrl: "https://example.com" });
  const parsed = parseGs1DigitalLink(uri);

  assert.deepEqual(parsed, {
    elements,
    primary: { ai: "01", value: "04912345678904" },
    pathElements: [
      { ai: "01", value: "04912345678904" },
      { ai: "10", value: "ABC123" }
    ],
    queryElements: [
      { ai: "17", value: "251231" }
    ],
    unknownQuery: []
  });
  assert.equal(
    createGs1DigitalLink(parsed, { baseUrl: "https://example.com" }),
    uri
  );
  assert.deepEqual(QRCode.parseGs1DigitalLink(uri), parsed);
});

test("GS1 Digital Link parser preserves unknown query and percent-decodes values", () => {
  const parsed = parseGs1DigitalLink(
    "https://example.com/stem/01/04912345678904/21/SER%2F1?foo=bar&17=251231&linkType=all"
  );

  assert.deepEqual(parsed, {
    elements: [
      { ai: "01", value: "04912345678904" },
      { ai: "21", value: "SER/1" },
      { ai: "17", value: "251231" }
    ],
    primary: { ai: "01", value: "04912345678904" },
    pathElements: [
      { ai: "01", value: "04912345678904" },
      { ai: "21", value: "SER/1" }
    ],
    queryElements: [
      { ai: "17", value: "251231" }
    ],
    unknownQuery: [
      { key: "foo", value: "bar" },
      { key: "linkType", value: "all" }
    ]
  });
  assert.equal(
    createGs1DigitalLink(parsed, { baseUrl: "https://example.com/stem", pathAis: ["21"] }),
    "https://example.com/stem/01/04912345678904/21/SER%2F1?17=251231"
  );
});

test("GS1 Digital Link parser supports explicit primary AI", () => {
  const parsed = parseGs1DigitalLink(
    "https://example.com/00/195201234567891232?02=09520123456788&37=25",
    { primaryAi: "00" }
  );

  assert.deepEqual(parsed, {
    elements: [
      { ai: "00", value: "195201234567891232" },
      { ai: "02", value: "09520123456788" },
      { ai: "37", value: "25" }
    ],
    primary: { ai: "00", value: "195201234567891232" },
    pathElements: [
      { ai: "00", value: "195201234567891232" }
    ],
    queryElements: [
      { ai: "02", value: "09520123456788" },
      { ai: "37", value: "25" }
    ],
    unknownQuery: []
  });
  assert.equal(
    createGs1DigitalLink(parsed, { baseUrl: "https://example.com", primaryAi: parsed.primary.ai }),
    "https://example.com/00/195201234567891232?02=09520123456788&37=25"
  );
});

test("GS1 Digital Link parser rejects invalid URI values", () => {
  const cases = [
    [
      () => parseGs1DigitalLink("ftp://example.com/01/04912345678904"),
      /http or https/
    ],
    [
      () => parseGs1DigitalLink("https://example.com/01/04912345678904#frag"),
      /must not include a fragment/
    ],
    [
      () => parseGs1DigitalLink("https://example.com/01/04912345678904/10"),
      /AI\/value pairs/
    ],
    [
      () => parseGs1DigitalLink("https://example.com/01/04912345678904/17/251231"),
      /cannot be placed in the Digital Link path/
    ],
    [
      () => parseGs1DigitalLink("https://example.com/01/04912345678904/ABC/value"),
      /must be a GS1 AI/
    ],
    [
      () => parseGs1DigitalLink("https://example.com/01/%E0%A4%A"),
      /valid percent-encoding/
    ],
    [
      () => parseGs1DigitalLink("https://example.com/01/04912345678904?01=04912345678904"),
      /duplicate AI 01/
    ],
    [
      () => parseGs1DigitalLink("https://example.com/01/04912345678905"),
      /invalid GTIN check digit/
    ],
    [
      () => parseGs1DigitalLink("https://example.com/01/04912345678904?9999=ABC"),
      /Unsupported GS1 AI/
    ],
    [
      () => parseGs1DigitalLink("https://example.com/01/04912345678904?linkType=all", { unknownQuery: "reject" }),
      /not a GS1 AI/
    ]
  ];

  for (const [fn, message] of cases) {
    assert.throws(
      fn,
      (error) => error instanceof InvalidGs1Error && message.test(error.message),
      `Expected InvalidGs1Error matching ${message}`
    );
  }
});

test("public GS1 Digital Link validation returns non-throwing success results", () => {
  const uri = "https://example.com/stem/01/04912345678904/21/SER%2F1?foo=bar&17=251231&linkType=all";
  const result = validateGs1DigitalLink(uri);

  assert.equal(result.ok, true);
  assert.deepEqual(result.result, {
    elements: [
      { ai: "01", value: "04912345678904" },
      { ai: "21", value: "SER/1" },
      { ai: "17", value: "251231" }
    ],
    primary: { ai: "01", value: "04912345678904" },
    pathElements: [
      { ai: "01", value: "04912345678904" },
      { ai: "21", value: "SER/1" }
    ],
    queryElements: [
      { ai: "17", value: "251231" }
    ],
    unknownQuery: [
      { key: "foo", value: "bar" },
      { key: "linkType", value: "all" }
    ]
  });
  assert.deepEqual(result.warnings, [
    {
      code: "GS1_DIGITAL_LINK_UNKNOWN_QUERY_PRESERVED",
      message: "GS1 Digital Link URI contains non-GS1 query parameters preserved in unknownQuery.",
      reason: "unknown-query-preserved",
      count: 2
    }
  ]);
  assert.deepEqual(QRCode.validateGs1DigitalLink(uri), result);
});

test("public GS1 Digital Link validation warns for http URIs", () => {
  const result = validateGs1DigitalLink("http://example.com/01/04912345678904");

  assert.equal(result.ok, true);
  assert.deepEqual(result.warnings, [
    {
      code: "GS1_DIGITAL_LINK_HTTP",
      message: "GS1 Digital Link URI uses http. Use https when transport security is required.",
      reason: "http-uri"
    }
  ]);
});

test("public GS1 Digital Link validation maps failures to detail errors", () => {
  const cases = [
    [
      "ftp://example.com/01/04912345678904",
      undefined,
      {
        code: "GS1_DIGITAL_LINK_INVALID_URI",
        reason: "invalid-uri",
        expected: "absolute http or https URL"
      }
    ],
    [
      "https://example.com/01/04912345678904#frag",
      undefined,
      {
        code: "GS1_DIGITAL_LINK_FRAGMENT_NOT_ALLOWED",
        reason: "fragment-not-allowed",
        expected: "URI without fragment"
      }
    ],
    [
      "https://example.com/01/04912345678904?linkType=all",
      { unknownQuery: "reject" },
      {
        code: "GS1_DIGITAL_LINK_UNKNOWN_QUERY",
        key: "linkType",
        reason: "unknown-query",
        expected: "GS1 AI query parameter or unknownQuery: \"preserve\""
      }
    ],
    [
      "https://example.com/01/04912345678904?9999=ABC",
      undefined,
      {
        code: "GS1_UNSUPPORTED_AI",
        ai: "9999",
        reason: "unsupported-ai",
        expected: "supported GS1 AI"
      }
    ],
    [
      "https://example.com/01/04912345678904?17=25123",
      undefined,
      {
        code: "GS1_INVALID_LENGTH",
        ai: "17",
        reason: "invalid-length",
        expected: "exactly 6 characters"
      }
    ],
    [
      "https://example.com/01/04912345678904?10=%F0%9F%98%80",
      undefined,
      {
        code: "GS1_INVALID_CHARSET",
        ai: "10",
        reason: "invalid-charset",
        expected: "printable ASCII"
      }
    ],
    [
      "https://example.com/01/04912345678905",
      undefined,
      {
        code: "GS1_INVALID_CHECK_DIGIT",
        ai: "01",
        reason: "invalid-check-digit",
        expected: "valid GTIN check digit"
      }
    ],
    [
      "https://example.com/01/04912345678904/17/251231",
      undefined,
      {
        code: "GS1_INVALID_DIGITAL_LINK_PLACEMENT",
        ai: "17",
        reason: "invalid-digital-link-placement"
      }
    ],
    [
      "https://example.com/01/04912345678904?01=04912345678904",
      undefined,
      {
        code: "GS1_DUPLICATE_AI",
        ai: "01",
        reason: "duplicate-ai",
        expected: "unique GS1 AI within the Digital Link URI"
      }
    ],
    [
      "https://example.com/01/%E0%A4%A",
      undefined,
      {
        code: "GS1_INVALID_PERCENT_ENCODING",
        reason: "invalid-percent-encoding",
        expected: "percent escapes must use two hexadecimal digits"
      }
    ],
    [
      "https://example.com/01/04912345678904/10",
      undefined,
      {
        code: "GS1_INVALID_INPUT",
        reason: "malformed-path",
        expected: "Digital Link path containing primary AI and AI/value pairs"
      }
    ]
  ];

  for (const [uri, options, expected] of cases) {
    const result = validateGs1DigitalLink(uri, options);
    assert.equal(result.ok, false, `Expected ${uri} to fail validation`);
    const actual = {
        code: result.errors[0].code,
        ai: result.errors[0].ai,
        key: result.errors[0].key,
        value: result.errors[0].value,
        reason: result.errors[0].reason,
        expected: result.errors[0].expected
      };
    assert.deepEqual(
      Object.fromEntries(Object.entries(actual).filter(([, value]) => value !== undefined)),
      expected
    );
    assert.equal(typeof result.errors[0].message, "string");
    assert.deepEqual(result.warnings, []);
  }
});

test("public GS1 Digital Link validation keeps throwing parser behavior separate", () => {
  const uri = "https://example.com/01/04912345678904#frag";

  assert.equal(validateGs1DigitalLink(uri).ok, false);
  assert.throws(
    () => parseGs1DigitalLink(uri),
    (error) => error instanceof InvalidGs1Error && /fragment/u.test(error.message)
  );
});

test("GS1 Digital Link normalizer applies SpecQR deterministic URI policy", () => {
  assert.equal(
    normalizeGs1DigitalLink(
      "https://example.com/stem/01/04912345678904?3102=001234&17=251231&10=LOT%2FA&foo=bar&linkType=all"
    ),
    "https://example.com/stem/01/04912345678904/10/LOT%2FA?17=251231&3102=001234&foo=bar&linkType=all"
  );
  assert.equal(
    normalizeGs1DigitalLink("http://example.com/01/04912345678904?17=251231&10=ABC"),
    "http://example.com/01/04912345678904/10/ABC?17=251231"
  );
  assert.equal(
    QRCode.normalizeGs1DigitalLink("https://example.com/stem%201/01/04912345678904?10=LOT%2FA&17=251231"),
    "https://example.com/stem%201/01/04912345678904/10/LOT%2FA?17=251231"
  );
});

test("GS1 Digital Link normalizer is idempotent with builder and parser output", () => {
  const elements = [
    { ai: "01", value: "04912345678904" },
    { ai: "10", value: "ABC123" },
    { ai: "17", value: "251231" }
  ];
  const created = createGs1DigitalLink(elements, { baseUrl: "https://example.com/stem" });
  const normalized = normalizeGs1DigitalLink(created);

  assert.equal(normalized, created);
  assert.equal(normalizeGs1DigitalLink(normalized), normalized);
  assert.deepEqual(parseGs1DigitalLink(normalizeGs1DigitalLink(created)), parseGs1DigitalLink(created));
});

test("GS1 Digital Link normalizer handles unknown query policy and rejects invalid input", () => {
  assert.equal(
    normalizeGs1DigitalLink("https://example.com/01/04912345678904?b=2&10=ABC&a=1"),
    "https://example.com/01/04912345678904/10/ABC?b=2&a=1"
  );

  const cases = [
    [
      () => normalizeGs1DigitalLink("https://example.com/01/04912345678904?linkType=all", {
        unknownQuery: "reject"
      }),
      /not a GS1 AI/
    ],
    [
      () => normalizeGs1DigitalLink("ftp://example.com/01/04912345678904"),
      /http or https/
    ],
    [
      () => normalizeGs1DigitalLink("https://example.com/01/04912345678904#frag"),
      /fragment/
    ],
    [
      () => normalizeGs1DigitalLink("https://example.com/01/%E0%A4%A"),
      /valid percent-encoding/
    ],
    [
      () => normalizeGs1DigitalLink("https://example.com/01/04912345678904?01=04912345678904"),
      /duplicate AI 01/
    ],
    [
      () => normalizeGs1DigitalLink("https://example.com/01/04912345678904/17/251231"),
      /cannot be placed in the Digital Link path/
    ],
    [
      () => normalizeGs1DigitalLink("https://example.com/01/04912345678905"),
      /invalid GTIN check digit/
    ],
    [
      () => normalizeGs1DigitalLink("https://example.com/01/04912345678904", { mode: "canonical" }),
      /mode must be "specqr-deterministic"/
    ]
  ];

  for (const [fn, message] of cases) {
    assert.throws(
      fn,
      (error) => error instanceof InvalidGs1Error && message.test(error.message),
      `Expected InvalidGs1Error matching ${message}`
    );
  }
});

test("GS1 Digital Link helper supports explicit primary and path AI options", () => {
  assert.equal(
    createGs1DigitalLink(
      [
        { ai: "00", value: "195201234567891232" },
        { ai: "02", value: "09520123456788" },
        { ai: "37", value: "25" },
        { ai: "10", value: "ABC123" }
      ],
      { baseUrl: "https://example.com", primaryAi: "00" }
    ),
    "https://example.com/00/195201234567891232?02=09520123456788&10=ABC123&37=25"
  );
  assert.equal(
    createGs1DigitalLink(
      [
        { ai: "01", value: "04912345678904" },
        { ai: "21", value: "SER/1" }
      ],
      { baseUrl: "https://example.com", pathAis: ["21"] }
    ),
    "https://example.com/01/04912345678904/21/SER%2F1"
  );
});

test("GS1 Digital Link helper rejects invalid input and base URL values", () => {
  const cases = [
    [
      () => createGs1DigitalLink([{ ai: "01", value: "04912345678904" }]),
      /baseUrl is required/
    ],
    [
      () => createGs1DigitalLink([{ ai: "01", value: "04912345678904" }], { baseUrl: "ftp://example.com" }),
      /http or https/
    ],
    [
      () => createGs1DigitalLink([{ ai: "01", value: "04912345678904" }], { baseUrl: "https://example.com?a=1" }),
      /must not include query or fragment/
    ],
    [
      () => createGs1DigitalLink([{ ai: "10", value: "ABC123" }], { baseUrl: "https://example.com" }),
      /must include primary AI 01/
    ],
    [
      () => createGs1DigitalLink([{ ai: "01", value: "04912345678904" }, { ai: "17", value: "251231" }], {
        baseUrl: "https://example.com",
        pathAis: ["17"]
      }),
      /cannot be placed in the Digital Link path/
    ],
    [
      () => createGs1DigitalLink([{ ai: "01", value: "04912345678904" }, { ai: "01", value: "04912345678904" }], { baseUrl: "https://example.com" }),
      /duplicate AI 01/
    ],
    [
      () => createGs1DigitalLink([{ ai: "9999", value: "ABC" }], { baseUrl: "https://example.com" }),
      /Unsupported GS1 AI/
    ],
    [
      () => createGs1DigitalLink([{ ai: "01", value: "04912345678905" }], { baseUrl: "https://example.com" }),
      /invalid GTIN check digit/
    ],
    [
      () => createGs1DigitalLink([{ ai: "10", value: `ABC${GS1_FNC1_SEPARATOR}` }], { baseUrl: "https://example.com" }),
      /must not contain the FNC1 separator/
    ],
    [
      () => createGs1DigitalLink([{ ai: "10", value: "(ABC)" }], { baseUrl: "https://example.com" }),
      /without human-readable parentheses/
    ]
  ];

  for (const [fn, message] of cases) {
    assert.throws(
      fn,
      (error) => error instanceof InvalidGs1Error && message.test(error.message),
      `Expected InvalidGs1Error matching ${message}`
    );
  }
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
