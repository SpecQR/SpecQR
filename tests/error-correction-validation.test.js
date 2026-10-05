import test from "node:test";
import assert from "node:assert/strict";
import {
  InvalidInputError,
  analyzeSegments,
  estimate,
  generate,
  generateSegments,
  generateSegmentsStructuredAppend,
  generateStructuredAppend,
  getCapacity
} from "../src/index.js";

const segments = [{ mode: "byte", data: "A" }];

test("inherited property names are not error correction levels", () => {
  for (const errorCorrectionLevel of ["constructor", "toString", "valueOf", "__proto__", "hasOwnProperty"]) {
    const options = { errorCorrectionLevel, version: 1, output: "matrix" };
    for (const run of [
      () => generate("A", options),
      () => estimate("A", options),
      () => generateSegments(segments, options),
      () => analyzeSegments(segments, options),
      () => generateStructuredAppend("A".repeat(50), options),
      () => generateSegmentsStructuredAppend(segments, options),
      () => getCapacity(options),
      () => getCapacity({ version: 1, errorCorrection: errorCorrectionLevel })
    ]) {
      assert.throws(run, (error) => error instanceof InvalidInputError && error.code === "INVALID_INPUT");
    }
  }
});

test("valid error correction values retain existing property-key coercion", () => {
  for (const level of ["L", "M", "Q", "H"]) {
    const matrix = generate("A", { errorCorrectionLevel: level, output: "matrix" });
    for (const coerced of [new String(level), [level], { toString: () => level }]) {
      assert.deepEqual(generate("A", { errorCorrectionLevel: coerced, output: "matrix" }), matrix);
      assert.equal(
        getCapacity({ version: 1, errorCorrectionLevel: coerced }).capacityBits,
        getCapacity({ version: 1, errorCorrectionLevel: level }).capacityBits
      );
    }
  }
});
