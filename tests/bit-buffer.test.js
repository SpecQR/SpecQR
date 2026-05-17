import test from "node:test";
import assert from "node:assert/strict";
import { BitBuffer } from "../src/encoding/bit-buffer.js";

test("BitBuffer appends values most-significant bit first", () => {
  const buffer = new BitBuffer();
  buffer.append(0b101, 3);
  buffer.append(0b01100001, 8);

  assert.equal(buffer.length, 11);
  assert.deepEqual(
    Array.from({ length: 11 }, (_, index) => buffer.getBit(index) ? 1 : 0),
    [1, 0, 1, 0, 1, 1, 0, 0, 0, 0, 1]
  );
});

test("BitBuffer converts byte-aligned bits to bytes", () => {
  const buffer = new BitBuffer();
  buffer.append(0xAB, 8);
  buffer.append(0xCD, 8);

  assert.deepEqual(buffer.toBytes(), [0xAB, 0xCD]);
});
