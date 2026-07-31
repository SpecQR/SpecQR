import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import {
  generateSegmentsStructuredAppend,
  generateStructuredAppend,
  mergeStructuredAppendParts
} from "specqr";

const [command, ...args] = process.argv.slice(2);

if (command === "generate") {
  await generateFixtureManifest(args);
} else if (command === "verify") {
  await verifyDecodedFixtures(args);
} else {
  throw new Error(
    "Usage: fixture-driver.mjs generate <image-dir> <manifest> | "
      + "verify <manifest> <decoder-ndjson> <verification-report>"
  );
}

async function generateFixtureManifest([imageDirectory, manifestPath]) {
  assert.ok(imageDirectory, "image directory is required");
  assert.ok(manifestPath, "manifest path is required");

  await mkdir(imageDirectory, { recursive: true });
  const packageManifest = JSON.parse(
    await readFile(new URL("./node_modules/specqr/package.json", import.meta.url), "utf8")
  );
  const fixtures = [];

  for (const definition of createFixtureDefinitions()) {
    const diagnosticResult = definition.generate({
      output: "matrix",
      diagnostics: true
    });
    const pngResult = definition.generate({
      output: "png",
      diagnostics: false
    });

    assert.equal(
      diagnosticResult.total,
      definition.expectedTotal,
      `${definition.id} total`
    );
    assert.equal(pngResult.total, diagnosticResult.total, `${definition.id} PNG total`);
    assert.equal(
      diagnosticResult.symbols.length,
      diagnosticResult.total,
      `${definition.id} diagnostic symbol count`
    );
    assert.equal(
      pngResult.symbols.length,
      diagnosticResult.total,
      `${definition.id} PNG symbol count`
    );

    const symbols = [];
    for (let index = 0; index < diagnosticResult.total; index += 1) {
      const embedded = diagnosticResult.symbols[index].diagnostics.structuredAppend;
      const summary = diagnosticResult.diagnostics.symbols[index];
      const expectedMetadata = {
        index: embedded.index,
        total: embedded.total,
        parity: embedded.parity,
        sequenceIndex: embedded.sequenceIndex,
        sequenceTotal: embedded.sequenceTotal,
        sequenceIndicator: embedded.sequenceIndicator
      };

      assert.deepEqual(expectedMetadata, {
        index: summary.index,
        total: summary.total,
        parity: summary.parity,
        sequenceIndex: summary.sequenceIndex,
        sequenceTotal: summary.sequenceTotal,
        sequenceIndicator: summary.sequenceIndicator
      }, `${definition.id} diagnostics metadata`);
      if (definition.fixedMask !== undefined) {
        assert.equal(
          summary.maskPattern,
          definition.fixedMask,
          `${definition.id} fixed mask`
        );
      }

      const imagePath = path.resolve(
        imageDirectory,
        `${definition.id}-${String(index + 1).padStart(2, "0")}.png`
      );
      const png = pngResult.symbols[index];
      assertPng(png, definition.id);
      await writeFile(imagePath, png);

      symbols.push({
        imagePath,
        pngSha256: sha256(png),
        expected: expectedMetadata,
        chunk: pickChunkDiagnostics(summary)
      });
    }

    const scanOrder = definition.scanOrder ?? symbols.map((_, index) => index);
    assert.deepEqual(
      [...scanOrder].sort((left, right) => left - right),
      symbols.map((_, index) => index),
      `${definition.id} scan order`
    );

    fixtures.push({
      id: definition.id,
      inputKind: definition.inputKind,
      total: diagnosticResult.total,
      parity: diagnosticResult.parity,
      byteLength: diagnosticResult.byteLength,
      version: diagnosticResult.diagnostics.version,
      errorCorrectionLevel: diagnosticResult.diagnostics.errorCorrectionLevel,
      maskPattern: definition.fixedMask ?? null,
      scanOrder,
      payloadAssertion: definition.payloadAssertion,
      originalText: definition.originalText ?? null,
      originalBytesBase64: definition.originalBytes
        ? Buffer.from(definition.originalBytes).toString("base64")
        : null,
      symbols
    });
  }

  const manifest = {
    schemaVersion: 1,
    package: {
      name: packageManifest.name,
      version: packageManifest.version,
      repository: packageManifest.repository
    },
    fixtures
  };
  await writeJson(manifestPath, manifest);
  console.log(JSON.stringify({
    status: "generated",
    fixtureCount: fixtures.length,
    symbolCount: fixtures.reduce((sum, fixture) => sum + fixture.total, 0),
    manifestPath
  }));
}

async function verifyDecodedFixtures([
  manifestPath,
  decoderOutputPath,
  verificationReportPath
]) {
  assert.ok(manifestPath, "manifest path is required");
  assert.ok(decoderOutputPath, "decoder output path is required");
  assert.ok(verificationReportPath, "verification report path is required");

  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const records = (await readFile(decoderOutputPath, "utf8"))
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const toolchain = records.find((record) => record.type === "toolchain");
  const decoded = records.filter((record) => record.type === "decode");
  const report = {
    schemaVersion: 1,
    status: "running",
    toolchain,
    package: manifest.package,
    fixtures: [],
    summary: {
      fixtureCount: manifest.fixtures.length,
      symbolCount: manifest.fixtures.reduce(
        (sum, fixture) => sum + fixture.total,
        0
      ),
      textMergeAssertions: 0,
      metadataOnlyAssertions: 0
    }
  };

  let failure;
  try {
    assert.ok(toolchain, "ZXing Java toolchain record is missing");
    assert.equal(
      decoded.length,
      report.summary.symbolCount,
      "ZXing Java decoded symbol count"
    );

    const decodedByPath = new Map(
      decoded.map((record) => [path.resolve(record.path), record])
    );
    assert.equal(
      decodedByPath.size,
      decoded.length,
      "ZXing Java returned duplicate image paths"
    );

    for (const fixture of manifest.fixtures) {
      const fixtureReport = verifyFixture(fixture, decodedByPath);
      report.fixtures.push(fixtureReport);
      if (fixtureReport.payloadAssertion.kind === "text-merge") {
        report.summary.textMergeAssertions += 1;
      } else {
        report.summary.metadataOnlyAssertions += 1;
      }
    }

    report.status = "passed";
  } catch (error) {
    failure = error;
    report.status = "failed";
    report.failure = serializeError(error);
  }

  await writeJson(verificationReportPath, report);
  if (failure) {
    throw failure;
  }

  console.log(JSON.stringify({
    status: report.status,
    fixtureCount: report.summary.fixtureCount,
    symbolCount: report.summary.symbolCount,
    textMergeAssertions: report.summary.textMergeAssertions,
    metadataOnlyAssertions: report.summary.metadataOnlyAssertions,
    verificationReportPath
  }));
}

function verifyFixture(fixture, decodedByPath) {
  const inScanOrder = fixture.scanOrder.map((symbolIndex) => {
    const expectedSymbol = fixture.symbols[symbolIndex];
    const actual = decodedByPath.get(path.resolve(expectedSymbol.imagePath));
    assert.ok(actual, `${fixture.id} symbol ${symbolIndex + 1} decode is missing`);
    return { actual, expectedSymbol };
  });
  const reportSymbols = [];
  const decodedIndices = new Set();
  const decodedTotals = new Set();
  const decodedParities = new Set();

  for (const { actual, expectedSymbol } of inScanOrder) {
    assert.equal(actual.format, "QR_CODE", `${fixture.id} barcode format`);
    const sequence = metadataInteger(
      actual.sequence,
      `${fixture.id} STRUCTURED_APPEND_SEQUENCE`
    );
    const parity = metadataInteger(
      actual.parity,
      `${fixture.id} STRUCTURED_APPEND_PARITY`
    );
    assert.deepEqual(
      actual.metadata.STRUCTURED_APPEND_SEQUENCE,
      actual.sequence,
      `${fixture.id} raw sequence metadata`
    );
    assert.deepEqual(
      actual.metadata.STRUCTURED_APPEND_PARITY,
      actual.parity,
      `${fixture.id} raw parity metadata`
    );

    const parsed = parseSequenceIndicator(sequence);
    const expected = expectedSymbol.expected;
    assert.equal(sequence, expected.sequenceIndicator, `${fixture.id} sequenceIndicator`);
    assert.equal(parsed.index, expected.index, `${fixture.id} index`);
    assert.equal(parsed.total, expected.total, `${fixture.id} total`);
    assert.equal(parsed.index - 1, expected.sequenceIndex, `${fixture.id} sequenceIndex`);
    assert.equal(parsed.total - 1, expected.sequenceTotal, `${fixture.id} sequenceTotal`);
    assert.equal(parity, expected.parity, `${fixture.id} parity`);

    decodedIndices.add(parsed.index);
    decodedTotals.add(parsed.total);
    decodedParities.add(parity);
    reportSymbols.push({
      imagePath: actual.path,
      pngSha256: expectedSymbol.pngSha256,
      expected,
      decoded: {
        ordinal: actual.ordinal,
        text: actual.text,
        format: actual.format,
        numBits: actual.numBits,
        rawBytesBase64: actual.rawBytesBase64,
        sequence,
        parity,
        parsedIndex: parsed.index,
        parsedTotal: parsed.total,
        metadata: actual.metadata
      },
      result: "passed"
    });
  }

  assert.equal(decodedIndices.size, fixture.total, `${fixture.id} unique indices`);
  assert.deepEqual(
    [...decodedIndices].sort((left, right) => left - right),
    Array.from({ length: fixture.total }, (_, index) => index + 1),
    `${fixture.id} complete indices`
  );
  assert.deepEqual([...decodedTotals], [fixture.total], `${fixture.id} common total`);
  assert.deepEqual([...decodedParities], [fixture.parity], `${fixture.id} common parity`);

  let payloadAssertion;
  if (fixture.payloadAssertion.kind === "text-merge") {
    const parts = inScanOrder.map(({ actual }) => {
      const sequence = metadataInteger(actual.sequence, "sequence");
      const parsed = parseSequenceIndicator(sequence);
      return {
        index: parsed.index,
        total: parsed.total,
        parity: metadataInteger(actual.parity, "parity"),
        data: actual.text
      };
    });
    const merged = mergeStructuredAppendParts(parts);
    assert.equal(merged.data, fixture.originalText, `${fixture.id} merged payload`);
    assert.equal(merged.total, fixture.total, `${fixture.id} merged total`);
    assert.equal(merged.parity, fixture.parity, `${fixture.id} merged parity`);
    payloadAssertion = {
      kind: "text-merge",
      status: "passed",
      performed: true,
      mergedText: merged.data,
      byteLength: merged.diagnostics.byteLength
    };
  } else {
    assert.equal(fixture.payloadAssertion.kind, "metadata-only");
    assert.ok(
      fixture.payloadAssertion.reason,
      `${fixture.id} metadata-only reason`
    );
    payloadAssertion = {
      kind: "metadata-only",
      status: "passed",
      performed: false,
      reason: fixture.payloadAssertion.reason
    };
  }

  return {
    id: fixture.id,
    inputKind: fixture.inputKind,
    total: fixture.total,
    parity: fixture.parity,
    version: fixture.version,
    errorCorrectionLevel: fixture.errorCorrectionLevel,
    maskPattern: fixture.maskPattern,
    scanOrder: fixture.scanOrder,
    metadataAssertions: {
      status: "passed",
      uniqueIndices: true,
      completeIndices: true,
      commonTotal: true,
      commonParity: true
    },
    payloadAssertion,
    symbols: reportSymbols,
    result: "passed"
  };
}

function createFixtureDefinitions() {
  const rawTwo = "A".repeat(31);
  const rawThree = "B".repeat(43);
  const rawSixteen = "S".repeat(316);
  const unicodeText = "日本😀éQR".repeat(6);
  const rawBinary = Uint8Array.from(
    Array.from({ length: 34 }, (_, index) =>
      index === 0 ? 0x00 : index === 33 ? 0xff : (index * 29) & 0xff
    )
  );
  const offsetPayload = Uint8Array.from(
    Array.from({ length: 34 }, (_, index) =>
      index === 2 ? 0x00 : index === 31 ? 0xff : (index * 17) & 0xff
    )
  );
  const offsetBacking = Uint8Array.from([0xaa, 0xbb, ...offsetPayload, 0xcc]);
  const offsetView = new Uint8Array(
    offsetBacking.buffer,
    2,
    offsetPayload.length
  );
  const manualMixedSegments = [
    { mode: "alphanumeric", data: "ABCDEFGHIJKLMNOPQRSTU" },
    { mode: "numeric", data: "12345678901234567890" },
    { mode: "byte", data: "é😀XYZ" }
  ];
  const manualMixedText = manualMixedSegments
    .map((segment) => segment.data)
    .join("");
  const manualByteText = "C".repeat(31);
  const manualBinaryPayload = Uint8Array.from(
    Array.from({ length: 31 }, (_, index) =>
      index === 0 ? 0x00 : index === 30 ? 0xff : index
    )
  );
  const manualBinaryBacking = Uint8Array.from([
    0xee,
    ...manualBinaryPayload,
    0xdd
  ]);
  const manualBinaryView = new Uint8Array(
    manualBinaryBacking.buffer,
    1,
    manualBinaryPayload.length
  );
  const fixedText = "D".repeat(52);

  return [
    rawFixture({
      id: "raw-string-2-symbol",
      input: rawTwo,
      expectedTotal: 2,
      originalText: rawTwo,
      options: textOptions({ maxSymbols: 2 })
    }),
    rawFixture({
      id: "raw-string-3-symbol-shuffled",
      input: rawThree,
      expectedTotal: 3,
      originalText: rawThree,
      scanOrder: [2, 0, 1],
      options: textOptions({ maxSymbols: 3 })
    }),
    rawFixture({
      id: "raw-string-16-symbol",
      input: rawSixteen,
      expectedTotal: 16,
      originalText: rawSixteen,
      options: textOptions({ maxSymbols: 16 })
    }),
    rawFixture({
      id: "utf8-astral-text",
      input: unicodeText,
      expectedTotal: 6,
      originalText: unicodeText,
      options: {
        version: 1,
        errorCorrectionLevel: "L",
        mode: "byte",
        maxSymbols: 16,
        scale: 8,
        margin: 4
      }
    }),
    rawFixture({
      id: "raw-binary",
      input: rawBinary,
      inputKind: "binary",
      expectedTotal: 3,
      originalBytes: rawBinary,
      payloadAssertion: binaryMetadataOnly(),
      options: binaryOptions()
    }),
    rawFixture({
      id: "raw-binary-offset-view",
      input: offsetView,
      inputKind: "array-buffer-view-offset",
      expectedTotal: 3,
      originalBytes: offsetPayload,
      payloadAssertion: binaryMetadataOnly(),
      options: binaryOptions()
    }),
    manualFixture({
      id: "manual-mixed-segments",
      segments: manualMixedSegments,
      expectedTotal: 3,
      originalText: manualMixedText,
      options: manualOptions()
    }),
    manualFixture({
      id: "manual-byte-text-chunk",
      segments: [{ mode: "byte", data: manualByteText }],
      expectedTotal: 3,
      originalText: manualByteText,
      options: manualOptions()
    }),
    manualFixture({
      id: "manual-byte-binary-boundary",
      segments: [{ mode: "byte", data: manualBinaryView }],
      inputKind: "manual-byte-array-buffer-view-offset",
      expectedTotal: 3,
      originalBytes: manualBinaryPayload,
      payloadAssertion: binaryMetadataOnly(),
      options: manualOptions()
    }),
    rawFixture({
      id: "fixed-version-ecc-mask",
      input: fixedText,
      expectedTotal: 2,
      originalText: fixedText,
      fixedMask: 3,
      options: {
        version: 2,
        errorCorrectionLevel: "Q",
        maskPattern: 3,
        mode: "alphanumeric",
        maxSymbols: 2,
        scale: 8,
        margin: 4
      }
    })
  ];
}

function rawFixture({
  id,
  input,
  options,
  expectedTotal,
  originalText,
  originalBytes,
  inputKind = "string",
  payloadAssertion = { kind: "text-merge" },
  scanOrder,
  fixedMask
}) {
  return {
    id,
    expectedTotal,
    originalText,
    originalBytes,
    inputKind,
    payloadAssertion,
    scanOrder,
    fixedMask,
    generate(renderOptions) {
      return generateStructuredAppend(input, {
        ...options,
        ...renderOptions
      });
    }
  };
}

function manualFixture({
  id,
  segments,
  options,
  expectedTotal,
  originalText,
  originalBytes,
  inputKind = "manual-segments",
  payloadAssertion = { kind: "text-merge" },
  scanOrder,
  fixedMask
}) {
  return {
    id,
    expectedTotal,
    originalText,
    originalBytes,
    inputKind,
    payloadAssertion,
    scanOrder,
    fixedMask,
    generate(renderOptions) {
      return generateSegmentsStructuredAppend(segments, {
        ...options,
        ...renderOptions
      });
    }
  };
}

function textOptions(overrides = {}) {
  return {
    version: 1,
    errorCorrectionLevel: "L",
    mode: "alphanumeric",
    maxSymbols: 16,
    scale: 8,
    margin: 4,
    ...overrides
  };
}

function binaryOptions() {
  return {
    version: 1,
    errorCorrectionLevel: "L",
    mode: "byte",
    maxSymbols: 16,
    scale: 8,
    margin: 4
  };
}

function manualOptions() {
  return {
    version: 1,
    errorCorrectionLevel: "L",
    maxSymbols: 16,
    scale: 8,
    margin: 4
  };
}

function binaryMetadataOnly() {
  return {
    kind: "metadata-only",
    reason:
      "ZXing Result.getText() is charset-decoded and cannot preserve arbitrary "
      + "binary payload bytes; sequence and parity metadata are asserted."
  };
}

function pickChunkDiagnostics(summary) {
  const result = {};
  for (const key of [
    "inputStart",
    "inputLength",
    "sourceSegmentStart",
    "sourceSegmentEnd",
    "splitUnitStart",
    "splitUnitLength",
    "byteStart",
    "byteLength"
  ]) {
    if (Object.hasOwn(summary, key)) {
      result[key] = summary[key];
    }
  }
  return result;
}

function metadataInteger(value, label) {
  assert.ok(value, `${label} is missing`);
  assert.equal(value.javaType, "java.lang.Integer", `${label} Java type`);
  assert.match(value.value, /^\d+$/u, `${label} integer value`);
  const parsed = Number(value.value);
  assert.equal(Number.isInteger(parsed), true, `${label} integer`);
  return parsed;
}

function parseSequenceIndicator(value) {
  assert.equal(Number.isInteger(value), true);
  assert.equal(value >= 0 && value <= 0xff, true);
  return {
    index: (value >> 4) + 1,
    total: (value & 0x0f) + 1
  };
}

function assertPng(bytes, id) {
  assert.ok(bytes instanceof Uint8Array, `${id} PNG type`);
  assert.deepEqual(
    Array.from(bytes.subarray(0, 8)),
    [137, 80, 78, 71, 13, 10, 26, 10],
    `${id} PNG signature`
  );
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(path.resolve(filePath)), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function serializeError(error) {
  return {
    name: error?.name ?? "Error",
    message: error?.message ?? String(error),
    stack: error?.stack ?? null
  };
}
