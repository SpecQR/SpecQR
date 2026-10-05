import test from "node:test";
import assert from "node:assert/strict";
import {
  InvalidInputError,
  analyzeSegments,
  estimate,
  generate,
  generateSegments,
  generateSegmentsStructuredAppend,
  generateStructuredAppend
} from "../src/index.js";

const SEGMENTS = [{ mode: "byte", data: "A" }];
const PRINT_GEOMETRY_ERROR = /^Print diagnostics must produce finite geometry: (?:moduleSizeMm|symbolSizeMm)$/;

function assertPrintGeometryError(action) {
  assert.throws(action, (error) => {
    assert.ok(error instanceof InvalidInputError);
    assert.equal(error.code, "INVALID_INPUT");
    assert.match(error.message, PRINT_GEOMETRY_ERROR);
    return true;
  });
}

test("planning and generated diagnostics reject non-finite physical print sizes", () => {
  for (const printDpi of [Number.MIN_VALUE, 1e-307, 1e-305]) {
    assertPrintGeometryError(() => estimate("A", { printDpi }));
    assertPrintGeometryError(() => analyzeSegments(SEGMENTS, { printDpi }));
    assertPrintGeometryError(() => generate("A", { printDpi, diagnostics: true }));
    assertPrintGeometryError(() => generateSegments(SEGMENTS, { printDpi, diagnostics: true }));
  }
});

test("print geometry checks both module and full symbol arithmetic", () => {
  assert.throws(
    () => estimate("A", { printDpi: 1e-307 }),
    { name: "InvalidInputError", code: "INVALID_INPUT", message: "Print diagnostics must produce finite geometry: moduleSizeMm" }
  );
  assert.throws(
    () => estimate("A", { printDpi: 1e-305 }),
    { name: "InvalidInputError", code: "INVALID_INPUT", message: "Print diagnostics must produce finite geometry: symbolSizeMm" }
  );
  assertPrintGeometryError(() => estimate("A", { printDpi: 300, margin: Number.MAX_VALUE }));
});

test("print geometry uses the evaluated version rather than rejecting a worst-case version", () => {
  const options = { printDpi: 1e-304, version: 1 };
  const expected = estimate("A", options).diagnostics.print;
  assert.ok(Number.isFinite(expected.moduleSizeMm));
  assert.ok(Number.isFinite(expected.symbolSizeMm));
  assert.deepEqual(analyzeSegments(SEGMENTS, options).diagnostics.print, expected);
  assert.deepEqual(generate("A", { ...options, diagnostics: true }).diagnostics.print, expected);
  assert.deepEqual(generateSegments(SEGMENTS, { ...options, diagnostics: true }).diagnostics.print, expected);
  assert.deepEqual(estimate("A", { printDpi: options.printDpi }).diagnostics.print, expected);

  const tooLarge = { ...options, version: 40 };
  assertPrintGeometryError(() => estimate("A", tooLarge));
  assertPrintGeometryError(() => analyzeSegments(SEGMENTS, tooLarge));
  assertPrintGeometryError(() => generate("A", { ...tooLarge, diagnostics: true }));
  assertPrintGeometryError(() => generateSegments(SEGMENTS, { ...tooLarge, diagnostics: true }));
});

test("overflow planning also rejects non-finite print diagnostics", () => {
  const input = "A".repeat(1000);
  const options = { maxVersion: 1, printDpi: Number.MIN_VALUE };
  assertPrintGeometryError(() => estimate(input, options));
  assertPrintGeometryError(() => analyzeSegments([{ mode: "byte", data: input }], options));

  const finite = estimate(input, { maxVersion: 1, printDpi: 300 });
  assert.equal(finite.ok, false);
  assert.equal(finite.reason, "data-too-long");
  assert.ok(Number.isFinite(finite.diagnostics.print.symbolSizeMm));
});

test("unused printDpi does not affect non-diagnostic generated output", () => {
  for (const output of ["matrix", "svg", "svg-data-url", "png", "png-data-url"]) {
    assert.deepEqual(
      generate("A", { output, printDpi: Number.MIN_VALUE }),
      generate("A", { output })
    );
    assert.deepEqual(
      generateSegments(SEGMENTS, { output, printDpi: Number.MIN_VALUE }),
      generateSegments(SEGMENTS, { output })
    );
  }
});

test("Structured Append omits unused print geometry but validates exposed symbol diagnostics", () => {
  const input = "A".repeat(40);
  const segments = [{ mode: "byte", data: input }];
  for (const [create, data] of [
    [generateStructuredAppend, input],
    [generateSegmentsStructuredAppend, segments]
  ]) {
    for (const output of ["matrix", "svg", "png"]) {
      const expected = create(data, { version: 1, output });
      for (const printDpi of [Number.MIN_VALUE, 300]) {
        assert.deepEqual(create(data, { version: 1, output, printDpi }), expected);
      }
    }

    assertPrintGeometryError(() => create(data, {
      version: 1,
      printDpi: Number.MIN_VALUE,
      diagnostics: true
    }));
    const result = create(data, { version: 1, printDpi: 300, diagnostics: true });
    const expectedPrint = estimate("A", { version: 1, printDpi: 300 }).diagnostics.print;
    for (const symbol of result.symbols) {
      assert.deepEqual(symbol.diagnostics.print, expectedPrint);
    }
  }

  const options = {
    version: 1,
    output: "matrix",
    diagnostics: { splitUnits: "full", symbolResults: "output" }
  };
  assert.deepEqual(
    generateSegmentsStructuredAppend(segments, { ...options, printDpi: Number.MIN_VALUE }),
    generateSegmentsStructuredAppend(segments, options)
  );
});

test("normal and absent print DPI preserve existing diagnostics exactly", () => {
  const moduleSizeMm = (8 / 300) * 25.4;
  const expected = {
    dpi: 300,
    modulePixels: 8,
    moduleSizeMm,
    symbolSizeMm: 29 * moduleSizeMm,
    recommendedMinimumModuleSizeMm: 0.25,
    isModuleSizeSufficient: true
  };
  assert.deepEqual(estimate("A", { printDpi: 300 }).diagnostics.print, expected);
  assert.deepEqual(generate("A", { printDpi: 300, diagnostics: true }).diagnostics.print, expected);
  assert.deepEqual(estimate("A").diagnostics.print, {
    dpi: null,
    modulePixels: 8,
    moduleSizeMm: null,
    symbolSizeMm: null,
    recommendedMinimumModuleSizeMm: 0.25,
    isModuleSizeSufficient: null
  });
});
