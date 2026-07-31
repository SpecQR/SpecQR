import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  generateSegmentsStructuredAppend,
  generateStructuredAppend,
  InvalidInputError,
  QRCode
} from "../src/index.js";
import {
  createStructuredAppendSegmentsSummaryDiagnostics
} from "../src/internal/structured-append.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [fixture] = JSON.parse(
  readFileSync(path.join(root, "fixtures", "structured-append-segments.json"), "utf8")
);

const baseOptions = {
  ...fixture.options,
  output: "matrix"
};

function assertStandardSummary(diagnostics, expectedCount) {
  assert.equal(diagnostics.splitUnitsDetail, "summary");
  assert.equal(diagnostics.splitUnitCount, expectedCount);
  assert.equal(Object.hasOwn(diagnostics, "splitUnits"), false);
  assert.equal(Object.keys(diagnostics).includes("splitUnits"), false);
  assert.equal(JSON.stringify(diagnostics).includes("\"splitUnits\":"), false);

  const clone = structuredClone(diagnostics);
  assert.equal(clone.splitUnitsDetail, "summary");
  assert.equal(clone.splitUnitCount, expectedCount);
  assert.equal(Object.hasOwn(clone, "splitUnits"), false);
}

function assertFullSummary(diagnostics, expectedSplitUnits) {
  assert.equal(diagnostics.splitUnitsDetail, "full");
  assert.equal(diagnostics.splitUnitCount, expectedSplitUnits.length);
  assert.equal(Object.hasOwn(diagnostics, "splitUnits"), true);
  assert.deepEqual(diagnostics.splitUnits, expectedSplitUnits);
  assert.equal(
    JSON.stringify(diagnostics.splitUnits),
    JSON.stringify(expectedSplitUnits)
  );
  assert.deepEqual(structuredClone(diagnostics).splitUnits, expectedSplitUnits);
}

test("manual Structured Append defaults to compact standard diagnostics", () => {
  for (const diagnostics of [undefined, false]) {
    const options = diagnostics === undefined
      ? baseOptions
      : { ...baseOptions, diagnostics };
    const result = generateSegmentsStructuredAppend(fixture.segments, options);

    assertStandardSummary(result.diagnostics, fixture.expected.splitUnits.length);
    assert.equal(Array.isArray(result.symbols[0]), true);
  }
});

test("manual Structured Append boolean and object diagnostics select symbol result shape", () => {
  const booleanResult = generateSegmentsStructuredAppend(fixture.segments, {
    ...baseOptions,
    diagnostics: true
  });
  const objectDefault = generateSegmentsStructuredAppend(fixture.segments, {
    ...baseOptions,
    diagnostics: {}
  });
  const explicitUndefined = generateSegmentsStructuredAppend(fixture.segments, {
    ...baseOptions,
    diagnostics: {
      splitUnits: undefined,
      symbolResults: undefined
    }
  });
  const objectOutput = generateSegmentsStructuredAppend(fixture.segments, {
    ...baseOptions,
    diagnostics: {
      splitUnits: "summary",
      symbolResults: "output"
    }
  });

  assertStandardSummary(booleanResult.diagnostics, fixture.expected.splitUnits.length);
  assertStandardSummary(objectDefault.diagnostics, fixture.expected.splitUnits.length);
  assertStandardSummary(explicitUndefined.diagnostics, fixture.expected.splitUnits.length);
  assertStandardSummary(objectOutput.diagnostics, fixture.expected.splitUnits.length);
  assert.equal(Array.isArray(booleanResult.symbols[0].matrix), true);
  assert.equal(Array.isArray(objectDefault.symbols[0].matrix), true);
  assert.equal(Array.isArray(explicitUndefined.symbols[0].matrix), true);
  assert.equal(Array.isArray(objectOutput.symbols[0]), true);
  assert.equal(
    booleanResult.diagnostics.warnings.some(
      (warning) => warning.code === "STRUCTURED_APPEND_DECODER_SUPPORT_VARIES"
    ),
    true
  );
  assert.deepEqual(
    objectDefault.diagnostics.warnings,
    booleanResult.diagnostics.warnings
  );
  assert.equal(
    objectOutput.diagnostics.warnings.some(
      (warning) => warning.code === "STRUCTURED_APPEND_DECODER_SUPPORT_VARIES"
    ),
    false
  );
  assert.deepEqual(booleanResult.symbols.map((symbol) => symbol.matrix), objectOutput.symbols);
  assert.deepEqual(objectDefault.symbols.map((symbol) => symbol.matrix), objectOutput.symbols);
});

test("manual Structured Append full detail preserves the v2 splitUnits contract", () => {
  const diagnosticResult = generateSegmentsStructuredAppend(fixture.segments, {
    ...baseOptions,
    diagnostics: { splitUnits: "full" }
  });
  const outputResult = QRCode.generateSegmentsStructuredAppend(fixture.segments, {
    ...baseOptions,
    diagnostics: {
      splitUnits: "full",
      symbolResults: "output"
    }
  });

  assertFullSummary(diagnosticResult.diagnostics, fixture.expected.splitUnits);
  assertFullSummary(outputResult.diagnostics, fixture.expected.splitUnits);
  assert.equal(
    diagnosticResult.diagnostics.warnings.some(
      (warning) => warning.code === "STRUCTURED_APPEND_DECODER_SUPPORT_VARIES"
    ),
    true
  );
  assert.equal(
    outputResult.diagnostics.warnings.some(
      (warning) => warning.code === "STRUCTURED_APPEND_DECODER_SUPPORT_VARIES"
    ),
    false
  );
  assert.deepEqual(
    Object.keys(diagnosticResult.diagnostics.splitUnits[0]),
    [
      "sourceSegmentIndex",
      "mode",
      "unitStart",
      "unitLength",
      "byteStart",
      "byteLength"
    ]
  );
  assert.deepEqual(
    diagnosticResult.symbols.map((symbol) => symbol.matrix),
    outputResult.symbols
  );

  diagnosticResult.diagnostics.splitUnits[0].unitStart = 99;
  diagnosticResult.diagnostics.splitUnits.push({
    sourceSegmentIndex: 99,
    mode: "byte",
    unitStart: 0,
    unitLength: 1,
    byteStart: 0,
    byteLength: 1
  });
  assert.equal(diagnosticResult.diagnostics.splitUnits[0].unitStart, 99);

  const fresh = generateSegmentsStructuredAppend(fixture.segments, {
    ...baseOptions,
    diagnostics: { splitUnits: "full" }
  });
  assert.deepEqual(fresh.diagnostics.splitUnits, fixture.expected.splitUnits);
});

test("standard summary never invokes the full split-unit materializer", () => {
  let materializationCount = 0;
  const inputInfo = {
    parity: 0,
    byteLength: 123,
    inputLength: 1,
    segments: [{}],
    splitUnitCount: 123,
    materializeSplitUnits() {
      materializationCount += 1;
      throw new Error("full split-unit materializer was called");
    }
  };
  const common = {
    selected: {
      version: 1,
      versionSelection: "fixed",
      versionSelectionReason: "test",
      chunks: [{}, {}]
    },
    inputInfo,
    symbolDiagnostics: []
  };

  const standard = createStructuredAppendSegmentsSummaryDiagnostics({
    ...common,
    normalized: {
      errorCorrectionLevel: "L",
      maxSymbols: 16,
      diagnostics: false,
      structuredAppendDiagnostics: { splitUnits: "summary" }
    }
  });
  assertStandardSummary(standard, 123);
  assert.equal(materializationCount, 0);

  inputInfo.materializeSplitUnits = () => {
    materializationCount += 1;
    return [];
  };
  const full = createStructuredAppendSegmentsSummaryDiagnostics({
    ...common,
    normalized: {
      errorCorrectionLevel: "L",
      maxSymbols: 16,
      diagnostics: true,
      structuredAppendDiagnostics: { splitUnits: "full" }
    }
  });
  assert.equal(materializationCount, 1);
  assert.equal(full.splitUnitsDetail, "full");
  assert.deepEqual(full.splitUnits, []);
});

test("manual Structured Append diagnostics object validation is strict and deterministic", () => {
  const hiddenUnknown = {};
  Object.defineProperty(hiddenUnknown, "hidden", { value: true });
  const symbolUnknown = { [Symbol("unknown")]: true };
  const cases = [
    [null, "generateSegmentsStructuredAppend diagnostics must be a boolean or an object"],
    [[], "generateSegmentsStructuredAppend diagnostics must be a boolean or an object"],
    [1, "generateSegmentsStructuredAppend diagnostics must be a boolean or an object"],
    ["full", "generateSegmentsStructuredAppend diagnostics must be a boolean or an object"],
    [{ splitUnits: "all" }, "diagnostics.splitUnits must be \"summary\" or \"full\"; got all"],
    [{ symbolResults: "matrix" }, "diagnostics.symbolResults must be \"output\" or \"diagnostics\"; got matrix"],
    [{ unknown: true }, "Unsupported generateSegmentsStructuredAppend diagnostics option: unknown"],
    [hiddenUnknown, "Unsupported generateSegmentsStructuredAppend diagnostics option: hidden"],
    [symbolUnknown, "Unsupported generateSegmentsStructuredAppend diagnostics option: Symbol(unknown)"]
  ];

  for (const [diagnostics, message] of cases) {
    assert.throws(
      () => generateSegmentsStructuredAppend(fixture.segments, {
        ...baseOptions,
        diagnostics
      }),
      (error) => {
        assert.equal(error instanceof InvalidInputError, true);
        assert.equal(error.code, "INVALID_INPUT");
        assert.equal(error.message, message);
        return true;
      }
    );
  }

  const inherited = Object.create({
    splitUnits: "full",
    symbolResults: "output"
  });
  const result = generateSegmentsStructuredAppend(fixture.segments, {
    ...baseOptions,
    diagnostics: inherited
  });
  assertStandardSummary(result.diagnostics, fixture.expected.splitUnits.length);
  assert.equal(Array.isArray(result.symbols[0].matrix), true);
});

test("raw Structured Append keeps boolean-only diagnostics ownership", () => {
  for (const diagnostics of [
    null,
    [],
    { splitUnits: "summary" }
  ]) {
    assert.throws(
      () => generateStructuredAppend("A".repeat(31), {
        version: 1,
        errorCorrectionLevel: "L",
        output: "matrix",
        diagnostics
      }),
      (error) => {
        assert.equal(error instanceof InvalidInputError, true);
        assert.equal(error.code, "INVALID_INPUT");
        assert.equal(
          error.message,
          "generateStructuredAppend diagnostics must be a boolean"
        );
        return true;
      }
    );
  }
});
