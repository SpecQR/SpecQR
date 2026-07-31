import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as SpecQR from "../src/index.js";

const SINGLE_INPUT = "HELLO-1234-lower";
const SINGLE_OPTIONS = {
  version: 5,
  errorCorrectionLevel: "Q",
  maskPattern: 3,
  mode: "auto",
  margin: 4,
  scale: 3,
  foreground: "#102030",
  background: "#fefefe"
};

const PUBLIC_EXPORTS = [
  "DataTooLongError",
  "GS1_FNC1_SEPARATOR",
  "InvalidCanvasTargetError",
  "InvalidColorError",
  "InvalidEciError",
  "InvalidGs1Error",
  "InvalidInputError",
  "InvalidModeError",
  "InvalidOutputError",
  "InvalidVersionError",
  "QRCode",
  "SpecQRError",
  "analyzeSegments",
  "appendGtinCheckDigit",
  "appendSsccCheckDigit",
  "calculateGs1CheckDigit",
  "calculateGtinCheckDigit",
  "calculateSsccCheckDigit",
  "calculateStructuredAppendParity",
  "calculateStructuredAppendSegmentsParity",
  "createGs1DigitalLink",
  "createGs1ElementString",
  "drawToCanvas",
  "estimate",
  "generate",
  "generateSegments",
  "generateSegmentsStructuredAppend",
  "generateStructuredAppend",
  "getCapacity",
  "getGs1AiInfo",
  "getSupportedGs1Ais",
  "mergeStructuredAppendParts",
  "normalizeGs1DigitalLink",
  "parseGs1DigitalLink",
  "parseGs1ElementString",
  "parseGs1HumanReadable",
  "validateGs1CheckDigit",
  "validateGs1DigitalLink",
  "validateGs1ElementString",
  "validateGs1Elements",
  "validateGtinCheckDigit",
  "validateSsccCheckDigit"
];

const QRCODE_STATIC_METHODS = [
  "analyzeSegments",
  "appendGtinCheckDigit",
  "appendSsccCheckDigit",
  "calculateGs1CheckDigit",
  "calculateGtinCheckDigit",
  "calculateSsccCheckDigit",
  "calculateStructuredAppendParity",
  "calculateStructuredAppendSegmentsParity",
  "createGs1DigitalLink",
  "createGs1ElementString",
  "drawToCanvas",
  "estimate",
  "generate",
  "generateSegments",
  "generateSegmentsStructuredAppend",
  "generateStructuredAppend",
  "getCapacity",
  "getGs1AiInfo",
  "getSupportedGs1Ais",
  "mergeStructuredAppendParts",
  "normalizeGs1DigitalLink",
  "parseGs1DigitalLink",
  "parseGs1ElementString",
  "parseGs1HumanReadable",
  "validateGs1CheckDigit",
  "validateGs1DigitalLink",
  "validateGs1ElementString",
  "validateGs1Elements",
  "validateGtinCheckDigit",
  "validateSsccCheckDigit"
];

function hash(value) {
  const data = value instanceof Uint8Array
    ? value
    : typeof value === "string"
      ? value
      : JSON.stringify(value);
  return createHash("sha256").update(data).digest("hex");
}

function asV2ManualSummary(diagnostics) {
  const {
    splitUnitCount: _splitUnitCount,
    splitUnitsDetail: _splitUnitsDetail,
    ...v2Summary
  } = diagnostics;
  return v2Summary;
}

function matrixRows(matrix) {
  return matrix.map((row) => row.map((module) => module ? "1" : "0").join(""));
}

test("architecture characterization fixes the public export surface", () => {
  assert.deepEqual(Object.keys(SpecQR).sort(), PUBLIC_EXPORTS);
  assert.deepEqual(
    Object.getOwnPropertyNames(SpecQR.QRCode)
      .filter((name) => !["length", "name", "prototype"].includes(name))
      .sort(),
    QRCODE_STATIC_METHODS
  );
});

test("architecture characterization fixes single-symbol outputs and diagnostics", () => {
  const matrix = SpecQR.generate(SINGLE_INPUT, {
    ...SINGLE_OPTIONS,
    output: "matrix"
  });
  const rows = matrixRows(matrix);
  assert.equal(matrix.length, 37);
  assert.equal(
    hash(matrix),
    "708fb836f07d991fa8e5beaeb6f529c4dfe65324a30dce8b1fbb756f766fb947"
  );
  assert.equal(rows[0], "1111111000100011000100101001101111111");
  assert.equal(rows.at(-1), "1111111000000011000101100000100110001");

  const svg = SpecQR.generate(SINGLE_INPUT, {
    ...SINGLE_OPTIONS,
    output: "svg"
  });
  assert.equal(svg.length, 10109);
  assert.equal(
    hash(svg),
    "4023cf6876a537a45a47a36bf9a25f3c050f5ac1c3926d3dfaaf2250fedaeaa8"
  );

  const svgDataUrl = SpecQR.generate(SINGLE_INPUT, {
    ...SINGLE_OPTIONS,
    output: "svg-data-url"
  });
  assert.equal(svgDataUrl.length, 11648);
  assert.equal(
    hash(svgDataUrl),
    "a8fb1c79465bc80440a66b55d773f9b0ee9a39c6e4f84ba110705f2e172b71f1"
  );

  const png = SpecQR.generate(SINGLE_INPUT, {
    ...SINGLE_OPTIONS,
    output: "png"
  });
  assert.equal(png.length, 73108);
  assert.equal(
    hash(png),
    "306970642602ff559febdd5002edc48f4d10b7c263e9e32f6d435ad82667a543"
  );

  const pngDataUrl = SpecQR.generate(SINGLE_INPUT, {
    ...SINGLE_OPTIONS,
    output: "png-data-url"
  });
  assert.equal(pngDataUrl.length, 97502);
  assert.equal(
    hash(pngDataUrl),
    "68a551da32a85223071ea95d91855ec6c1769be58e94651f70a75ae79977b0f3"
  );

  const detailed = SpecQR.generate(SINGLE_INPUT, {
    ...SINGLE_OPTIONS,
    output: "svg",
    diagnostics: true
  });
  assert.equal(hash(detailed.matrix), hash(matrix));
  assert.equal(hash(detailed.svg), hash(svg));
  assert.equal(
    hash(detailed.diagnostics),
    "362c6c7f29efa517fc6fefc4d37334a389dde00643e32365453c9b47bede94e4"
  );
  assert.deepEqual(detailed.diagnostics.maskPenalties, [{ maskPattern: 3, penalty: 1056 }]);
  assert.deepEqual(
    detailed.diagnostics.segments.map(({ mode, characterCount, byteCount, bitLength }) => ({
      mode,
      characterCount,
      byteCount,
      bitLength
    })),
    [
      { mode: "alphanumeric", characterCount: 11, byteCount: 11, bitLength: 74 },
      { mode: "byte", characterCount: 5, byteCount: 5, bitLength: 52 }
    ]
  );
});

test("architecture characterization fixes planning results", () => {
  const estimate = SpecQR.estimate(SINGLE_INPUT, {
    ...SINGLE_OPTIONS,
    output: "png",
    margin: 2,
    scale: 2,
    printDpi: 600
  });
  assert.equal(
    hash(estimate),
    "f50ec2b53a3ae0a3c9afe70d2f68232f683f62978eb53cbe0f4b0721c9948c4c"
  );
  assert.deepEqual(
    estimate.warnings.map((warning) => warning.code),
    ["QUIET_ZONE_TOO_SMALL", "PRINT_MODULE_TOO_SMALL", "SCAN_RISK"]
  );

  const overflow = SpecQR.estimate("a".repeat(100), {
    version: 1,
    errorCorrectionLevel: "H",
    mode: "byte",
    output: "matrix"
  });
  assert.equal(
    hash(overflow),
    "9ade3c0101aeb4b102e24d6a4f25b0bbd3a38e74357210fbbf6fb3f5bf224460"
  );
  assert.equal(overflow.ok, false);
  assert.deepEqual(overflow.warnings, []);

  const manual = SpecQR.analyzeSegments([
    { mode: "eci", assignmentNumber: 26 },
    { mode: "alphanumeric", data: "ORDER-" },
    { mode: "numeric", data: "1234567890" },
    { mode: "byte", data: "é" }
  ], {
    version: 4,
    errorCorrectionLevel: "Q",
    maskPattern: 2,
    output: "svg"
  });
  assert.equal(
    hash(manual),
    "dd12c29e933df19b2edc41aad0dd409cbef265adbdbd2872610a8a675c24740f"
  );
});

test("architecture characterization fixes GS1 and Digital Link results", () => {
  const elements = [
    { ai: "01", value: "04912345678904" },
    { ai: "10", value: "LOT-42" },
    { ai: "17", value: "251231" }
  ];
  const raw = SpecQR.createGs1ElementString(elements);
  assert.equal(raw, "010491234567890410LOT-42\u001d17251231");
  assert.deepEqual(SpecQR.parseGs1ElementString(raw), {
    elements,
    hasSeparators: true
  });
  assert.deepEqual(
    SpecQR.parseGs1HumanReadable("(01)04912345678904(10)LOT-42(17)251231"),
    elements
  );

  const uri = SpecQR.createGs1DigitalLink(elements, {
    baseUrl: "https://id.gs1.org"
  });
  assert.equal(uri, "https://id.gs1.org/01/04912345678904/10/LOT-42?17=251231");
  assert.equal(SpecQR.normalizeGs1DigitalLink(uri), uri);
  assert.deepEqual(SpecQR.parseGs1DigitalLink(uri), {
    elements,
    primary: elements[0],
    pathElements: elements.slice(0, 2),
    queryElements: elements.slice(2),
    unknownQuery: []
  });
});

test("architecture characterization fixes Structured Append outputs and summaries", () => {
  const raw = SpecQR.generateStructuredAppend("a".repeat(30), {
    version: 1,
    errorCorrectionLevel: "L",
    mode: "byte",
    maskPattern: 0,
    margin: 4,
    scale: 2,
    output: "svg"
  });
  assert.equal(raw.total, 2);
  assert.equal(raw.parity, 0);
  assert.deepEqual(raw.symbols.map(hash), [
    "0f490be0f259ab4904ef8393c2b87bad54dd003a44a25a04737a97a9a3c14f16",
    "cb408e91af2b477ce07a935fa721bfe7595bf5516b1611c18a711c3e3476dc5d"
  ]);
  assert.equal(
    hash(raw.diagnostics),
    "e1a79c19511eae8089c171beffd6d40b8551b859cb1f9ed09011620277024d0c"
  );

  const manual = SpecQR.generateSegmentsStructuredAppend([
    { mode: "alphanumeric", data: "HEAD-" },
    { mode: "byte", data: new Uint8Array(30).fill(0x61) }
  ], {
    version: 1,
    errorCorrectionLevel: "L",
    maskPattern: 1,
    margin: 4,
    scale: 2,
    output: "png",
    diagnostics: {
      splitUnits: "full",
      symbolResults: "output"
    }
  });
  assert.equal(manual.total, 3);
  assert.equal(manual.parity, 37);
  assert.deepEqual(manual.symbols.map(hash), [
    "1c7ac5f75041b851d417b26ad1e94dd151cc24195fb6ed683b67cf6401db05cd",
    "7371f522ef75f4c7053de3e81685d002bda7c6692393b6ccf503a0774cdb295b",
    "f64a28dc15ca6441bc77a9691f54bf32c924d74f616b7860542f8b797c9113a2"
  ]);
  assert.equal(
    hash(asV2ManualSummary(manual.diagnostics)),
    "917f9cbddf6d74779402794490044f3163e63978636a89234bdfcc16ddf8b78d"
  );
});

test("architecture characterization fixes canvas drawing and representative errors", () => {
  const calls = [];
  const context = {
    fillStyle: "",
    fillRect(...args) {
      calls.push([this.fillStyle, ...args]);
    }
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext(type) {
      assert.equal(type, "2d");
      return context;
    }
  };
  const result = SpecQR.drawToCanvas(canvas, "CANVAS", {
    version: 1,
    errorCorrectionLevel: "M",
    maskPattern: 2,
    scale: 2,
    margin: 4
  });
  assert.equal(result, canvas);
  assert.deepEqual([canvas.width, canvas.height, calls.length], [58, 58, 235]);
  assert.equal(
    hash(calls),
    "6a62e17a527c8a5d3f8af0aed49f7b1003a25991900d956a35e69d1660e578fe"
  );

  const cases = [
    {
      run: () => SpecQR.generate("a".repeat(100), {
        version: 1,
        errorCorrectionLevel: "H",
        mode: "byte",
        output: "matrix"
      }),
      type: SpecQR.DataTooLongError,
      code: "DATA_TOO_LONG",
      message: "Input requires at least 812 bits, but version 1-H has 72 data bits"
    },
    {
      run: () => SpecQR.generate("abc", { mode: "numeric" }),
      type: SpecQR.InvalidModeError,
      code: "INVALID_MODE",
      message: "numeric mode can only encode decimal digits 0-9"
    },
    {
      run: () => SpecQR.generate("A", {
        output: "png",
        scale: Number.MAX_SAFE_INTEGER
      }),
      type: SpecQR.InvalidInputError,
      code: "INVALID_INPUT",
      message: "Render geometry for png is not a non-negative safe integer: dimension"
    },
    {
      run: () => SpecQR.drawToCanvas(null, "A"),
      type: SpecQR.InvalidCanvasTargetError,
      code: "INVALID_CANVAS_TARGET",
      message: "drawToCanvas target is required"
    },
    {
      run: () => SpecQR.generate("(01)04912345678904", { gs1: true }),
      type: SpecQR.InvalidGs1Error,
      code: "INVALID_GS1",
      message: "GS1 element string input must be raw data without human-readable parentheses; use parseGs1HumanReadable() and createGs1ElementString() before generate(..., { gs1: true })"
    }
  ];

  for (const item of cases) {
    assert.throws(item.run, (error) => {
      assert.equal(error instanceof item.type, true);
      assert.equal(error.name, item.type.name);
      assert.equal(error.code, item.code);
      assert.equal(error.message, item.message);
      return true;
    });
  }
});
