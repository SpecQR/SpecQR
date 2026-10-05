import test from "node:test";
import assert from "node:assert/strict";
import {
  DataTooLongError,
  analyzeSegments,
  estimate,
  generate,
  generateSegments,
  parseGs1ElementString
} from "../src/index.js";
import { normalizeOptions } from "../src/options.js";
import { encodeSegments } from "../src/encoding/modes.js";
import { interleaveCodewords } from "../src/core/codewords.js";
import { selectPlanForInput } from "../src/internal/planning.js";

const fixed = { version: 2, errorCorrectionLevel: "L", maskPattern: 0, output: "matrix" };

function assertEncodedLike(input, options, expectedSegments) {
  const plan = selectPlanForInput(input, normalizeOptions({ ...fixed, ...options }));
  const expectedData = encodeSegments(expectedSegments, 2, "L");
  const actualData = encodeSegments(plan.segments, 2, "L");
  assert.deepEqual(actualData, expectedData);
  assert.deepEqual(
    interleaveCodewords(actualData, 2, "L").codewords,
    interleaveCodewords(expectedData, 2, "L").codewords
  );
  assert.deepEqual(
    generate(input, { ...fixed, ...options }),
    generateSegments(expectedSegments, fixed)
  );
  const result = generate(input, { ...fixed, ...options, diagnostics: true });
  const planned = estimate(input, { ...fixed, ...options });
  assert.equal(planned.ok, true);
  assert.equal(planned.dataBitLength, result.diagnostics.dataBitLength);
  assert.deepEqual(planned.segments, result.diagnostics.segments);
  assert.equal(result.diagnostics.inputBytes, new TextEncoder().encode(input).length);
  return result.diagnostics;
}

test("high-level FNC1 first/second escape literal percent only in alphanumeric segments", () => {
  for (const input of ["10ABC%DEF", "10ABC%%DEF", "10%ABC", "10ABC%", "10ABC%%%DEF"]) {
    for (const optimizeSegments of [true, false]) {
      for (const mode of ["auto", "alphanumeric"]) {
        const expected = [{ mode: "fnc1" }, { mode: "alphanumeric", text: input.replaceAll("%", "%%") }];
        assertEncodedLike(input, { gs1: true, optimizeSegments, mode }, expected);
      }
    }
    for (const fnc1Second of ["00", "99", "A", "z"]) {
      assertEncodedLike(input, { fnc1Second, mode: "alphanumeric" }, [
        { mode: "fnc1-second", applicationIndicator: fnc1Second },
        { mode: "alphanumeric", text: input.replaceAll("%", "%%") }
      ]);
    }
    assert.equal(parseGs1ElementString(input).elements[0].value, input.slice(2));
  }
});

test("percent-heavy automatic FNC1 input can choose byte without changing forced mode", () => {
  const input = "10%%%%%%%%%%";
  for (const optimizeSegments of [true, false]) {
    const diagnostics = assertEncodedLike(input, { gs1: true, optimizeSegments }, [
      { mode: "fnc1" }, { mode: "byte", text: input }
    ]);
    assert.equal(diagnostics.mode, "byte");
    assertEncodedLike(input, { gs1: true, optimizeSegments, mode: "alphanumeric" }, [
      { mode: "fnc1" }, { mode: "alphanumeric", text: input.replaceAll("%", "%%") }
    ]);
  }
});

test("byte percent, plain percent, and manual FNC1 escaping preserve their existing bytes", () => {
  const input = "10abc%def\u001d2112345";
  for (const optimizeSegments of [true, false]) {
    assertEncodedLike(input, { gs1: true, optimizeSegments }, optimizeSegments
      ? [{ mode: "fnc1" }, { mode: "byte", text: "10abc%def\u001d" }, { mode: "numeric", text: "2112345" }]
      : [{ mode: "fnc1" }, { mode: "byte", text: input }]);
  }
  assertEncodedLike("10ABC%DEF", { gs1: true, mode: "byte" }, [
    { mode: "fnc1" }, { mode: "byte", text: "10ABC%DEF" }
  ]);
  assertEncodedLike("ABC%DEF", {}, [{ mode: "alphanumeric", text: "ABC%DEF" }]);

  for (const text of ["ABC%DEF", "ABC%%DEF", "%", "%%", "%%%", "%%%%"]) {
    for (const control of [{ mode: "fnc1" }, { mode: "fnc1-second", applicationIndicator: "A" }]) {
      const segments = [control, { mode: "alphanumeric", text }];
      const options = control.mode === "fnc1" ? { gs1: true } : { fnc1Second: "A" };
      assert.deepEqual(generateSegments(segments, fixed), generateSegments(segments.slice(1), { ...fixed, ...options }));
      assert.deepEqual(
        analyzeSegments(segments, fixed).segments,
        analyzeSegments(segments.slice(1), { ...fixed, ...options }).segments
      );
    }
  }
});

test("escaped FNC1 capacity is measured before version selection and overflow diagnostics", () => {
  const input = "10" + "A".repeat(15) + "%";
  const options = { gs1: true, mode: "alphanumeric", version: 1, errorCorrectionLevel: "H" };
  const planned = estimate(input, options);
  assert.equal(planned.ok, false);
  assert.equal(planned.dataBitLength, 4 + 4 + 9 + Math.floor(19 / 2) * 11 + 6);
  assert.throws(() => generate(input, options), DataTooLongError);

  const long = "A%".repeat(6000);
  const overflow = estimate(long, { fnc1Second: "A", mode: "alphanumeric", version: 1 });
  assert.equal(overflow.ok, false);
  assert.equal(overflow.segments[1].characterCount, 18000);
  assert.equal(overflow.inputBytes, 12000);
});
