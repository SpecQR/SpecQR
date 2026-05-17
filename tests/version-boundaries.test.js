import test from "node:test";
import assert from "node:assert/strict";
import { getDataCodewordCount } from "../src/core/tables.js";
import {
  createSegments,
  getSegmentsBitLength,
  normalizeManualSegments
} from "../src/encoding/modes.js";
import { DataTooLongError, generate, generateSegments } from "../src/index.js";

const MODES = ["numeric", "alphanumeric", "byte", "kanji"];
const VERSION_BOUNDARIES = [9, 10, 26, 27];
const CAPACITY_EDGE_VERSIONS = [9, 10, 26, 27, 40];
const CAPACITY_LEVEL = "H";
const EXPECTED_EXACT_FIT_CASES = new Set([
  "numeric-v10",
  "kanji-v10",
  "numeric-v40",
  "kanji-v40"
]);

test("character count indicator widths change at version range boundaries", () => {
  for (const mode of MODES) {
    const count = sampleCount(mode);
    const payload = payloadForMode(mode, count);

    for (const version of VERSION_BOUNDARIES) {
      const expectedBits = expectedSegmentBitLength(mode, count, version);
      const segment = segmentForBitLength(mode, payload);
      const manualSegment = manualSegmentForMode(mode, payload);
      const generated = generate(payload, {
        version,
        errorCorrectionLevel: "L",
        mode,
        output: "matrix",
        diagnostics: true
      });
      const manual = generateSegments([manualSegment], {
        version,
        errorCorrectionLevel: "L",
        output: "matrix",
        diagnostics: true
      });

      assert.equal(getSegmentsBitLength([segment], version), expectedBits, `${mode} v${version} bit length`);
      assert.equal(generated.diagnostics.dataBitLength, expectedBits, `${mode} v${version} diagnostics`);
      assert.equal(manual.diagnostics.dataBitLength, expectedBits, `${mode} v${version} manual diagnostics`);
      assert.equal(generated.diagnostics.capacityBits, getDataCodewordCount(version, "L") * 8);
      assert.equal(manual.diagnostics.capacityBits, generated.diagnostics.capacityBits);
      assert.equal(
        generated.diagnostics.remainingBits,
        generated.diagnostics.capacityBits - expectedBits
      );
      assert.equal(
        manual.diagnostics.remainingBits,
        manual.diagnostics.capacityBits - expectedBits
      );
    }
  }

  assertCountIndicatorDelta("numeric", 9, 10, 2);
  assertCountIndicatorDelta("numeric", 26, 27, 2);
  assertCountIndicatorDelta("alphanumeric", 9, 10, 2);
  assertCountIndicatorDelta("alphanumeric", 26, 27, 2);
  assertCountIndicatorDelta("byte", 9, 10, 8);
  assertCountIndicatorDelta("byte", 26, 27, 0);
  assertCountIndicatorDelta("kanji", 9, 10, 2);
  assertCountIndicatorDelta("kanji", 26, 27, 2);
});

test("fixed-version capacity edges accept max payloads and reject one unit too many", () => {
  for (const version of CAPACITY_EDGE_VERSIONS) {
    for (const mode of MODES) {
      const maxCount = maxFittingCount(mode, version, CAPACITY_LEVEL);
      const payload = payloadForMode(mode, maxCount);
      const tooLongPayload = payloadForMode(mode, maxCount + 1);
      const expectedBits = expectedSegmentBitLength(mode, maxCount, version);
      const capacityBits = getDataCodewordCount(version, CAPACITY_LEVEL) * 8;
      const generated = generate(payload, {
        version,
        errorCorrectionLevel: CAPACITY_LEVEL,
        mode,
        output: "matrix",
        diagnostics: true
      });
      const manual = generateSegments([manualSegmentForMode(mode, payload)], {
        version,
        errorCorrectionLevel: CAPACITY_LEVEL,
        output: "matrix",
        diagnostics: true
      });

      assert.equal(generated.diagnostics.dataBitLength, expectedBits, `${mode} v${version} data bits`);
      assert.equal(manual.diagnostics.dataBitLength, expectedBits, `${mode} v${version} manual data bits`);
      assert.equal(generated.diagnostics.capacityBits, capacityBits, `${mode} v${version} capacity`);
      assert.equal(manual.diagnostics.capacityBits, capacityBits, `${mode} v${version} manual capacity`);
      assert.equal(generated.diagnostics.remainingBits, capacityBits - expectedBits);
      assert.equal(manual.diagnostics.remainingBits, capacityBits - expectedBits);
      assert.ok(
        generated.diagnostics.remainingBits < nextUnitPayloadBits(mode, maxCount),
        `${mode} v${version} has no room for one more unit`
      );

      const exactKey = `${mode}-v${version}`;
      if (EXPECTED_EXACT_FIT_CASES.has(exactKey)) {
        assert.equal(generated.diagnostics.remainingBits, 0, `${exactKey} should exactly fill data capacity`);
      }

      assert.throws(
        () => generate(tooLongPayload, {
          version,
          errorCorrectionLevel: CAPACITY_LEVEL,
          mode,
          output: "matrix"
        }),
        (error) => error instanceof DataTooLongError && error.code === "DATA_TOO_LONG",
        `${mode} v${version} should reject max + 1`
      );
      assert.throws(
        () => generateSegments([manualSegmentForMode(mode, tooLongPayload)], {
          version,
          errorCorrectionLevel: CAPACITY_LEVEL,
          output: "matrix"
        }),
        (error) => error instanceof DataTooLongError && error.code === "DATA_TOO_LONG",
        `${mode} v${version} manual should reject max + 1`
      );
    }
  }
});

function assertCountIndicatorDelta(mode, beforeVersion, afterVersion, expectedDelta) {
  const count = sampleCount(mode);
  const before = expectedSegmentBitLength(mode, count, beforeVersion);
  const after = expectedSegmentBitLength(mode, count, afterVersion);
  assert.equal(after - before, expectedDelta, `${mode} ${beforeVersion}->${afterVersion}`);

  const payload = payloadForMode(mode, count);
  const beforeSegments = createSegments(payload, mode, beforeVersion, false, false);
  const afterSegments = createSegments(payload, mode, afterVersion, false, false);
  assert.equal(
    getSegmentsBitLength(afterSegments, afterVersion) -
      getSegmentsBitLength(beforeSegments, beforeVersion),
    expectedDelta,
    `${mode} ${beforeVersion}->${afterVersion} implementation delta`
  );
}

function maxFittingCount(mode, version, errorCorrectionLevel) {
  const capacityBits = getDataCodewordCount(version, errorCorrectionLevel) * 8;
  let count = 0;
  while (expectedSegmentBitLength(mode, count + 1, version) <= capacityBits) {
    count += 1;
  }
  return count;
}

function expectedSegmentBitLength(mode, count, version) {
  return 4 + characterCountBits(mode, version) + payloadBitLength(mode, count);
}

function characterCountBits(mode, version) {
  switch (mode) {
    case "numeric":
      return version <= 9 ? 10 : version <= 26 ? 12 : 14;
    case "alphanumeric":
      return version <= 9 ? 9 : version <= 26 ? 11 : 13;
    case "byte":
      return version <= 9 ? 8 : 16;
    case "kanji":
      return version <= 9 ? 8 : version <= 26 ? 10 : 12;
    default:
      throw new Error(`Unsupported mode in test: ${mode}`);
  }
}

function payloadBitLength(mode, count) {
  switch (mode) {
    case "numeric": {
      const remainder = count % 3;
      return Math.floor(count / 3) * 10 + (remainder === 1 ? 4 : remainder === 2 ? 7 : 0);
    }
    case "alphanumeric":
      return Math.floor(count / 2) * 11 + (count % 2) * 6;
    case "byte":
      return count * 8;
    case "kanji":
      return count * 13;
    default:
      throw new Error(`Unsupported mode in test: ${mode}`);
  }
}

function nextUnitPayloadBits(mode, currentCount) {
  return payloadBitLength(mode, currentCount + 1) - payloadBitLength(mode, currentCount);
}

function sampleCount(mode) {
  switch (mode) {
    case "numeric":
      return 7;
    case "alphanumeric":
      return 5;
    case "byte":
      return 3;
    case "kanji":
      return 2;
    default:
      throw new Error(`Unsupported mode in test: ${mode}`);
  }
}

function payloadForMode(mode, count) {
  switch (mode) {
    case "numeric":
      return "1".repeat(count);
    case "alphanumeric":
      return "A".repeat(count);
    case "byte":
      return Uint8Array.from({ length: count }, (_, index) => index & 0xff);
    case "kanji":
      return "漢".repeat(count);
    default:
      throw new Error(`Unsupported mode in test: ${mode}`);
  }
}

function segmentForBitLength(mode, payload) {
  if (mode === "byte") {
    return { mode: "byte", bytes: Array.from(payload) };
  }
  return { mode, text: payload };
}

function manualSegmentForMode(mode, payload) {
  const [segment] = normalizeManualSegments([{ mode, data: payload }]);
  return segment;
}
