import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import qrcodegen from "nayuki-qr-code-generator";
import { generate, generateSegments } from "../src/index.js";

const ECC = {
  L: qrcodegen.QrCode.Ecc.LOW,
  M: qrcodegen.QrCode.Ecc.MEDIUM,
  Q: qrcodegen.QrCode.Ecc.QUARTILE,
  H: qrcodegen.QrCode.Ecc.HIGH
};

const encoder = new TextEncoder();

const CASES = [
  {
    id: "numeric-v1-l-mask0",
    description: "fixed numeric segment, version 1-L, mask 0",
    input: "01234567",
    specqrOptions: {
      mode: "numeric",
      version: 1,
      errorCorrectionLevel: "L",
      maskPattern: 0
    },
    referenceSegments: [
      qrcodegen.QrSegment.makeNumeric("01234567")
    ]
  },
  {
    id: "alphanumeric-v1-m-mask1",
    description: "fixed alphanumeric segment, version 1-M, mask 1",
    input: "HELLO WORLD",
    specqrOptions: {
      mode: "alphanumeric",
      version: 1,
      errorCorrectionLevel: "M",
      maskPattern: 1
    },
    referenceSegments: [
      qrcodegen.QrSegment.makeAlphanumeric("HELLO WORLD")
    ]
  },
  {
    id: "byte-v2-q-mask2",
    description: "fixed byte segment, version 2-Q, mask 2",
    input: "https://example.com",
    specqrOptions: {
      mode: "byte",
      version: 2,
      errorCorrectionLevel: "Q",
      maskPattern: 2
    },
    referenceSegments: [
      qrcodegen.QrSegment.makeBytes(toUtf8Bytes("https://example.com"))
    ]
  },
  {
    id: "manual-mixed-v3-q-mask5",
    description: "manual alphanumeric/numeric/byte segments, version 3-Q, mask 5",
    specqrSegments: [
      { mode: "alphanumeric", data: "HELLO " },
      { mode: "numeric", data: "1234567890" },
      { mode: "byte", data: "-web-" }
    ],
    specqrOptions: {
      version: 3,
      errorCorrectionLevel: "Q",
      maskPattern: 5
    },
    referenceSegments: [
      qrcodegen.QrSegment.makeAlphanumeric("HELLO "),
      qrcodegen.QrSegment.makeNumeric("1234567890"),
      qrcodegen.QrSegment.makeBytes(toUtf8Bytes("-web-"))
    ]
  },
  {
    id: "eci-utf8-byte-v2-q-mask6",
    description: "ECI 26 followed by UTF-8 byte segment, version 2-Q, mask 6",
    input: "こんにちは",
    specqrOptions: {
      mode: "byte",
      version: 2,
      errorCorrectionLevel: "Q",
      maskPattern: 6,
      eci: true
    },
    referenceSegments: [
      qrcodegen.QrSegment.makeEci(26),
      qrcodegen.QrSegment.makeBytes(toUtf8Bytes("こんにちは"))
    ]
  },
  {
    id: "binary-v1-q-mask7",
    description: "byte segment with 0x00 and 0xff, version 1-Q, mask 7",
    input: Uint8Array.from([0x00, 0x41, 0xff, 0x42, 0x00]),
    specqrOptions: {
      mode: "byte",
      version: 1,
      errorCorrectionLevel: "Q",
      maskPattern: 7
    },
    referenceSegments: [
      qrcodegen.QrSegment.makeBytes([0x00, 0x41, 0xff, 0x42, 0x00])
    ]
  }
];

const results = [];

for (const testCase of CASES) {
  const specqr = generateSpecqr(testCase);
  const reference = qrcodegen.QrCode.encodeSegments(
    testCase.referenceSegments,
    ECC[testCase.specqrOptions.errorCorrectionLevel],
    testCase.specqrOptions.version,
    testCase.specqrOptions.version,
    testCase.specqrOptions.maskPattern,
    false
  );

  const specqrRows = specqr.matrix.map(rowToString);
  const referenceRows = referenceRowsToStrings(reference);

  assert.equal(specqr.diagnostics.version, reference.version, `${testCase.id}: version`);
  assert.equal(specqr.diagnostics.size, reference.size, `${testCase.id}: size`);
  assert.equal(specqr.diagnostics.maskPattern, reference.mask, `${testCase.id}: mask`);
  assert.deepEqual(specqrRows, referenceRows, `${testCase.id}: matrix rows`);

  results.push({
    id: testCase.id,
    description: testCase.description,
    version: reference.version,
    errorCorrectionLevel: testCase.specqrOptions.errorCorrectionLevel,
    maskPattern: reference.mask,
    matrixSha256: hashRows(specqrRows)
  });
}

for (const result of results) {
  console.log(`ok reference:nayuki ${result.id} v${result.version}-${result.errorCorrectionLevel} mask${result.maskPattern} ${result.matrixSha256}`);
}
console.log(`ok reference:nayuki compared ${results.length}/${CASES.length} fixed-condition matrices`);

function generateSpecqr(testCase) {
  const options = {
    ...testCase.specqrOptions,
    output: "matrix",
    diagnostics: true
  };
  if (testCase.specqrSegments) {
    return generateSegments(testCase.specqrSegments, options);
  }
  return generate(testCase.input, options);
}

function toUtf8Bytes(text) {
  return Array.from(encoder.encode(text));
}

function rowToString(row) {
  return row.map(module => module ? "1" : "0").join("");
}

function referenceRowsToStrings(qr) {
  return Array.from({ length: qr.size }, (_, y) =>
    Array.from({ length: qr.size }, (_, x) => qr.getModule(x, y) ? "1" : "0").join("")
  );
}

function hashRows(rows) {
  return createHash("sha256").update(rows.join("\n")).digest("hex");
}
