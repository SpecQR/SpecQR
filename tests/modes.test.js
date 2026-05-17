import test from "node:test";
import assert from "node:assert/strict";
import {
  createSegments,
  getModeBitLength,
  getSegmentsBitLength,
  isAlphanumeric,
  isKanji,
  isNumeric,
  selectEncodingMode
} from "../src/encoding/modes.js";

test("detects numeric and QR alphanumeric character sets", () => {
  assert.equal(isNumeric("0123456789"), true);
  assert.equal(isNumeric("123A"), false);
  assert.equal(isAlphanumeric("HELLO WORLD 123 $%*+-./:"), true);
  assert.equal(isAlphanumeric("hello"), false);
  assert.equal(isKanji("こんにちは漢字"), true);
  assert.equal(isKanji("😀"), false);
});

test("auto mode chooses the most compact whole-input mode", () => {
  assert.equal(selectEncodingMode("1234567890", "auto"), "numeric");
  assert.equal(selectEncodingMode("HELLO WORLD", "auto"), "alphanumeric");
  assert.equal(selectEncodingMode("こんにちは", "auto"), "kanji");
  assert.equal(selectEncodingMode("https://example.com", "auto"), "byte");
  assert.equal(selectEncodingMode("", "auto"), "byte");
});

test("mode bit lengths match QR grouping rules", () => {
  assert.equal(getModeBitLength("01234567", "numeric", 1), 4 + 10 + 27);
  assert.equal(getModeBitLength("HELLO", "alphanumeric", 1), 4 + 9 + 28);
  assert.equal(getModeBitLength("A", "byte", 1), 4 + 8 + 8);
  assert.equal(getModeBitLength("漢字", "kanji", 1), 4 + 8 + 26);
});

test("explicit modes reject incompatible input", () => {
  assert.throws(() => selectEncodingMode("ABC", "numeric"), /numeric mode/);
  assert.throws(() => selectEncodingMode("abc", "alphanumeric"), /alphanumeric mode/);
});

test("optimized segments split mixed byte and numeric input", () => {
  const text = "abc123456789012345678901234567890def";
  const optimized = createSegments(text, "auto", 1, true);
  const unoptimized = createSegments(text, "auto", 1, false);

  assert.deepEqual(
    optimized.map((segment) => segment.mode),
    ["byte", "numeric", "byte"]
  );
  assert.ok(getSegmentsBitLength(optimized, 1) < getSegmentsBitLength(unoptimized, 1));
});

test("optimized segments keep pure alphanumeric input as one segment", () => {
  const optimized = createSegments("HELLO WORLD 123", "auto", 1, true);

  assert.deepEqual(optimized, [{ mode: "alphanumeric", text: "HELLO WORLD 123" }]);
});

test("ECI is represented as a leading control segment", () => {
  const withoutEci = createSegments("こんにちは", "auto", 2, true, false);
  const withEci = createSegments("こんにちは", "auto", 2, true, 26);

  assert.deepEqual(withEci[0], { mode: "eci", assignmentNumber: 26 });
  assert.deepEqual(withoutEci, [{ mode: "kanji", text: "こんにちは" }]);
  assert.deepEqual(withEci.slice(1), [{ mode: "byte", text: "こんにちは" }]);
  assert.ok(getSegmentsBitLength(withEci, 2) > getSegmentsBitLength(withoutEci, 2));
});

test("ECI auto segmentation keeps non-ASCII text in byte mode", () => {
  const withEci = createSegments("こんにちは", "auto", 2, true, 26);

  assert.deepEqual(
    withEci.map((segment) => segment.mode),
    ["eci", "byte"]
  );
});

test("ECI assignment number widths follow QR encoding rules", () => {
  assert.equal(getSegmentsBitLength([{ mode: "eci", assignmentNumber: 26 }], 1), 12);
  assert.equal(getSegmentsBitLength([{ mode: "eci", assignmentNumber: 300 }], 1), 20);
  assert.equal(getSegmentsBitLength([{ mode: "eci", assignmentNumber: 20000 }], 1), 28);
});
