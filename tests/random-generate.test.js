import test from "node:test";
import assert from "node:assert/strict";
import { generate } from "../src/index.js";

const LEVELS = ["L", "M", "Q", "H"];
const ALPHABETS = [
  "0123456789",
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:",
  "https://example.com/path?q=123&lang=ja",
  "こんにちは世界QRコード"
];

test("deterministic random payloads produce internally consistent QR diagnostics", () => {
  const random = createRandom(0x5EC0DE);

  for (let index = 0; index < 80; index += 1) {
    const text = makePayload(random);
    const errorCorrectionLevel = LEVELS[Math.floor(random() * LEVELS.length)];
    const useEci = random() < 0.25 && /[^\x00-\x7F]/.test(text);
    const result = generate(text, {
      errorCorrectionLevel,
      eci: useEci,
      boostErrorCorrection: random() < 0.25,
      output: "matrix",
      diagnostics: true
    });

    const { diagnostics, matrix } = result;
    assert.equal(matrix.length, diagnostics.size);
    assert.equal(matrix[0].length, diagnostics.size);
    assert.equal(diagnostics.size, diagnostics.version * 4 + 17);
    assert.ok(diagnostics.version >= 1 && diagnostics.version <= 40);
    assert.ok(diagnostics.dataBitLength <= diagnostics.capacityBits);
    assert.equal(diagnostics.remainingBits, diagnostics.capacityBits - diagnostics.dataBitLength);
    assert.equal(diagnostics.inputBytes, new TextEncoder().encode(text).length);
    assert.ok(diagnostics.maskPattern >= 0 && diagnostics.maskPattern <= 7);
  }
});

function makePayload(random) {
  const alphabet = Array.from(ALPHABETS[Math.floor(random() * ALPHABETS.length)]);
  const length = 1 + Math.floor(random() * 90);
  let result = "";

  for (let i = 0; i < length; i += 1) {
    result += alphabet[Math.floor(random() * alphabet.length)];
  }

  return result;
}

function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}
