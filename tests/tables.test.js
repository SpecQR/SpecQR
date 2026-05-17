import test from "node:test";
import assert from "node:assert/strict";
import {
  getAlignmentPatternPositions,
  getDataCodewordCount,
  getRawCodewordCount,
  getSize
} from "../src/core/tables.js";

test("QR symbol size follows Model 2 version growth", () => {
  assert.equal(getSize(1), 21);
  assert.equal(getSize(40), 177);
});

test("raw and data codeword counts match common version 1 values", () => {
  assert.equal(getRawCodewordCount(1), 26);
  assert.equal(getDataCodewordCount(1, "L"), 19);
  assert.equal(getDataCodewordCount(1, "M"), 16);
  assert.equal(getDataCodewordCount(1, "Q"), 13);
  assert.equal(getDataCodewordCount(1, "H"), 9);
});

test("alignment pattern positions are generated for larger versions", () => {
  assert.deepEqual(getAlignmentPatternPositions(1), []);
  assert.deepEqual(getAlignmentPatternPositions(2), [6, 18]);
  assert.deepEqual(getAlignmentPatternPositions(7), [6, 22, 38]);
});
