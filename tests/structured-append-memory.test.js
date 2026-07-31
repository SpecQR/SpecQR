import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import {
  DataTooLongError,
  InvalidInputError,
  generateSegmentsStructuredAppend,
  generateStructuredAppend,
  getCapacity
} from "../src/index.js";

function hashMatrix(matrix) {
  const rows = matrix
    .map((row) => row.map((module) => module ? "1" : "0").join(""))
    .join("\n");
  return createHash("sha256").update(rows).digest("hex");
}

function hashJson(value) {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

function asV2ManualSummary(diagnostics) {
  const {
    splitUnitCount: _splitUnitCount,
    splitUnitsDetail: _splitUnitsDetail,
    ...v2Summary
  } = diagnostics;
  return v2Summary;
}

test("Structured Append memory refactor preserves UTF-8 and astral split output", () => {
  const result = generateStructuredAppend("ASCII-😀-漢字-é/".repeat(4), {
    version: 1,
    errorCorrectionLevel: "L",
    mode: "byte",
    maskPattern: 3,
    output: "matrix",
    diagnostics: true
  });

  assert.deepEqual(
    result.diagnostics.symbols.map(({ inputStart, inputLength, byteStart, byteLength }) => ({
      inputStart,
      inputLength,
      byteStart,
      byteLength
    })),
    [
      { inputStart: 0, inputLength: 9, byteStart: 0, byteLength: 14 },
      { inputStart: 9, inputLength: 10, byteStart: 14, byteLength: 13 },
      { inputStart: 19, inputLength: 7, byteStart: 27, byteLength: 15 },
      { inputStart: 26, inputLength: 9, byteStart: 42, byteLength: 14 },
      { inputStart: 35, inputLength: 10, byteStart: 56, byteLength: 13 },
      { inputStart: 45, inputLength: 7, byteStart: 69, byteLength: 15 }
    ]
  );
  assert.deepEqual(result.symbols.map(({ matrix }) => hashMatrix(matrix)), [
    "648a315f109ee59be06014150f4bf4b58a0081c8a5f079dcf42f06a561993858",
    "588ede71af3faaf976ebcad9971d526f83f56d540c6aad7e5c4affe49d515471",
    "817597fafee551680b06ed80d20d790fa641a818aec008f09270cc433a0226fe",
    "25f8b819b03606b445da5d37e2b068688c5df26727d0e216e73c08a6874415b0",
    "eff0e5b52a34a8b94c40345b63271701a481a2c0fc400c1a7e124cce16055ac3",
    "d7913e5ad31933fd4155266d4dcfeb92c8aed929715f5393419bbb47341836dc"
  ]);
  assert.equal(
    hashJson(result.diagnostics),
    "557c35ee642cc56fb249e4fd1a4dbc097622caa0a198acc5e8ee6159deef8096"
  );
});

test("Structured Append compact text source preserves auto segmentation", () => {
  const result = generateStructuredAppend(
    "ABC123é456漢字XYZ789😀".repeat(5),
    {
      version: 2,
      errorCorrectionLevel: "L",
      mode: "auto",
      optimizeSegments: true,
      maskPattern: 5,
      output: "matrix",
      diagnostics: true
    }
  );

  assert.deepEqual(
    result.diagnostics.symbols.map(
      ({ inputStart, inputLength, byteStart, byteLength }) => ({
        inputStart,
        inputLength,
        byteStart,
        byteLength
      })
    ),
    [
      { inputStart: 0, inputLength: 22, byteStart: 0, byteLength: 30 },
      { inputStart: 22, inputLength: 22, byteStart: 30, byteLength: 30 },
      { inputStart: 44, inputLength: 21, byteStart: 60, byteLength: 30 },
      { inputStart: 65, inputLength: 21, byteStart: 90, byteLength: 29 },
      { inputStart: 86, inputLength: 9, byteStart: 119, byteLength: 16 }
    ]
  );
  assert.equal(
    hashStructuredAppendMatrices(result),
    "900ef32f41307de58ae38867de34e7165cfc2306ecf8a959225a8be1727a044a"
  );
  assert.equal(
    hashJson(result.diagnostics),
    "6f7ee8ad772ded46858e5933ab509833fd5780f4a58af319e6c5a0e70a88fe95"
  );
});

test("Structured Append memory refactor preserves offset binary output", () => {
  const payload = Uint8Array.from(
    { length: 31 },
    (_, index) => index === 30 ? 0xff : index
  );
  const backing = Uint8Array.from([0xaa, ...payload, 0xbb]);
  const view = new DataView(backing.buffer, 1, payload.length);
  const result = generateStructuredAppend(view, {
    version: 1,
    errorCorrectionLevel: "L",
    mode: "byte",
    maskPattern: 2,
    output: "matrix",
    diagnostics: true
  });

  assert.deepEqual(
    result.diagnostics.symbols.map(({ inputStart, inputLength, byteStart, byteLength }) => ({
      inputStart,
      inputLength,
      byteStart,
      byteLength
    })),
    [
      { inputStart: 0, inputLength: 15, byteStart: 0, byteLength: 15 },
      { inputStart: 15, inputLength: 15, byteStart: 15, byteLength: 15 },
      { inputStart: 30, inputLength: 1, byteStart: 30, byteLength: 1 }
    ]
  );
  assert.deepEqual(result.symbols.map(({ matrix }) => hashMatrix(matrix)), [
    "3c5feb03bcddbc8650d15eb141460395ebf9b7a112de3cc5a159deea58277069",
    "35a68fbfe8aeadb5e743d76d2a18b3398f95660624beb18a8a604a0e2ba0edd0",
    "ecd0ba52b6675b588ae12c54fc22c70ec9117296cad7e02e7fc6939c6dd9debf"
  ]);
  assert.equal(
    hashJson(result.diagnostics),
    "f98b32aea4c97d9a8bad001cdb08785acf64feeb65ec603dd7dbbd9ab8747027"
  );
});

test("Structured Append memory refactor preserves mixed manual segment contracts", () => {
  const binary = Uint8Array.from({ length: 20 }, (_, index) => index);
  const backing = Uint8Array.from([0xaa, ...binary, 0xbb]);
  const result = generateSegmentsStructuredAppend([
    { mode: "numeric", data: "12345678901234567890" },
    { mode: "alphanumeric", data: "HELLO-WORLD-123" },
    { mode: "kanji", data: "漢字" },
    { mode: "byte", data: "é😀Z" },
    { mode: "byte", data: new Uint8Array(backing.buffer, 1, binary.length) }
  ], {
    version: 2,
    errorCorrectionLevel: "L",
    maskPattern: 4,
    output: "matrix",
    diagnostics: { splitUnits: "full" }
  });

  assert.equal(result.total, 2);
  assert.equal(result.parity, 80);
  assert.equal(result.inputLength, 5);
  assert.equal(result.byteLength, 68);
  assert.deepEqual(
    result.diagnostics.symbols.map((symbol) => ({
      sourceSegmentStart: symbol.sourceSegmentStart,
      sourceSegmentEnd: symbol.sourceSegmentEnd,
      splitUnitStart: symbol.splitUnitStart,
      splitUnitLength: symbol.splitUnitLength,
      byteStart: symbol.byteStart,
      byteLength: symbol.byteLength
    })),
    [
      {
        sourceSegmentStart: 0,
        sourceSegmentEnd: 4,
        splitUnitStart: 0,
        splitUnitLength: 4,
        byteStart: 0,
        byteLength: 43
      },
      {
        sourceSegmentStart: 3,
        sourceSegmentEnd: 5,
        splitUnitStart: 4,
        splitUnitLength: 22,
        byteStart: 43,
        byteLength: 25
      }
    ]
  );
  assert.deepEqual(result.symbols.map(({ matrix }) => hashMatrix(matrix)), [
    "31d6eea70892b4ae29c0f7a99f0dd54956c235dec21064310b896a88a9be13ed",
    "eac349a5e943097b26b22064306f9d6eec3db095559b0be7f963525f37b42523"
  ]);
  assert.equal(
    hashJson(asV2ManualSummary(result.diagnostics)),
    "bf94feb0818424afcf66e5b4b25ca23d9ae56151d72bdbe03f030913bfd13482"
  );
});

test("Structured Append two-symbol capacity edges cover version ranges and modes", () => {
  const cases = [
    { version: 9, mode: "numeric", make: (length) => "1".repeat(length) },
    { version: 10, mode: "alphanumeric", make: (length) => "A".repeat(length) },
    { version: 26, mode: "byte", make: (length) => new Uint8Array(length) },
    { version: 27, mode: "kanji", make: (length) => "漢".repeat(length) }
  ];

  for (const { version, mode, make } of cases) {
    const capacity = getCapacity({
      version,
      errorCorrectionLevel: "L",
      mode,
      controlBits: 20
    });
    const perSymbol = mode === "byte"
      ? capacity.maxBytes
      : capacity.maxCharacters;
    const options = {
      version,
      errorCorrectionLevel: "L",
      mode,
      maxSymbols: 2,
      output: "matrix"
    };

    const exact = generateStructuredAppend(make(perSymbol * 2), options);
    assert.equal(exact.total, 2, `version ${version} ${mode} exact fit`);
    assert.throws(
      () => generateStructuredAppend(make(perSymbol * 2 + 1), options),
      (error) => error instanceof DataTooLongError &&
        error.code === "DATA_TOO_LONG" &&
        error.message ===
          `Input cannot be split into 2 or fewer version ${version}-L Structured Append symbols`
    );
  }
});

test("manual byte Structured Append preserves exact fit and overflow contracts", () => {
  const version = 10;
  const perSymbol = getCapacity({
    version,
    errorCorrectionLevel: "L",
    mode: "byte",
    controlBits: 20
  }).maxBytes;
  const backing = new Uint8Array(perSymbol * 2 + 3);
  const exactView = new DataView(backing.buffer, 2, perSymbol * 2);
  const options = {
    version,
    errorCorrectionLevel: "L",
    maxSymbols: 2,
    output: "matrix"
  };

  const exact = generateSegmentsStructuredAppend([
    { mode: "byte", data: exactView }
  ], options);
  assert.equal(exact.total, 2);
  assert.deepEqual(
    exact.diagnostics.symbols.map(({ splitUnitLength, byteLength }) => ({
      splitUnitLength,
      byteLength
    })),
    [
      { splitUnitLength: perSymbol, byteLength: perSymbol },
      { splitUnitLength: perSymbol, byteLength: perSymbol }
    ]
  );

  assert.throws(
    () => generateSegmentsStructuredAppend([
      { mode: "byte", data: new Uint8Array(perSymbol * 2 + 1) }
    ], options),
    (error) => error instanceof DataTooLongError &&
      error.code === "DATA_TOO_LONG" &&
      error.message ===
        "Input segments cannot be split into 2 or fewer version 10-L Structured Append symbols"
  );
});

test("Structured Append keeps single-symbol and overflow error messages stable", () => {
  assert.throws(
    () => generateStructuredAppend("HELLO", {
      version: 1,
      errorCorrectionLevel: "L",
      mode: "alphanumeric"
    }),
    (error) => error instanceof InvalidInputError &&
      error.code === "INVALID_INPUT" &&
      error.message ===
        "Input fits in one version 1-L symbol; use generate() or the low-level structuredAppend option instead"
  );

  assert.throws(
    () => generateStructuredAppend(new Uint8Array(31), {
      version: 1,
      errorCorrectionLevel: "L",
      mode: "byte",
      maxSymbols: 2
    }),
    (error) => error instanceof DataTooLongError &&
      error.code === "DATA_TOO_LONG" &&
      error.message ===
        "Input cannot be split into 2 or fewer version 1-L Structured Append symbols"
  );

  assert.throws(
    () => generateSegmentsStructuredAppend([
      { mode: "byte", data: new Uint8Array(31) }
    ], {
      version: 1,
      errorCorrectionLevel: "L",
      maxSymbols: 2
    }),
    (error) => error instanceof DataTooLongError &&
      error.code === "DATA_TOO_LONG" &&
      error.message ===
        "Input segments cannot be split into 2 or fewer version 1-L Structured Append symbols"
  );
});

test("Structured Append preserves the 16-symbol byte boundary", () => {
  const version = 10;
  const perSymbol = getCapacity({
    version,
    errorCorrectionLevel: "L",
    mode: "byte",
    controlBits: 20
  }).maxBytes;
  const bytes = Uint8Array.from(
    { length: perSymbol * 16 },
    (_, index) => index % 251
  );
  const common = {
    version,
    errorCorrectionLevel: "L",
    maskPattern: 2,
    output: "matrix"
  };
  const raw = generateStructuredAppend(bytes, {
    ...common,
    mode: "byte",
    diagnostics: true
  });
  const manual = generateSegmentsStructuredAppend([
    { mode: "byte", data: bytes }
  ], {
    ...common,
    diagnostics: { splitUnits: "full" }
  });

  assert.equal(raw.total, 16);
  assert.equal(manual.total, 16);
  assert.equal(raw.parity, 223);
  assert.equal(manual.parity, 223);
  assert.equal(manual.diagnostics.splitUnits.length, bytes.length);
  assert.equal(
    hashStructuredAppendMatrices(raw),
    "4a9279af0a404571d64bc0cdb56eb0a660401a54974e98f42566c4536fca081b"
  );
  assert.equal(hashStructuredAppendMatrices(manual), hashStructuredAppendMatrices(raw));
  assert.equal(
    hashJson(raw.diagnostics),
    "559accecdfea813cad694648dfb53a470095f924da8b39c67bc549e7d66a6072"
  );
  assert.equal(
    hashJson(asV2ManualSummary(manual.diagnostics)),
    "330f27023599bea4ebdaca3b41033375b8f9d47dee89abc2f44d588ca4259bfa"
  );

  const overflow = new Uint8Array(bytes.length + 1);
  assert.throws(
    () => generateStructuredAppend(overflow, {
      ...common,
      mode: "byte",
      diagnostics: true
    }),
    (error) => error instanceof DataTooLongError &&
      error.code === "DATA_TOO_LONG" &&
      error.message ===
        "Input cannot be split into 16 or fewer version 10-L Structured Append symbols"
  );
  assert.throws(
    () => generateSegmentsStructuredAppend([
      { mode: "byte", data: overflow }
    ], {
      ...common,
      diagnostics: { splitUnits: "full" }
    }),
    (error) => error instanceof DataTooLongError &&
      error.code === "DATA_TOO_LONG" &&
      error.message ===
        "Input segments cannot be split into 16 or fewer version 10-L Structured Append symbols"
  );
});

test("Structured Append split exploration keeps compact internal sources", () => {
  const source = readFileSync(
    new URL("../src/internal/structured-append.js", import.meta.url),
    "utf8"
  );

  assert.match(source, /const TEXT_INDEX_STRIDE = 64;/);
  assert.match(source, /function createSparseTextIndex\(/);
  assert.match(source, /function createStructuredAppendSegmentDescriptor\(/);
  assert.match(source, /function materializeStructuredAppendSplitUnits\(/);
  assert.doesNotMatch(source, /Array\.from\(input\)/);
  assert.doesNotMatch(source, /Array\.from\(text\)/);
  assert.doesNotMatch(source, /byteLengths/);
  assert.doesNotMatch(source, /byteStarts/);
  assert.doesNotMatch(source, /splitUnits\.push/);
  assert.doesNotMatch(source, /canonicalBytes/);
});

function hashStructuredAppendMatrices(result) {
  return createHash("sha256")
    .update(result.symbols.flatMap(({ matrix }) =>
      matrix.map((row) => row.map(Number).join(""))
    ).join("\n"))
    .digest("hex");
}
