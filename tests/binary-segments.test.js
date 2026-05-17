import test from "node:test";
import assert from "node:assert/strict";
import {
  DataTooLongError,
  InvalidInputError,
  InvalidModeError,
  QRCode,
  generate,
  generateSegments
} from "../src/index.js";

test("generates byte-mode QR codes from Uint8Array input", () => {
  const input = new Uint8Array([0x00, 0x01, 0x02, 0xFF]);
  const result = generate(input, {
    output: "matrix",
    diagnostics: true
  });

  assert.equal(result.diagnostics.mode, "byte");
  assert.equal(result.diagnostics.inputBytes, 4);
  assert.deepEqual(
    result.diagnostics.segments.map((segment) => ({
      mode: segment.mode,
      characterCount: segment.characterCount,
      byteCount: segment.byteCount
    })),
    [{ mode: "byte", characterCount: 0, byteCount: 4 }]
  );
});

test("generates PNG bytes from ArrayBuffer input", () => {
  const bytes = new Uint8Array([0x41, 0x42, 0x43]);
  const png = QRCode.generate(bytes.buffer, {
    output: "png"
  });

  assert.ok(png instanceof Uint8Array);
  assert.deepEqual(Array.from(png.slice(0, 8)), [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
});

test("generates byte-mode QR codes from byte array input", () => {
  const result = generate([0x41, 0x42, 0x43], {
    output: "matrix",
    diagnostics: true
  });

  assert.equal(result.diagnostics.mode, "byte");
  assert.equal(result.diagnostics.inputBytes, 3);
});

test("ArrayBufferView input respects byteOffset and byteLength", () => {
  const backing = new Uint8Array([0x00, 0x41, 0x42, 0x43, 0xFF]);
  const view = new DataView(backing.buffer, 1, 3);
  const result = generate(view, {
    output: "matrix",
    diagnostics: true
  });

  assert.equal(result.diagnostics.inputBytes, 3);
  assert.equal(result.diagnostics.segments[0].byteCount, 3);
});

test("rejects non-byte modes for binary input", () => {
  assert.throws(
    () => generate(new Uint8Array([1, 2, 3]), { mode: "numeric" }),
    (error) => error instanceof InvalidModeError && error.code === "INVALID_MODE"
  );
});

test("manual segments preserve caller-selected modes", () => {
  const result = generateSegments([
    { mode: "alphanumeric", data: "ORDER-" },
    { mode: "numeric", data: "1234567890" },
    { mode: "byte", data: "-こんにちは" }
  ], {
    output: "matrix",
    diagnostics: true
  });

  assert.equal(result.diagnostics.mode, "mixed");
  assert.equal(result.diagnostics.inputBytes, 32);
  assert.deepEqual(
    result.diagnostics.segments.map((segment) => segment.mode),
    ["alphanumeric", "numeric", "byte"]
  );
  assert.ok(result.diagnostics.dataBitLength <= result.diagnostics.capacityBits);
});

test("manual byte segments accept binary data", () => {
  const result = QRCode.generateSegments([
    { mode: "byte", data: new Uint8Array([0xDE, 0xAD, 0xBE, 0xEF]) }
  ], {
    output: "matrix",
    diagnostics: true
  });

  assert.equal(result.diagnostics.mode, "byte");
  assert.equal(result.diagnostics.inputBytes, 4);
  assert.equal(result.diagnostics.segments[0].characterCount, 0);
  assert.equal(result.diagnostics.segments[0].byteCount, 4);
});

test("manual kanji segments are accepted", () => {
  const result = QRCode.generateSegments([
    { mode: "alphanumeric", data: "KANJI " },
    { mode: "kanji", data: "漢字" }
  ], {
    output: "matrix",
    diagnostics: true
  });

  assert.equal(result.diagnostics.mode, "mixed");
  assert.deepEqual(
    result.diagnostics.segments.map((segment) => segment.mode),
    ["alphanumeric", "kanji"]
  );
  assert.equal(result.diagnostics.segments[1].characterCount, 2);
  assert.equal(result.diagnostics.segments[1].byteCount, 4);
});

test("manual kanji segments reject unsupported characters", () => {
  assert.throws(
    () => QRCode.generateSegments([{ mode: "kanji", data: "😀" }]),
    (error) => error instanceof InvalidModeError && error.code === "INVALID_MODE"
  );
});

test("manual ECI segments are included in diagnostics", () => {
  const result = generateSegments([
    { mode: "eci", assignmentNumber: 26 },
    { mode: "byte", data: "こんにちは" }
  ], {
    output: "matrix",
    diagnostics: true
  });

  assert.equal(result.diagnostics.eciAssignmentNumber, 26);
  assert.deepEqual(
    result.diagnostics.segments.map((segment) => segment.mode),
    ["eci", "byte"]
  );
});

test("option ECI can prefix manual segments", () => {
  const result = generateSegments([
    { mode: "byte", data: "hello" }
  ], {
    eci: true,
    output: "matrix",
    diagnostics: true
  });

  assert.equal(result.diagnostics.eciAssignmentNumber, 26);
  assert.deepEqual(
    result.diagnostics.segments.map((segment) => segment.mode),
    ["eci", "byte"]
  );
});

test("public errors expose stable error codes", () => {
  assert.throws(
    () => generateSegments([{ mode: "byte", data: [0, 256] }]),
    (error) => error instanceof InvalidInputError && error.code === "INVALID_INPUT"
  );

  assert.throws(
    () => generate("a".repeat(100), { version: 1, errorCorrectionLevel: "H" }),
    (error) => error instanceof DataTooLongError && error.code === "DATA_TOO_LONG"
  );
});
