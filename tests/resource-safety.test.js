import test from "node:test";
import assert from "node:assert/strict";

import {
  DataTooLongError,
  InvalidInputError,
  analyzeSegments,
  calculateStructuredAppendSegmentsParity,
  drawToCanvas,
  estimate,
  generate,
  generateSegments,
  generateSegmentsStructuredAppend,
  generateStructuredAppend,
  getCapacity
} from "../src/index.js";
import { toBlob, toImageData } from "../src/browser.js";
import { toPngBuffer } from "../src/node.js";
import { BitBuffer } from "../src/encoding/bit-buffer.js";
import { getRasterGeometry, RENDER_BUDGETS } from "../src/render/geometry.js";

const EXTREME_SCALE = Number.MAX_VALUE;
const GEOMETRY_ERROR = /^Render geometry for .+ (?:is not a non-negative safe integer|exceeds the deterministic budget):/;

test("renderer helpers reject unsafe geometry before allocation with stable errors", () => {
  for (const output of ["svg", "svg-data-url", "png", "png-data-url"]) {
    assertGeometryError(() => generate("A", { output, scale: EXTREME_SCALE }));
  }

  assertGeometryError(() => generate("A", {
    output: "matrix",
    diagnostics: true,
    scale: EXTREME_SCALE
  }));
  assertGeometryError(() => toBlob("A", { scale: EXTREME_SCALE }));
  assertGeometryError(() => toPngBuffer("A", { scale: EXTREME_SCALE }));

  const target = {
    width: 11,
    height: 13,
    fillRect() {},
    getContext() {
      return this;
    }
  };
  assertGeometryError(() => drawToCanvas(target, "A", { scale: EXTREME_SCALE }));
  assert.equal(target.width, 11);
  assert.equal(target.height, 13);
});

test("ImageData and raster geometry use the same deterministic budget", () => {
  const originalImageData = globalThis.ImageData;
  globalThis.ImageData = class ImageData {
    constructor(data, width, height) {
      this.data = data;
      this.width = width;
      this.height = height;
    }
  };

  try {
    assertGeometryError(() => toImageData("A", { scale: EXTREME_SCALE }));
  } finally {
    if (originalImageData === undefined) {
      delete globalThis.ImageData;
    } else {
      globalThis.ImageData = originalImageData;
    }
  }

  const matrix = Array.from({ length: 21 }, () => Array(21).fill(false));
  const withinBudget = getRasterGeometry(matrix, { margin: 4, scale: 70 }, "png");
  assert.equal(withinBudget.dimension, 2030);
  assert.ok(withinBudget.pixelCount <= RENDER_BUDGETS.rasterPixels);
  assertGeometryError(() => getRasterGeometry(matrix, { margin: 4, scale: 71 }, "png"));
});

test("matrix-only generation is not constrained by renderer geometry budgets", () => {
  const matrix = generate("A", { output: "matrix", scale: EXTREME_SCALE });
  assert.equal(matrix.length, 21);
});

test("manual Structured Append parity streams 150,000 bytes and respects view offsets", () => {
  const bytes = new Uint8Array(150_000);
  let expected = 0;
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = index % 251;
    expected ^= bytes[index];
  }

  assert.equal(
    calculateStructuredAppendSegmentsParity([{ mode: "byte", data: bytes }]),
    expected
  );

  const backing = new Uint8Array(bytes.length + 8);
  backing.fill(0xFF);
  backing.set(bytes, 4);
  const view = new DataView(backing.buffer, 4, bytes.length);
  assert.equal(
    calculateStructuredAppendSegmentsParity([{ mode: "byte", data: view }]),
    expected
  );
});

test("streaming manual parity preserves canonical text byte policies", () => {
  const segments = [
    { mode: "numeric", data: "12345" },
    { mode: "alphanumeric", data: "AB:$" },
    { mode: "byte", data: "é😀" },
    { mode: "kanji", data: "漢字" }
  ];
  const canonical = new Uint8Array([
    ...new TextEncoder().encode("12345"),
    ...new TextEncoder().encode("AB:$"),
    ...new TextEncoder().encode("é😀"),
    ...new TextEncoder().encode("漢字")
  ]);
  const expected = canonical.reduce((parity, byte) => parity ^ byte, 0);
  assert.equal(calculateStructuredAppendSegmentsParity(segments), expected);
});

test("capacity preflight preserves exact-fit edges across version ranges and modes", () => {
  for (const version of [9, 10, 26, 27]) {
    for (const mode of ["numeric", "alphanumeric", "byte", "kanji"]) {
      const capacity = getCapacity({ version, errorCorrectionLevel: "L", mode });
      const count = mode === "byte" ? capacity.maxBytes : capacity.maxCharacters;
      const value = createExactFitValue(mode, count);
      const options = {
        version,
        errorCorrectionLevel: "L",
        mode,
        output: "matrix",
        maskPattern: 0
      };
      assert.equal(generate(value, options).length, version * 4 + 17);
      assert.throws(
        () => generate(appendOneUnit(value, mode), options),
        DataTooLongError
      );
    }
  }
});

test("capacity preflight handles UTF-8, binary, manual segments, and control overhead", () => {
  const byteCapacity = getCapacity({
    version: 10,
    errorCorrectionLevel: "L",
    mode: "byte"
  }).maxBytes;
  const utf8 = `${"é".repeat(Math.floor(byteCapacity / 2))}${byteCapacity % 2 === 0 ? "" : "a"}`;
  assert.doesNotThrow(() => generate(utf8, {
    version: 10,
    errorCorrectionLevel: "L",
    mode: "byte",
    output: "matrix"
  }));
  assert.throws(() => generate(`${utf8}a`, {
    version: 10,
    errorCorrectionLevel: "L",
    mode: "byte",
    output: "matrix"
  }), DataTooLongError);

  const backing = new Uint8Array(byteCapacity + 4);
  const view = new DataView(backing.buffer, 2, byteCapacity);
  assert.doesNotThrow(() => generate(view, {
    version: "auto",
    minVersion: 10,
    maxVersion: 10,
    errorCorrectionLevel: "L",
    output: "matrix"
  }));
  assert.throws(() => generate(new Uint8Array(byteCapacity + 1), {
    version: 10,
    errorCorrectionLevel: "L",
    output: "matrix"
  }), DataTooLongError);

  assert.doesNotThrow(() => generateSegments([{ mode: "byte", data: view }], {
    version: 10,
    errorCorrectionLevel: "L",
    output: "matrix"
  }));
  assert.throws(() => generateSegments([{
    mode: "byte",
    data: new Uint8Array(byteCapacity + 1)
  }], {
    version: 10,
    errorCorrectionLevel: "L",
    output: "matrix"
  }), DataTooLongError);

  const eciCapacity = getCapacity({
    version: 10,
    errorCorrectionLevel: "L",
    mode: "byte",
    controlBits: 12
  }).maxBytes;
  assert.doesNotThrow(() => generate(new Uint8Array(eciCapacity), {
    version: 10,
    errorCorrectionLevel: "L",
    eci: true,
    output: "matrix"
  }));
  assert.throws(() => generate(new Uint8Array(eciCapacity + 1), {
    version: 10,
    errorCorrectionLevel: "L",
    eci: true,
    output: "matrix"
  }), DataTooLongError);
});

test("Structured Append constructs each final symbol core exactly once", () => {
  const originalToBytes = BitBuffer.prototype.toBytes;
  let calls = 0;
  BitBuffer.prototype.toBytes = function countedToBytes(...args) {
    calls += 1;
    return originalToBytes.apply(this, args);
  };

  try {
    const automatic = generateStructuredAppend("a".repeat(30), {
      version: 1,
      errorCorrectionLevel: "L",
      mode: "byte",
      output: "matrix"
    });
    assert.equal(calls, automatic.total);

    calls = 0;
    const manual = generateSegmentsStructuredAppend([
      { mode: "byte", data: "a".repeat(30) }
    ], {
      version: 1,
      errorCorrectionLevel: "L",
      output: "matrix"
    });
    assert.equal(calls, manual.total);
  } finally {
    BitBuffer.prototype.toBytes = originalToBytes;
  }
});

test("Structured Append matrix output does not render an unused SVG", () => {
  const result = generateStructuredAppend("a".repeat(30), {
    version: 1,
    errorCorrectionLevel: "L",
    mode: "byte",
    output: "matrix",
    scale: EXTREME_SCALE
  });
  assert.equal(result.symbols.length, result.total);
  assert.ok(result.symbols.every((matrix) => Array.isArray(matrix)));
});

test("Structured Append single-pass artifacts preserve SVG and PNG bytes", () => {
  const input = "a".repeat(30);
  for (const output of ["svg", "png"]) {
    const options = {
      version: 1,
      errorCorrectionLevel: "L",
      mode: "byte",
      maskPattern: 0,
      margin: 4,
      scale: 2,
      output
    };
    const result = generateStructuredAppend(input, options);
    result.diagnostics.symbols.forEach((symbol, index) => {
      const chunk = input.slice(
        symbol.inputStart,
        symbol.inputStart + symbol.inputLength
      );
      const expected = generate(chunk, {
        ...options,
        structuredAppend: {
          index: index + 1,
          total: result.total,
          parity: result.parity
        }
      });
      if (output === "png") {
        assert.deepEqual(result.symbols[index], expected);
      } else {
        assert.equal(result.symbols[index], expected);
      }
    });
  }
});

test("Structured Append diagnostics preserve matrix-mode warning semantics", () => {
  const result = generateStructuredAppend("a".repeat(30), {
    version: 1,
    errorCorrectionLevel: "L",
    mode: "byte",
    output: "png",
    scale: 1,
    diagnostics: true
  });
  for (const symbol of result.symbols) {
    assert.ok(!symbol.diagnostics.warnings.some(
      ({ code }) => code === "RASTER_SCALE_SMALL"
    ));
  }
});

test("overflow planning results omit success-only capacity warnings", () => {
  const fixed = estimate("a".repeat(100), {
    version: 1,
    errorCorrectionLevel: "H",
    mode: "byte"
  });
  assert.equal(fixed.ok, false);
  assert.ok(fixed.remainingBits < 0);
  assert.ok(!fixed.warnings.some(({ code }) => code === "CAPACITY_NEAR_LIMIT"));
  assert.ok(!fixed.warnings.some(({ code }) => code === "SCAN_RISK"));

  const ranged = estimate("a".repeat(100), {
    minVersion: 1,
    maxVersion: 2,
    errorCorrectionLevel: "H",
    mode: "byte"
  });
  assert.equal(ranged.ok, false);
  assert.ok(!ranged.warnings.some(({ code }) => code === "CAPACITY_NEAR_LIMIT"));

  const manual = analyzeSegments([{ mode: "byte", data: "a".repeat(100) }], {
    version: 1,
    errorCorrectionLevel: "H"
  });
  assert.equal(manual.ok, false);
  assert.ok(!manual.warnings.some(({ code }) => code === "CAPACITY_NEAR_LIMIT"));

  const nearLimit = estimate("a".repeat(17), {
    version: 1,
    errorCorrectionLevel: "L",
    mode: "byte"
  });
  assert.equal(nearLimit.ok, true);
  assert.ok(nearLimit.warnings.some(({ code }) => code === "CAPACITY_NEAR_LIMIT"));
});

function assertGeometryError(callback) {
  assert.throws(callback, (error) => {
    assert.ok(error instanceof InvalidInputError);
    assert.equal(error.code, "INVALID_INPUT");
    assert.match(error.message, GEOMETRY_ERROR);
    return true;
  });
}

function createExactFitValue(mode, count) {
  switch (mode) {
    case "numeric":
      return "1".repeat(count);
    case "alphanumeric":
      return "A".repeat(count);
    case "byte":
      return new Uint8Array(count);
    case "kanji":
      return "漢".repeat(count);
    default:
      throw new Error(`unsupported test mode ${mode}`);
  }
}

function appendOneUnit(value, mode) {
  if (mode === "byte") {
    const next = new Uint8Array(value.length + 1);
    next.set(value);
    return next;
  }
  return `${value}${mode === "kanji" ? "漢" : mode === "numeric" ? "1" : "A"}`;
}
