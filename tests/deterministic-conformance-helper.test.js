import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_CONFORMANCE_CASES,
  DEFAULT_CONFORMANCE_SEED,
  EXTENDED_CONFORMANCE_CASES,
  createCaseRunner,
  createPrng,
  deriveSeed,
  formatSeed,
  minimizeFailingSequence,
  parseConformanceArguments
} from "../tools/lib/deterministic-conformance.js";

test("deterministic conformance PRNG repeats the same sequence for the same seed", () => {
  const first = createPrng(0x12345678);
  const second = createPrng(0x12345678);
  const firstValues = Array.from({ length: 16 }, () => first.nextUint32());
  const secondValues = Array.from({ length: 16 }, () => second.nextUint32());

  assert.deepEqual(secondValues, firstValues);
  assert.deepEqual(firstValues.slice(0, 8), [
    455919406,
    4042750857,
    4036713555,
    1004527575,
    3885174651,
    3342903291,
    1200158424,
    1464636653
  ]);
  const different = createPrng(0x12345679);
  assert.notDeepEqual(
    Array.from({ length: 16 }, () => different.nextUint32()),
    firstValues
  );
});

test("derived case seeds do not depend on generation order", () => {
  const alphaFirst = deriveSeed(DEFAULT_CONFORMANCE_SEED, "suite", "alpha", 3);
  deriveSeed(DEFAULT_CONFORMANCE_SEED, "suite", "unrelated", 99);
  const alphaSecond = deriveSeed(DEFAULT_CONFORMANCE_SEED, "suite", "alpha", 3);

  assert.equal(alphaSecond, alphaFirst);
  assert.equal(
    deriveSeed(DEFAULT_CONFORMANCE_SEED, "property", "auto-mask", 3),
    2940018685
  );
  assert.notEqual(
    deriveSeed(DEFAULT_CONFORMANCE_SEED, "suite", "alpha", 4),
    alphaFirst
  );
});

test("conformance CLI parser supports bounded, extended, and exact replay modes", () => {
  assert.deepEqual(parseConformanceArguments([]), {
    seed: DEFAULT_CONFORMANCE_SEED,
    cases: DEFAULT_CONFORMANCE_CASES,
    caseFilter: null,
    extended: false,
    help: false
  });
  assert.deepEqual(parseConformanceArguments(["--extended"]), {
    seed: DEFAULT_CONFORMANCE_SEED,
    cases: EXTENDED_CONFORMANCE_CASES,
    caseFilter: null,
    extended: true,
    help: false
  });
  assert.deepEqual(
    parseConformanceArguments([
      "--extended",
      "--seed=0x1234",
      "--cases",
      "7",
      "--case",
      "property:auto-mask:0003"
    ]),
    {
      seed: 0x1234,
      cases: 7,
      caseFilter: "property:auto-mask:0003",
      extended: true,
      help: false
    }
  );
});

test("case runner reports a complete exact replay command and serialized descriptor", () => {
  const runner = createCaseRunner({
    seed: 0x1234,
    cases: 7,
    caseFilter: "property:demo:0003",
    script: "verify:conformance:fuzz"
  });

  assert.equal(runner.run({
    id: "property:demo:0002",
    suite: "demo",
    descriptor: {},
    execute() {
      throw new Error("must not execute");
    }
  }), false);

  assert.throws(
    () => runner.run({
      id: "property:demo:0003",
      suite: "demo",
      descriptor: {
        input: Uint8Array.from([0x00, 0xFF])
      },
      execute() {
        throw new Error("expected failure");
      }
    }),
    (error) => {
      assert.match(
        error.message,
        /npm run verify:conformance:fuzz -- --seed 0x00001234 --cases 7 --case property:demo:0003/u
      );
      assert.match(error.message, /"hex": "00ff"/u);
      assert.match(error.message, /expected failure/u);
      return true;
    }
  );
  assert.equal(runner.finish(), 1);
});

test("sequence minimizer preserves input type and removes irrelevant data", () => {
  const minimizedString = minimizeFailingSequence(
    "a😀bcXdef",
    (candidate) => candidate.includes("X")
  );
  const minimizedBytes = minimizeFailingSequence(
    Uint8Array.from([1, 2, 255, 3, 4]),
    (candidate) => candidate.includes(255)
  );
  const minimizedArray = minimizeFailingSequence(
    ["a", "b", "X", "c"],
    (candidate) => candidate.includes("X")
  );

  assert.equal(minimizedString, "X");
  assert.ok(minimizedBytes instanceof Uint8Array);
  assert.deepEqual(Array.from(minimizedBytes), [255]);
  assert.ok(Array.isArray(minimizedArray));
  assert.deepEqual(minimizedArray, ["X"]);
  assert.equal(formatSeed(0x1234), "0x00001234");
});
