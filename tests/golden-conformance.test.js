import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { interleaveCodewords } from "../src/core/codewords.js";
import {
  encodeSegments,
  normalizeManualSegments,
  createSegments,
  prependEciSegment,
  prependFnc1Segment,
  prependFnc1SecondSegment,
  prependStructuredAppendSegment
} from "../src/encoding/modes.js";
import { generate, generateSegments } from "../src/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = JSON.parse(readFileSync(path.join(root, "fixtures", "golden-cases.json"), "utf8"));

test("golden fixtures cover representative QR Model 2 modes and metadata", () => {
  const coverage = new Set(fixtures.flatMap((fixture) => fixture.coverage));
  for (const item of [
    "numeric",
    "alphanumeric",
    "byte",
    "utf8",
    "kanji",
    "manual-segments",
    "eci",
    "binary",
    "version-info",
    "version-boundary-10",
    "version-boundary-27",
    "capacity-edge",
    "eci-mixed",
    "gs1",
    "fnc1",
    "fnc1-second",
    "structured-append"
  ]) {
    assert.equal(coverage.has(item), true, `missing golden coverage: ${item}`);
  }
});

for (const fixture of fixtures) {
  test(`golden conformance: ${fixture.id}`, () => {
    const result = generateFixture(fixture);
    const diagnostics = pickDiagnostics(result.diagnostics);
    const rows = matrixToRows(result.matrix);
    const codewords = getCodewords(fixture, diagnostics.version, diagnostics.errorCorrectionLevel);

    assert.deepEqual(diagnostics, fixture.expected.diagnostics);
    assert.deepEqual(toJsonValue(result.diagnostics.segments), fixture.expected.segments);
    assert.deepEqual(codewords.dataCodewords, fixture.expected.dataCodewords);
    assert.deepEqual(codewords.interleavedCodewords, fixture.expected.interleavedCodewords);
    assert.deepEqual(rows, fixture.expected.matrixRows);
    assert.equal(hashRows(rows), fixture.expected.matrixSha256);
    assert.equal(countDarkModules(result.matrix), fixture.expected.darkModules);

    assertFunctionPatterns(result.matrix, diagnostics.version);
    assertFormatInformation(result.matrix, diagnostics.errorCorrectionLevel, diagnostics.maskPattern, fixture.expected.formatBits);
    assertVersionInformation(result.matrix, diagnostics.version, fixture.expected.versionBits);

    const functionModuleCount = countFunctionModules(diagnostics.version);
    const dataModuleCount = diagnostics.size * diagnostics.size - functionModuleCount;
    const remainderBits = dataModuleCount - diagnostics.totalCodewords * 8;

    assert.equal(functionModuleCount, fixture.expected.functionModuleCount);
    assert.equal(dataModuleCount, fixture.expected.dataModuleCount);
    assert.equal(remainderBits, fixture.expected.remainderBits);
  });
}

function generateFixture(fixture) {
  const options = {
    ...fixture.options,
    output: "matrix",
    diagnostics: true
  };
  if (fixture.segments) {
    return generateSegments(fixture.segments, options);
  }
  return generate(getInput(fixture), options);
}

function getCodewords(fixture, version, errorCorrectionLevel) {
  const segments = getSegments(fixture, version);
  const dataCodewords = encodeSegments(segments, version, errorCorrectionLevel);
  const interleaved = interleaveCodewords(dataCodewords, version, errorCorrectionLevel);
  return {
    dataCodewords,
    interleavedCodewords: interleaved.codewords
  };
}

function getSegments(fixture, version) {
  const eciAssignmentNumber = normalizeEciOption(fixture.options.eci ?? false);
  const fnc1Second = fixture.options.fnc1Second ?? false;
  const structuredAppend = fixture.options.structuredAppend ?? false;
  if (fixture.segments) {
    return prependStructuredAppendSegment(
      prependFnc1SecondSegment(
        prependFnc1Segment(
          prependEciSegment(normalizeManualSegments(fixture.segments), eciAssignmentNumber),
          fixture.options.gs1 ?? false
        ),
        fnc1Second
      ),
      structuredAppend
    );
  }
  return prependStructuredAppendSegment(
    prependFnc1SecondSegment(
      prependFnc1Segment(
        createSegments(
          getInput(fixture),
          fixture.options.mode ?? "auto",
          version,
          fixture.options.optimizeSegments ?? true,
          eciAssignmentNumber
        ),
        fixture.options.gs1 ?? false
      ),
      fnc1Second
    ),
    structuredAppend
  );
}

function normalizeEciOption(value) {
  return value === true ? 26 : value;
}

function getInput(fixture) {
  return fixture.inputBytes ? Uint8Array.from(fixture.inputBytes) : fixture.input;
}

function pickDiagnostics(diagnostics) {
  return {
    version: diagnostics.version,
    size: diagnostics.size,
    errorCorrectionLevel: diagnostics.errorCorrectionLevel,
    requestedErrorCorrectionLevel: diagnostics.requestedErrorCorrectionLevel,
    boostedErrorCorrection: diagnostics.boostedErrorCorrection,
    versionSelection: diagnostics.versionSelection,
    maskPattern: diagnostics.maskPattern,
    maskPenalty: diagnostics.maskPenalty,
    maskPenalties: diagnostics.maskPenalties,
    mode: diagnostics.mode,
    controlSegments: diagnostics.controlSegments,
    eciAssignmentNumber: diagnostics.eciAssignmentNumber,
    fnc1: diagnostics.fnc1,
    fnc1Second: diagnostics.fnc1Second,
    structuredAppend: diagnostics.structuredAppend,
    gs1: diagnostics.gs1,
    dataBitLength: diagnostics.dataBitLength,
    capacityBits: diagnostics.capacityBits,
    remainingBits: diagnostics.remainingBits,
    inputBytes: diagnostics.inputBytes,
    dataCodewords: diagnostics.dataCodewords,
    errorCorrectionCodewords: diagnostics.errorCorrectionCodewords,
    totalCodewords: diagnostics.totalCodewords
  };
}

function toJsonValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function matrixToRows(matrix) {
  return matrix.map((row) => row.map((module) => module ? "1" : "0").join(""));
}

function hashRows(rows) {
  return createHash("sha256").update(rows.join("\n")).digest("hex");
}

function countDarkModules(matrix) {
  return matrix.reduce((total, row) => total + row.filter(Boolean).length, 0);
}

function assertFunctionPatterns(matrix, version) {
  const size = matrix.length;
  assertFinderPattern(matrix, 0, 0);
  assertFinderPattern(matrix, size - 7, 0);
  assertFinderPattern(matrix, 0, size - 7);
  assertTimingPatterns(matrix);
  assertAlignmentPatterns(matrix, version);
  assert.equal(matrix[size - 8][8], true, "dark module");
}

function assertFinderPattern(matrix, left, top) {
  for (let dy = 0; dy <= 6; dy += 1) {
    for (let dx = 0; dx <= 6; dx += 1) {
      const expected =
        dx === 0 || dx === 6 || dy === 0 || dy === 6 ||
        (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4);
      assert.equal(matrix[top + dy][left + dx], expected, `finder at ${left},${top}`);
    }
  }
}

function assertTimingPatterns(matrix) {
  const size = matrix.length;
  for (let i = 8; i < size - 8; i += 1) {
    const expected = i % 2 === 0;
    assert.equal(matrix[6][i], expected, `horizontal timing ${i}`);
    assert.equal(matrix[i][6], expected, `vertical timing ${i}`);
  }
}

function assertAlignmentPatterns(matrix, version) {
  const positions = alignmentPositions(version);
  const last = positions.length - 1;
  for (let yIndex = 0; yIndex < positions.length; yIndex += 1) {
    for (let xIndex = 0; xIndex < positions.length; xIndex += 1) {
      const overlapsFinder =
        (xIndex === 0 && yIndex === 0) ||
        (xIndex === last && yIndex === 0) ||
        (xIndex === 0 && yIndex === last);
      if (!overlapsFinder) {
        assertAlignmentPattern(matrix, positions[xIndex], positions[yIndex]);
      }
    }
  }
}

function assertAlignmentPattern(matrix, centerX, centerY) {
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      const distance = Math.max(Math.abs(dx), Math.abs(dy));
      assert.equal(matrix[centerY + dy][centerX + dx], distance !== 1, `alignment at ${centerX},${centerY}`);
    }
  }
}

function assertFormatInformation(matrix, errorCorrectionLevel, maskPattern, expected) {
  const expectedValue = computeFormatBits(errorCorrectionLevel, maskPattern);
  assert.equal(expected.value, expectedValue);
  assert.equal(expected.bits, toBinary(expectedValue, 15));
  assert.equal(readPrimaryFormatBits(matrix), expectedValue);
  assert.equal(readSecondaryFormatBits(matrix), expectedValue);
}

function readPrimaryFormatBits(matrix) {
  let bits = 0;
  for (let i = 0; i <= 5; i += 1) {
    bits |= Number(matrix[i][8]) << i;
  }
  bits |= Number(matrix[7][8]) << 6;
  bits |= Number(matrix[8][8]) << 7;
  bits |= Number(matrix[8][7]) << 8;
  for (let i = 9; i < 15; i += 1) {
    bits |= Number(matrix[8][14 - i]) << i;
  }
  return bits;
}

function readSecondaryFormatBits(matrix) {
  const size = matrix.length;
  let bits = 0;
  for (let i = 0; i < 8; i += 1) {
    bits |= Number(matrix[8][size - 1 - i]) << i;
  }
  for (let i = 8; i < 15; i += 1) {
    bits |= Number(matrix[size - 15 + i][8]) << i;
  }
  return bits;
}

function computeFormatBits(errorCorrectionLevel, maskPattern) {
  const formatBitsByLevel = { L: 0b01, M: 0b00, Q: 0b11, H: 0b10 };
  const data = (formatBitsByLevel[errorCorrectionLevel] << 3) | maskPattern;
  let remainder = data;
  for (let i = 0; i < 10; i += 1) {
    remainder = (remainder << 1) ^ (((remainder >>> 9) & 1) * 0x537);
  }
  return ((data << 10) | remainder) ^ 0x5412;
}

function assertVersionInformation(matrix, version, expected) {
  if (version < 7) {
    assert.equal(expected, null);
    return;
  }

  const expectedValue = computeVersionBits(version);
  assert.equal(expected.value, expectedValue);
  assert.equal(expected.bits, toBinary(expectedValue, 18));
  assert.equal(readTopRightVersionBits(matrix), expectedValue);
  assert.equal(readBottomLeftVersionBits(matrix), expectedValue);
}

function readTopRightVersionBits(matrix) {
  const size = matrix.length;
  let bits = 0;
  for (let i = 0; i < 18; i += 1) {
    const x = size - 11 + (i % 3);
    const y = Math.floor(i / 3);
    bits |= Number(matrix[y][x]) << i;
  }
  return bits;
}

function readBottomLeftVersionBits(matrix) {
  const size = matrix.length;
  let bits = 0;
  for (let i = 0; i < 18; i += 1) {
    const x = Math.floor(i / 3);
    const y = size - 11 + (i % 3);
    bits |= Number(matrix[y][x]) << i;
  }
  return bits;
}

function computeVersionBits(version) {
  let remainder = version;
  for (let i = 0; i < 12; i += 1) {
    remainder = (remainder << 1) ^ (((remainder >>> 11) & 1) * 0x1f25);
  }
  return (version << 12) | remainder;
}

function countFunctionModules(version) {
  const mask = createFunctionModuleMask(version);
  return mask.reduce((total, row) => total + row.filter(Boolean).length, 0);
}

function createFunctionModuleMask(version) {
  const size = version * 4 + 17;
  const mask = Array.from({ length: size }, () => new Array(size).fill(false));
  drawFinder(mask, 0, 0);
  drawFinder(mask, size - 7, 0);
  drawFinder(mask, 0, size - 7);
  drawTiming(mask);
  drawAlignment(mask, version);
  drawFormat(mask);
  set(mask, 8, size - 8);
  drawVersion(mask, version);
  return mask;
}

function drawFinder(mask, left, top) {
  for (let dy = -1; dy <= 7; dy += 1) {
    for (let dx = -1; dx <= 7; dx += 1) {
      set(mask, left + dx, top + dy);
    }
  }
}

function drawTiming(mask) {
  const size = mask.length;
  for (let i = 8; i < size - 8; i += 1) {
    set(mask, i, 6);
    set(mask, 6, i);
  }
}

function drawAlignment(mask, version) {
  const positions = alignmentPositions(version);
  const last = positions.length - 1;
  for (let yIndex = 0; yIndex < positions.length; yIndex += 1) {
    for (let xIndex = 0; xIndex < positions.length; xIndex += 1) {
      const overlapsFinder =
        (xIndex === 0 && yIndex === 0) ||
        (xIndex === last && yIndex === 0) ||
        (xIndex === 0 && yIndex === last);
      if (!overlapsFinder) {
        for (let dy = -2; dy <= 2; dy += 1) {
          for (let dx = -2; dx <= 2; dx += 1) {
            set(mask, positions[xIndex] + dx, positions[yIndex] + dy);
          }
        }
      }
    }
  }
}

function drawFormat(mask) {
  const size = mask.length;
  for (let i = 0; i <= 5; i += 1) {
    set(mask, 8, i);
  }
  set(mask, 8, 7);
  set(mask, 8, 8);
  set(mask, 7, 8);
  for (let i = 9; i < 15; i += 1) {
    set(mask, 14 - i, 8);
  }
  for (let i = 0; i < 8; i += 1) {
    set(mask, size - 1 - i, 8);
  }
  for (let i = 8; i < 15; i += 1) {
    set(mask, 8, size - 15 + i);
  }
}

function drawVersion(mask, version) {
  if (version < 7) {
    return;
  }
  const size = mask.length;
  for (let i = 0; i < 18; i += 1) {
    const a = size - 11 + (i % 3);
    const b = Math.floor(i / 3);
    set(mask, a, b);
    set(mask, b, a);
  }
}

function alignmentPositions(version) {
  switch (version) {
    case 1:
      return [];
    case 2:
      return [6, 18];
    case 3:
      return [6, 22];
    case 7:
      return [6, 22, 38];
    case 10:
      return [6, 28, 50];
    case 27:
      return [6, 34, 62, 90, 118];
    default:
      throw new Error(`Golden test helper does not define alignment positions for version ${version}`);
  }
}

function set(mask, x, y) {
  if (y >= 0 && y < mask.length && x >= 0 && x < mask.length) {
    mask[y][x] = true;
  }
}

function toBinary(value, width) {
  return value.toString(2).padStart(width, "0");
}
