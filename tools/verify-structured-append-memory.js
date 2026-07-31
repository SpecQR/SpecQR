import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

import {
  DataTooLongError,
  generateSegmentsStructuredAppend,
  generateStructuredAppend,
  getCapacity
} from "../src/index.js";

const childMode = process.argv[2];
const OVERSIZED_LENGTH = 150_000;
const HEAP_LIMIT_MEGABYTES = 32;

if (childMode) {
  runChildCase(childMode);
} else {
  const childCases = [
    "--child-oversized-binary",
    "--child-oversized-ascii",
    "--child-oversized-manual-byte",
    "--child-valid-raw-boundary",
    "--child-valid-manual-boundary"
  ];
  const results = childCases.map(runLowHeapChild);
  const standardRuns = Array.from(
    { length: 5 },
    () => runBenchmarkChild("--child-v3-standard")
  );
  const fullRuns = Array.from(
    { length: 5 },
    () => runBenchmarkChild("--child-v3-full")
  );
  const lowHeapStandard =
    runLowHeapChild("--child-v3-standard", { exposeGc: true });
  const standardMedian = summarizeMedian(standardRuns);
  const fullMedian = summarizeMedian(fullRuns);

  assert.equal(
    new Set([...standardRuns, ...fullRuns].map((run) => run.outputHash)).size,
    1
  );
  assert.ok(
    fullMedian.diagnosticsJsonBytes > standardMedian.diagnosticsJsonBytes
  );

  console.log("ok structured-append-memory");
  console.log(JSON.stringify({
    heapLimitMegabytes: HEAP_LIMIT_MEGABYTES,
    oversizedLength: OVERSIZED_LENGTH,
    children: results,
    v3Diagnostics: {
      version: 40,
      symbols: 16,
      runsPerMode: 5,
      standardMedian,
      fullMedian,
      lowHeapStandard
    }
  }, null, 2));
}

function runChildCase(mode) {
  const started = performance.now();
  let details;

  switch (mode) {
    case "--child-oversized-binary": {
      const backing = new Uint8Array(OVERSIZED_LENGTH + 2);
      const view = new DataView(
        backing.buffer,
        1,
        OVERSIZED_LENGTH
      );
      expectDataTooLong(
        () => generateStructuredAppend(view, oversizedRawOptions()),
        "Input cannot be split into 16 or fewer version 40-L Structured Append symbols"
      );
      details = {
        case: "oversized-binary-view",
        bytes: view.byteLength
      };
      break;
    }
    case "--child-oversized-ascii": {
      const input = "A".repeat(OVERSIZED_LENGTH);
      expectDataTooLong(
        () => generateStructuredAppend(input, {
          version: "auto",
          minVersion: 1,
          maxVersion: 40,
          errorCorrectionLevel: "L",
          mode: "auto",
          maxSymbols: 16,
          output: "matrix"
        }),
        "Input cannot be split into 16 or fewer Structured Append symbols for versions 1..40 at error correction L"
      );
      details = {
        case: "oversized-ascii",
        characters: input.length
      };
      break;
    }
    case "--child-oversized-manual-byte": {
      const bytes = new Uint8Array(OVERSIZED_LENGTH);
      expectDataTooLong(
        () => generateSegmentsStructuredAppend([
          { mode: "byte", data: bytes }
        ], oversizedManualOptions()),
        "Input segments cannot be split into 16 or fewer version 40-L Structured Append symbols"
      );
      details = {
        case: "oversized-manual-byte",
        bytes: bytes.length
      };
      break;
    }
    case "--child-valid-raw-boundary": {
      const bytes = createVersion10BoundaryBytes();
      const result = generateStructuredAppend(bytes, {
        version: 10,
        errorCorrectionLevel: "L",
        mode: "byte",
        maxSymbols: 16,
        maskPattern: 2,
        output: "matrix",
        diagnostics: true
      });
      assert.equal(result.total, 16);
      assert.equal(result.parity, 223);
      assert.equal(result.diagnostics.symbols.at(-1).byteLength, 269);
      details = {
        case: "valid-raw-16-symbol-boundary",
        bytes: bytes.length,
        symbols: result.total,
        parity: result.parity
      };
      break;
    }
    case "--child-valid-manual-boundary": {
      const bytes = createVersion10BoundaryBytes();
      const result = generateSegmentsStructuredAppend([
        { mode: "byte", data: bytes }
      ], {
        version: 10,
        errorCorrectionLevel: "L",
        maxSymbols: 16,
        maskPattern: 2,
        output: "matrix",
        diagnostics: { splitUnits: "full" }
      });
      assert.equal(result.total, 16);
      assert.equal(result.parity, 223);
      assert.equal(result.diagnostics.splitUnitsDetail, "full");
      assert.equal(result.diagnostics.splitUnitCount, bytes.length);
      assert.equal(result.diagnostics.splitUnits.length, bytes.length);
      details = {
        case: "valid-manual-16-symbol-boundary",
        bytes: bytes.length,
        symbols: result.total,
        parity: result.parity,
        publicSplitUnits: result.diagnostics.splitUnits.length
      };
      break;
    }
    case "--child-v3-standard":
    case "--child-v3-full": {
      const bytes = createVersion40BoundaryBytes();
      if (typeof globalThis.gc === "function") {
        globalThis.gc();
      }
      const heapBefore = process.memoryUsage().heapUsed;
      const generationStarted = performance.now();
      const full = mode === "--child-v3-full";
      const result = generateSegmentsStructuredAppend([
        { mode: "byte", data: bytes }
      ], {
        version: 40,
        errorCorrectionLevel: "L",
        maxSymbols: 16,
        maskPattern: 0,
        output: "matrix",
        diagnostics: full
          ? {
            splitUnits: "full",
            symbolResults: "output"
          }
          : false
      });
      const generationMilliseconds = performance.now() - generationStarted;
      if (typeof globalThis.gc === "function") {
        globalThis.gc();
      }
      const heapAfter = process.memoryUsage().heapUsed;

      assert.equal(result.total, 16);
      assert.equal(result.diagnostics.splitUnitCount, bytes.length);
      assert.equal(result.diagnostics.splitUnitsDetail, full ? "full" : "summary");
      assert.equal(Object.hasOwn(result.diagnostics, "splitUnits"), full);
      if (full) {
        assert.equal(result.diagnostics.splitUnits.length, bytes.length);
      }
      details = {
        case: full ? "v3-full" : "v3-standard",
        bytes: bytes.length,
        symbols: result.total,
        splitUnitCount: result.diagnostics.splitUnitCount,
        splitUnitsMaterialized: full
          ? result.diagnostics.splitUnits.length
          : 0,
        diagnosticsJsonBytes: Buffer.byteLength(
          JSON.stringify(result.diagnostics),
          "utf8"
        ),
        generationMilliseconds: Number(generationMilliseconds.toFixed(2)),
        heapDeltaBytes: heapAfter - heapBefore,
        outputHash: hashMatrices(result.symbols)
      };
      break;
    }
    default:
      throw new Error(`Unknown Structured Append memory child mode: ${mode}`);
  }

  console.log(JSON.stringify({
    ...details,
    elapsedMilliseconds: Number(
      (performance.now() - started).toFixed(2)
    ),
    rssBytes: process.memoryUsage().rss,
    heapUsedBytes: process.memoryUsage().heapUsed
  }));
}

function oversizedRawOptions() {
  return {
    version: 40,
    errorCorrectionLevel: "L",
    mode: "byte",
    maxSymbols: 16,
    output: "matrix"
  };
}

function oversizedManualOptions() {
  return {
    version: 40,
    errorCorrectionLevel: "L",
    maxSymbols: 16,
    output: "matrix"
  };
}

function createVersion10BoundaryBytes() {
  const perSymbol = getCapacity({
    version: 10,
    errorCorrectionLevel: "L",
    mode: "byte",
    controlBits: 20
  }).maxBytes;
  return Uint8Array.from(
    { length: perSymbol * 16 },
    (_, index) => index % 251
  );
}

function createVersion40BoundaryBytes() {
  const perSymbol = getCapacity({
    version: 40,
    errorCorrectionLevel: "L",
    mode: "byte",
    controlBits: 20
  }).maxBytes;
  return Uint8Array.from(
    { length: perSymbol * 16 },
    (_, index) => index % 251
  );
}

function expectDataTooLong(run, expectedMessage) {
  let error;
  try {
    run();
  } catch (caught) {
    error = caught;
  }
  assert.ok(error instanceof DataTooLongError);
  assert.equal(error.code, "DATA_TOO_LONG");
  assert.equal(error.message, expectedMessage);
}

function runLowHeapChild(mode, { exposeGc = false } = {}) {
  const nodeArguments = [
    `--max-old-space-size=${HEAP_LIMIT_MEGABYTES}`
  ];
  if (exposeGc) {
    nodeArguments.push("--expose-gc");
  }
  const result = spawnSync(process.execPath, [
    ...nodeArguments,
    fileURLToPath(import.meta.url),
    mode
  ], {
    encoding: "utf8",
    env: {
      ...process.env,
      NODE_OPTIONS: ""
    }
  });

  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.stdout.write(result.stdout);
    throw new Error(
      `Structured Append memory child ${mode} failed with exit status ${result.status}`
    );
  }
  return JSON.parse(result.stdout.trim());
}

function runBenchmarkChild(mode) {
  const result = spawnSync(process.execPath, [
    "--expose-gc",
    fileURLToPath(import.meta.url),
    mode
  ], {
    encoding: "utf8",
    env: {
      ...process.env,
      NODE_OPTIONS: ""
    }
  });

  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.stdout.write(result.stdout);
    throw new Error(
      `Structured Append diagnostics benchmark ${mode} failed with exit status ${result.status}`
    );
  }
  return JSON.parse(result.stdout.trim());
}

function summarizeMedian(runs) {
  return {
    generationMilliseconds: median(
      runs.map((run) => run.generationMilliseconds)
    ),
    heapDeltaBytes: median(runs.map((run) => run.heapDeltaBytes)),
    diagnosticsJsonBytes: median(
      runs.map((run) => run.diagnosticsJsonBytes)
    ),
    outputHash: runs[0].outputHash
  };
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

function hashMatrices(matrices) {
  const hash = createHash("sha256");
  for (const matrix of matrices) {
    for (const row of matrix) {
      for (const module of row) {
        hash.update(module ? "1" : "0");
      }
      hash.update("\n");
    }
  }
  return hash.digest("hex");
}
