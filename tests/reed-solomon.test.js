import test from "node:test";
import assert from "node:assert/strict";
import { multiply } from "../src/core/galois-field.js";
import { computeRemainder, createGeneratorPolynomial } from "../src/core/reed-solomon.js";

test("GF(256) multiplication follows the QR reduction polynomial", () => {
  assert.equal(multiply(0x53, 0xCA), 0x8F);
  assert.equal(multiply(0, 0xCA), 0);
  assert.equal(multiply(1, 0xCA), 0xCA);
});

test("Reed-Solomon generator polynomial has the requested degree", () => {
  const generator = createGeneratorPolynomial(7);
  assert.equal(generator.length, 8);
  assert.equal(generator[0], 1);
});

test("Reed-Solomon remainder length equals correction byte count", () => {
  const generator = createGeneratorPolynomial(10);
  const remainder = computeRemainder([32, 91, 11, 120, 209], generator);
  assert.equal(remainder.length, 10);
  assert.ok(remainder.every((value) => Number.isInteger(value) && value >= 0 && value <= 255));
});
