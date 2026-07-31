import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  assertPackageContentPolicy,
  assertReleasePackageMetadata,
  inspectTarball,
  readPackageJsonFromTarball,
  resolveReleaseArtifact,
  verifyReleaseArtifact
} from "./lib/release-artifact.js";

const root = process.cwd();
const cacheDir = process.env.SPECQR_NPM_CACHE ?? path.join(tmpdir(), "specqr-packed-npm-cache");
const directory = await mkdtemp(path.join(tmpdir(), "specqr-packed-"));
const packDirectory = path.join(directory, "pack");
const installDirectory = path.join(directory, "install");
const artifact = await resolveReleaseArtifact();
assert.equal(
  artifact.remainingArgs.length,
  0,
  `Unexpected arguments: ${artifact.remainingArgs.join(" ")}`
);
const sourcePackage = JSON.parse(
  await readFile(path.join(root, "package.json"), "utf8")
);

try {
  await mkdir(packDirectory);
  await mkdir(installDirectory);

  let packed;
  let tarball;
  if (artifact.provided) {
    let inspection;
    let packageJson;
    if (artifact.manifestPath) {
      const verified = await verifyReleaseArtifact({
        tarballPath: artifact.tarballPath,
        manifestPath: artifact.manifestPath,
        expectedVersion: sourcePackage.version
      });
      inspection = verified.inspection;
      packageJson = verified.packageJson;
    } else {
      inspection = await inspectTarball(artifact.tarballPath);
      assertPackageContentPolicy(inspection.contents.files);
      packageJson = await readPackageJsonFromTarball(artifact.tarballPath);
      assertReleasePackageMetadata(packageJson, sourcePackage.version);
    }
    packed = {
      id: `${packageJson.name}@${packageJson.version}`,
      name: packageJson.name,
      version: packageJson.version,
      filename: inspection.tarball.filename,
      size: inspection.tarball.size,
      unpackedSize: inspection.contents.unpackedSize,
      entryCount: inspection.contents.fileCount,
      files: inspection.contents.files
    };
    tarball = artifact.tarballPath;
    console.log(`using provided release artifact ${tarball}`);
  } else {
    const packOutput = await runCapture(
      "npm",
      ["pack", "--json", "--pack-destination", packDirectory, "--cache", cacheDir],
      root
    );
    [packed] = JSON.parse(packOutput);
    tarball = path.join(packDirectory, packed.filename);
  }
  assertPackContents(packed);

  await writeFile(path.join(installDirectory, "package.json"), JSON.stringify({ type: "module" }, null, 2));
  await run(
    "npm",
    ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--cache", cacheDir, tarball],
    installDirectory
  );

  const installedPackage = JSON.parse(
    await readFile(
      path.join(installDirectory, "node_modules", "specqr", "package.json"),
      "utf8"
    )
  );
  assertReleasePackageMetadata(installedPackage, sourcePackage.version);
  await writeSmokeTest(installDirectory);
  await run("node", ["smoke.mjs"], installDirectory);
  await assertTypeDeclarations(installDirectory);
  await verifyInstalledTypeSurface(installDirectory);
  await verifyInstalledExamples(installDirectory);

  console.log(
    `ok packed package smoke ${packed.id} `
      + `(${artifact.provided ? "provided artifact" : "self-packed"})`
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}

async function writeSmokeTest(directory) {
  await writeFile(
    path.join(directory, "smoke.mjs"),
    `import assert from "node:assert/strict";
import * as specqr from "specqr";
import * as nodeHelpers from "specqr/node";
import * as browserHelpers from "specqr/browser";

const ROOT_EXPORTS = [
  "DataTooLongError",
  "GS1_FNC1_SEPARATOR",
  "InvalidCanvasTargetError",
  "InvalidColorError",
  "InvalidEciError",
  "InvalidGs1Error",
  "InvalidInputError",
  "InvalidModeError",
  "InvalidOutputError",
  "InvalidVersionError",
  "QRCode",
  "SpecQRError",
  "analyzeSegments",
  "appendGtinCheckDigit",
  "appendSsccCheckDigit",
  "calculateGs1CheckDigit",
  "calculateGtinCheckDigit",
  "calculateSsccCheckDigit",
  "calculateStructuredAppendParity",
  "calculateStructuredAppendSegmentsParity",
  "createGs1DigitalLink",
  "createGs1ElementString",
  "drawToCanvas",
  "estimate",
  "generate",
  "generateSegments",
  "generateSegmentsStructuredAppend",
  "generateStructuredAppend",
  "getCapacity",
  "getGs1AiInfo",
  "getSupportedGs1Ais",
  "mergeStructuredAppendParts",
  "normalizeGs1DigitalLink",
  "parseGs1DigitalLink",
  "parseGs1ElementString",
  "parseGs1HumanReadable",
  "validateGs1CheckDigit",
  "validateGs1DigitalLink",
  "validateGs1ElementString",
  "validateGs1Elements",
  "validateGtinCheckDigit",
  "validateSsccCheckDigit"
];
const NODE_EXPORTS = [
  "toPngBuffer",
  "toPngBufferFromSegments",
  "writePngFile",
  "writePngFileFromSegments"
];
const BROWSER_EXPORTS = [
  "toBlob",
  "toBlobFromSegments",
  "toImageData",
  "toImageDataFromSegments",
  "toObjectURL",
  "toObjectURLFromSegments"
];

assert.deepEqual(Object.keys(specqr).sort(), ROOT_EXPORTS);
assert.deepEqual(Object.keys(nodeHelpers).sort(), NODE_EXPORTS);
assert.deepEqual(Object.keys(browserHelpers).sort(), BROWSER_EXPORTS);

const packedMatrix = specqr.generate("packed-subpath-contract", {
  output: "matrix",
  margin: 0,
  scale: 1
});
assert.equal(Array.isArray(packedMatrix), true);
assert.equal(packedMatrix.length >= 21, true);
const packedPng = nodeHelpers.toPngBuffer("packed-subpath-contract", {
  margin: 0,
  scale: 1
});
assert.equal(Buffer.isBuffer(packedPng), true);
assert.deepEqual(Array.from(packedPng.subarray(0, 8)), [
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
]);
const packedBlob = browserHelpers.toBlob("packed-subpath-contract", {
  margin: 0,
  scale: 1
});
assert.equal(packedBlob.type, "image/png");
assert.deepEqual(
  Array.from(new Uint8Array(await packedBlob.arrayBuffer()).subarray(0, 8)),
  [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
);

assert.equal(typeof specqr.parseGs1ElementString, "function");
assert.equal(typeof specqr.QRCode.parseGs1ElementString, "function");
assert.equal(typeof specqr.estimate, "function");
assert.equal(typeof specqr.QRCode.estimate, "function");
assert.equal(typeof specqr.analyzeSegments, "function");
assert.equal(typeof specqr.QRCode.analyzeSegments, "function");
assert.equal(typeof specqr.getCapacity, "function");
assert.equal(typeof specqr.QRCode.getCapacity, "function");
assert.equal(typeof specqr.generateStructuredAppend, "function");
assert.equal(typeof specqr.QRCode.generateStructuredAppend, "function");
assert.equal(typeof specqr.generateSegmentsStructuredAppend, "function");
assert.equal(typeof specqr.QRCode.generateSegmentsStructuredAppend, "function");
assert.equal(typeof specqr.calculateStructuredAppendParity, "function");
assert.equal(typeof specqr.QRCode.calculateStructuredAppendParity, "function");
assert.equal(typeof specqr.calculateStructuredAppendSegmentsParity, "function");
assert.equal(typeof specqr.QRCode.calculateStructuredAppendSegmentsParity, "function");
assert.equal(typeof specqr.mergeStructuredAppendParts, "function");
assert.equal(typeof specqr.QRCode.mergeStructuredAppendParts, "function");
assert.equal(typeof specqr.createGs1DigitalLink, "function");
assert.equal(typeof specqr.QRCode.createGs1DigitalLink, "function");
assert.equal(typeof specqr.parseGs1DigitalLink, "function");
assert.equal(typeof specqr.QRCode.parseGs1DigitalLink, "function");
assert.equal(typeof specqr.getSupportedGs1Ais, "function");
assert.equal(typeof specqr.QRCode.getSupportedGs1Ais, "function");
assert.equal(typeof specqr.getGs1AiInfo, "function");
assert.equal(typeof specqr.QRCode.getGs1AiInfo, "function");
assert.equal(typeof specqr.validateGs1Elements, "function");
assert.equal(typeof specqr.QRCode.validateGs1Elements, "function");
assert.equal(typeof specqr.validateGs1ElementString, "function");
assert.equal(typeof specqr.QRCode.validateGs1ElementString, "function");
assert.equal(typeof specqr.validateGs1DigitalLink, "function");
assert.equal(typeof specqr.QRCode.validateGs1DigitalLink, "function");
assert.equal(typeof specqr.normalizeGs1DigitalLink, "function");
assert.equal(typeof specqr.QRCode.normalizeGs1DigitalLink, "function");

const validDigitalLink = specqr.validateGs1DigitalLink(
  "https://example.com/01/04912345678904/10/LOT-A?17=251231"
);
assert.equal(validDigitalLink.ok, true);
assert.deepEqual(validDigitalLink.result.elements, [
  { ai: "01", value: "04912345678904" },
  { ai: "10", value: "LOT-A" },
  { ai: "17", value: "251231" }
]);
const digitalLinkWithUnknownQuery = specqr.validateGs1DigitalLink(
  "https://example.com/01/04912345678904?foo=one&17=251231&foo=two"
);
assert.equal(digitalLinkWithUnknownQuery.ok, true);
assert.deepEqual(digitalLinkWithUnknownQuery.result.unknownQuery, [
  { key: "foo", value: "one" },
  { key: "foo", value: "two" }
]);
assert.deepEqual(specqr.QRCode.validateGs1DigitalLink(
  "https://example.com/01/04912345678904?linkType=all",
  { unknownQuery: "reject" }
), {
  ok: false,
  errors: [
    {
      code: "GS1_DIGITAL_LINK_UNKNOWN_QUERY",
      message: "GS1 Digital Link query parameter \\"linkType\\" is not a GS1 AI",
      key: "linkType",
      reason: "unknown-query",
      expected: "GS1 AI query parameter or unknownQuery: \\"preserve\\""
    }
  ],
  warnings: []
});
assert.equal(
  specqr.normalizeGs1DigitalLink("https://example.com/01/04912345678904?17=251231&10=LOT%2FA&foo=bar"),
  "https://example.com/01/04912345678904/10/LOT%2FA?17=251231&foo=bar"
);
const packedNormalizedDigitalLink =
  "https://example.com/01/04912345678904/10/LOT%2FA?17=251231&foo=bar";
const packedEstimate = specqr.estimate("https://example.com", {
  errorCorrectionLevel: "Q",
  margin: 1
});
assert.equal(packedEstimate.ok, true);
assert.equal(packedEstimate.diagnostics.phase, "planning");
assert.equal(packedEstimate.diagnostics.renderPlanned, false);
assert.equal(packedEstimate.warnings.some((warning) => warning.code === "QUIET_ZONE_TOO_SMALL"), true);
const packedAnalyzeSegments = specqr.QRCode.analyzeSegments([
  { mode: "numeric", data: "12345" },
  { mode: "byte", data: "abc" }
], {
  version: 1,
  errorCorrectionLevel: "L"
});
assert.equal(packedAnalyzeSegments.ok, true);
assert.equal(packedAnalyzeSegments.mode, "mixed");
const packedTooLong = specqr.estimate("a".repeat(100), {
  version: 1,
  errorCorrectionLevel: "H",
  mode: "byte"
});
assert.equal(packedTooLong.ok, false);
assert.equal(packedTooLong.reason, "data-too-long");
assert.equal(packedTooLong.error.code, "DATA_TOO_LONG");
assert.deepEqual(specqr.getCapacity({ version: 1, errorCorrectionLevel: "L", mode: "byte" }), {
  version: 1,
  errorCorrectionLevel: "L",
  size: 21,
  dataCodewords: 19,
  totalCodewords: 26,
  capacityBits: 152,
  mode: "byte",
  characterCountBits: 8,
  modeIndicatorBits: 4,
  controlBits: 0,
  payloadBits: 140,
  maxCharacters: null,
  maxBytes: 17
});
assert.equal(specqr.QRCode.normalizeGs1DigitalLink(packedNormalizedDigitalLink), packedNormalizedDigitalLink);
assert.equal(specqr.normalizeGs1DigitalLink(specqr.normalizeGs1DigitalLink(packedNormalizedDigitalLink)), packedNormalizedDigitalLink);
assert.throws(
  () => specqr.normalizeGs1DigitalLink("https://example.com/01/04912345678904?17=251231&17=251231"),
  (error) => error instanceof specqr.InvalidGs1Error && /duplicate AI 17/.test(error.message)
);

const fnc1Second = specqr.generate("AA1234BBB112", {
  fnc1Second: "37",
  mode: "alphanumeric",
  version: 1,
  errorCorrectionLevel: "Q",
  output: "matrix",
  diagnostics: true
});
assert.equal(fnc1Second.diagnostics.fnc1, "second-position");
assert.deepEqual(fnc1Second.diagnostics.fnc1Second, {
  enabled: true,
  applicationIndicator: "37",
  applicationIndicatorCodeword: 37
});

const manualFnc1Second = specqr.QRCode.generateSegments([
  { mode: "fnc1-second", applicationIndicator: "A" },
  { mode: "byte", data: "abc" }
], {
  version: 1,
  errorCorrectionLevel: "L",
  output: "matrix",
  diagnostics: true
});
assert.equal(manualFnc1Second.diagnostics.fnc1Second.applicationIndicatorCodeword, 165);

const structuredAppend = specqr.generate("HELLO", {
  structuredAppend: { index: 2, total: 5, parity: 167 },
  mode: "alphanumeric",
  version: 1,
  errorCorrectionLevel: "M",
  output: "matrix",
  diagnostics: true
});
assert.deepEqual(structuredAppend.diagnostics.structuredAppend, {
  enabled: true,
  index: 2,
  total: 5,
  parity: 167,
  sequenceIndex: 1,
  sequenceTotal: 4,
  sequenceIndicator: 20
});

const manualStructuredAppend = specqr.QRCode.generateSegments([
  { mode: "structured-append", index: 2, total: 5, parity: 167 },
  { mode: "alphanumeric", data: "HELLO" }
], {
  version: 1,
  errorCorrectionLevel: "M",
  output: "matrix",
  diagnostics: true
});
assert.deepEqual(manualStructuredAppend.diagnostics.structuredAppend, structuredAppend.diagnostics.structuredAppend);

const highLevelStructuredAppendInput = "A".repeat(31);
const highLevelStructuredAppend = specqr.generateStructuredAppend(highLevelStructuredAppendInput, {
  version: 1,
  errorCorrectionLevel: "L",
  mode: "alphanumeric",
  output: "matrix",
  diagnostics: true
});
assert.equal(highLevelStructuredAppend.total, 2);
assert.equal(highLevelStructuredAppend.parity, 65);
assert.equal(specqr.calculateStructuredAppendParity(highLevelStructuredAppendInput), highLevelStructuredAppend.parity);
assert.equal(specqr.QRCode.calculateStructuredAppendParity(Uint8Array.from([0x00, 0xff, 0x41])), 0x00 ^ 0xff ^ 0x41);
assert.throws(
  () => specqr.calculateStructuredAppendParity([256]),
  (error) => error instanceof specqr.InvalidInputError && error.code === "INVALID_INPUT"
);
assert.deepEqual(
  highLevelStructuredAppend.diagnostics.symbols.map((symbol) => ({
    index: symbol.index,
    total: symbol.total,
    parity: symbol.parity,
    version: symbol.version,
    maskPattern: symbol.maskPattern
  })),
  [
    { index: 1, total: 2, parity: 65, version: 1, maskPattern: highLevelStructuredAppend.diagnostics.symbols[0].maskPattern },
    { index: 2, total: 2, parity: 65, version: 1, maskPattern: highLevelStructuredAppend.diagnostics.symbols[1].maskPattern }
  ]
);
assert.equal(highLevelStructuredAppend.symbols[0].diagnostics.structuredAppend.sequenceIndicator, 1);
assert.equal(highLevelStructuredAppend.symbols[1].diagnostics.structuredAppend.sequenceIndicator, 17);

const mergeParts = highLevelStructuredAppend.diagnostics.symbols.map((symbol) => ({
  index: symbol.index,
  total: symbol.total,
  parity: symbol.parity,
  data: highLevelStructuredAppendInput.slice(symbol.inputStart, symbol.inputStart + symbol.inputLength)
}));
const mergedStructuredAppend = specqr.mergeStructuredAppendParts([mergeParts[1], mergeParts[0]]);
assert.equal(mergedStructuredAppend.data, highLevelStructuredAppendInput);
assert.equal(mergedStructuredAppend.total, 2);
assert.equal(mergedStructuredAppend.parity, highLevelStructuredAppend.parity);
assert.equal(mergedStructuredAppend.diagnostics.parityCheck.matches, true);

const packedBinaryParts = [
  { index: 2, total: 2, parity: 0, data: Uint8Array.from([0x02, 0x03]) },
  { index: 1, total: 2, parity: 0, data: new Uint8Array(Uint8Array.from([0xaa, 0x00, 0x01, 0xbb]).buffer, 1, 2) }
];
const packedBinaryMerge = specqr.QRCode.mergeStructuredAppendParts(packedBinaryParts);
assert.deepEqual(Array.from(packedBinaryMerge.data), [0x00, 0x01, 0x02, 0x03]);
assert.equal(packedBinaryMerge.diagnostics.dataType, "binary");

const highLevelStructuredAppendStatic = specqr.QRCode.generateStructuredAppend("A".repeat(31), {
  version: 1,
  errorCorrectionLevel: "L",
  mode: "alphanumeric",
  output: "svg"
});
assert.equal(highLevelStructuredAppendStatic.total, 2);
assert.match(highLevelStructuredAppendStatic.symbols[0], /^<svg /);

const manualSegmentsStructuredAppend = specqr.generateSegmentsStructuredAppend([
  { mode: "alphanumeric", data: "ABCDEFGHIJKLMNOPQRSTU" },
  { mode: "numeric", data: "12345678901234567890" }
], {
  version: 1,
  errorCorrectionLevel: "L",
  output: "matrix",
  diagnostics: true
});
assert.equal(manualSegmentsStructuredAppend.total, 2);
assert.equal(manualSegmentsStructuredAppend.inputLength, 2);
assert.equal(manualSegmentsStructuredAppend.diagnostics.splitStrategy, "segment-boundary-byte-chunk");
assert.equal(manualSegmentsStructuredAppend.diagnostics.splitUnitsDetail, "summary");
assert.equal(manualSegmentsStructuredAppend.diagnostics.splitUnitCount, 2);
assert.equal(Object.hasOwn(manualSegmentsStructuredAppend.diagnostics, "splitUnits"), false);
assert.equal(JSON.stringify(manualSegmentsStructuredAppend.diagnostics).includes('"splitUnits":'), false);
assert.equal(
  Object.hasOwn(structuredClone(manualSegmentsStructuredAppend.diagnostics), "splitUnits"),
  false
);
assert.deepEqual(
  manualSegmentsStructuredAppend.symbols.map((symbol) => symbol.diagnostics.structuredAppend.index),
  [1, 2]
);

const manualSegmentsStructuredAppendStatic = specqr.QRCode.generateSegmentsStructuredAppend([
  { mode: "byte", data: Uint8Array.from({ length: 31 }, (_, index) => index) }
], {
  version: 1,
  errorCorrectionLevel: "L",
  output: "svg",
  diagnostics: {
    splitUnits: "full",
    symbolResults: "output"
  }
});
assert.equal(manualSegmentsStructuredAppendStatic.total, 3);
assert.match(manualSegmentsStructuredAppendStatic.symbols[0], /^<svg /);
assert.equal(manualSegmentsStructuredAppendStatic.diagnostics.splitUnitsDetail, "full");
assert.equal(manualSegmentsStructuredAppendStatic.diagnostics.splitUnitCount, 31);
assert.equal(manualSegmentsStructuredAppendStatic.diagnostics.splitUnits.length, 31);
assert.equal(Object.hasOwn(manualSegmentsStructuredAppendStatic.diagnostics, "splitUnits"), true);
assert.equal(
  structuredClone(manualSegmentsStructuredAppendStatic.diagnostics).splitUnits.length,
  31
);

const manualSegmentsParityInput = [
  { mode: "alphanumeric", data: "ABCDEFGHIJKLMNOPQRSTU" },
  { mode: "numeric", data: "12345678901234567890" },
  { mode: "byte", data: new Uint8Array(Uint8Array.from([0xaa, 0x00, 0xff, 0xbb]).buffer, 1, 2) }
];
assert.equal(
  specqr.calculateStructuredAppendSegmentsParity(manualSegmentsParityInput),
  specqr.generateSegmentsStructuredAppend(manualSegmentsParityInput, {
    version: 1,
    errorCorrectionLevel: "L",
    output: "matrix"
  }).parity
);
assert.equal(
  specqr.QRCode.calculateStructuredAppendSegmentsParity([{ mode: "byte", data: "こんにちは" }]),
  specqr.calculateStructuredAppendParity("こんにちは")
);
assert.throws(
  () => specqr.calculateStructuredAppendSegmentsParity([{ mode: "byte", data: [256] }]),
  (error) => error instanceof specqr.InvalidInputError && error.code === "INVALID_INPUT"
);
assert.throws(
  () => specqr.calculateStructuredAppendSegmentsParity([{ mode: "eci", assignmentNumber: 26 }, { mode: "byte", data: "ABC" }]),
  (error) => error instanceof specqr.InvalidModeError && error.code === "INVALID_MODE"
);
assert.throws(
  () => specqr.generateSegmentsStructuredAppend(manualSegmentsParityInput, {
    diagnostics: { splitUnits: "all" }
  }),
  (error) => error instanceof specqr.InvalidInputError &&
    error.code === "INVALID_INPUT" &&
    error.message === 'diagnostics.splitUnits must be "summary" or "full"; got all'
);
assert.throws(
  () => specqr.generateStructuredAppend("A".repeat(31), {
    diagnostics: { splitUnits: "summary" }
  }),
  (error) => error instanceof specqr.InvalidInputError &&
    error.code === "INVALID_INPUT" &&
    error.message === "generateStructuredAppend diagnostics must be a boolean"
);

const rawWithSeparator = "010491234567890410ABC123\\x1D17251231";
assert.deepEqual(specqr.parseGs1ElementString(rawWithSeparator), {
  elements: [
    { ai: "01", value: "04912345678904" },
    { ai: "10", value: "ABC123" },
    { ai: "17", value: "251231" }
  ],
  hasSeparators: true
});

assert.deepEqual(specqr.QRCode.parseGs1ElementString("010491234567890417251231"), {
  elements: [
    { ai: "01", value: "04912345678904" },
    { ai: "17", value: "251231" }
  ],
  hasSeparators: false
});

assert.equal(
  specqr.createGs1DigitalLink(specqr.parseGs1ElementString(rawWithSeparator), {
    baseUrl: "https://example.com/"
  }),
  "https://example.com/01/04912345678904/10/ABC123?17=251231"
);
assert.equal(specqr.getGs1AiInfo("01").checkDigitRule, "gtin");
assert.equal(specqr.QRCode.getSupportedGs1Ais().some((metadata) => metadata.ai === "3105"), true);
assert.deepEqual(specqr.validateGs1Elements([{ ai: "01", value: "04912345678904" }]), {
  ok: true,
  elements: [{ ai: "01", value: "04912345678904" }],
  warnings: []
});
assert.deepEqual(specqr.QRCode.validateGs1ElementString(rawWithSeparator), {
  ok: true,
  elements: [
    { ai: "01", value: "04912345678904" },
    { ai: "10", value: "ABC123" },
    { ai: "17", value: "251231" }
  ],
  hasSeparators: true,
  warnings: []
});
assert.equal(
  specqr.validateGs1ElementString("010491234567890410ABC12317251231").errors[0].code,
  "GS1_MISSING_SEPARATOR"
);
assert.equal(
  specqr.QRCode.createGs1DigitalLink([{ ai: "01", value: "04912345678904" }], {
    baseUrl: "https://example.com/stem/"
  }),
  "https://example.com/stem/01/04912345678904"
);
assert.deepEqual(specqr.parseGs1DigitalLink("https://example.com/01/04912345678904/10/ABC123?17=251231&foo=bar"), {
  elements: [
    { ai: "01", value: "04912345678904" },
    { ai: "10", value: "ABC123" },
    { ai: "17", value: "251231" }
  ],
  primary: { ai: "01", value: "04912345678904" },
  pathElements: [
    { ai: "01", value: "04912345678904" },
    { ai: "10", value: "ABC123" }
  ],
  queryElements: [
    { ai: "17", value: "251231" }
  ],
  unknownQuery: [
    { key: "foo", value: "bar" }
  ]
});
assert.equal(
  specqr.createGs1DigitalLink(
    specqr.QRCode.parseGs1DigitalLink("https://example.com/01/04912345678904/10/ABC123?17=251231"),
    { baseUrl: "https://example.com" }
  ),
  "https://example.com/01/04912345678904/10/ABC123?17=251231"
);

assert.throws(
  () => specqr.parseGs1ElementString("010491234567890410ABC12317251231"),
  (error) => error instanceof specqr.InvalidGs1Error && error.code === "INVALID_GS1"
);
assert.throws(
  () => specqr.mergeStructuredAppendParts([mergeParts[0]]),
  (error) => error instanceof specqr.InvalidInputError && error.code === "INVALID_INPUT"
);
assert.throws(
  () => specqr.createGs1DigitalLink([{ ai: "01", value: "04912345678905" }], {
    baseUrl: "https://example.com"
  }),
  (error) => error instanceof specqr.InvalidGs1Error && error.code === "INVALID_GS1"
);
assert.throws(
  () => specqr.parseGs1DigitalLink("https://example.com/01/04912345678905"),
  (error) => error instanceof specqr.InvalidGs1Error && error.code === "INVALID_GS1"
);
`
  );
}

async function assertTypeDeclarations(directory) {
  const declarations = await readFile(
    path.join(directory, "node_modules", "specqr", "src", "index.d.ts"),
    "utf8"
  );

  assert.match(declarations, /export interface GS1Element\s*{\s*ai: string;\s*value: string;\s*}/);
  assert.match(
    declarations,
    /export interface GS1ElementStringParseResult\s*{\s*elements: GS1Element\[];\s*hasSeparators: boolean;\s*}/
  );
  assert.match(
    declarations,
    /export function parseGs1ElementString\(input: string\): GS1ElementStringParseResult;/
  );
  assert.match(declarations, /export interface QRPlanningDiagnostics\s*{/);
  assert.match(declarations, /export type QREstimateResult = QREstimateSuccess \| QREstimateFailure;/);
  assert.match(declarations, /export interface QRCapacityInfo\s*{/);
  assert.match(declarations, /export function estimate\(input: QRInput, options\?: QREstimateOptions\): QREstimateResult;/);
  assert.match(declarations, /export function analyzeSegments\(segments: QRSegmentInput\[], options\?: QREstimateOptions\): QREstimateResult;/);
  assert.match(declarations, /export function getCapacity\(options: QRGetCapacityOptions\): QRCapacityInfo;/);
  assert.match(declarations, /export interface GS1AiInfo\s*{/);
  assert.match(declarations, /export interface GS1ValidationError\s*{/);
  assert.match(declarations, /export type GS1ValidationResult = GS1ValidationSuccess \| GS1ValidationFailure;/);
  assert.match(declarations, /export function getSupportedGs1Ais\(\): GS1AiInfo\[];/);
  assert.match(declarations, /export function getGs1AiInfo\(ai: string\): GS1AiInfo \| null;/);
  assert.match(
    declarations,
    /export function validateGs1Elements\(elements: GS1Element\[], options\?: GS1ValidationOptions\): GS1ValidationResult;/
  );
  assert.match(
    declarations,
    /export function validateGs1ElementString\(\s*input: string,\s*options\?: GS1ValidationOptions\s*\): GS1ElementStringValidationResult;/
  );
  assert.match(declarations, /fnc1Second\?: false \| string;/);
  assert.match(declarations, /structuredAppend\?: false \| QRStructuredAppendOptions;/);
  assert.match(declarations, /\| { mode: "fnc1-second"; applicationIndicator: string }/);
  assert.match(declarations, /\| \({ mode: "structured-append" } & QRStructuredAppendOptions\)/);
  assert.match(declarations, /export interface QRFnc1SecondDiagnostics\s*{/);
  assert.match(declarations, /export interface QRStructuredAppendDiagnostics\s*{/);
  assert.match(declarations, /export interface QRStructuredAppendGenerateOptions extends Omit</);
  assert.match(declarations, /export interface QRStructuredAppendSummaryDiagnostics\s*{/);
  assert.match(declarations, /export interface QRStructuredAppendSegmentsGenerateOptions extends Omit</);
  assert.match(declarations, /export interface QRStructuredAppendSegmentsDiagnosticsOptions\s*{/);
  assert.match(declarations, /export interface QRStructuredAppendSegmentsSummaryDiagnosticsBase\s*{/);
  assert.match(declarations, /export interface QRStructuredAppendSegmentsStandardDiagnostics\s+/);
  assert.match(declarations, /export interface QRStructuredAppendSegmentsFullDiagnostics\s+/);
  assert.match(
    declarations,
    /export type QRStructuredAppendSegmentsSummaryDiagnostics =\s*\| QRStructuredAppendSegmentsStandardDiagnostics\s*\| QRStructuredAppendSegmentsFullDiagnostics;/
  );
  assert.match(
    declarations,
    /export interface QRStructuredAppendSegmentsResult<\s*TSymbol = QRGenerateResult,\s*TDiagnostics extends QRStructuredAppendSegmentsSummaryDiagnostics =\s*QRStructuredAppendSegmentsSummaryDiagnostics\s*>/
  );
  assert.match(declarations, /export type QRStructuredAppendParityInput = QRInput;/);
  assert.match(declarations, /export interface QRStructuredAppendSegmentsParityOptions\s*{/);
  assert.match(declarations, /export interface QRStructuredAppendDecodedPart<TData extends QRStructuredAppendPartData = QRStructuredAppendPartData>\s*{/);
  assert.match(declarations, /export interface QRStructuredAppendMergeResult<TData extends string \| Uint8Array = string \| Uint8Array>\s*{/);
  assert.match(declarations, /export interface QRStructuredAppendMergeDiagnostics\s*{/);
  assert.match(
    declarations,
    /export function generateStructuredAppend\(input: QRInput, options: QRStructuredAppendGenerateOptions & \{ diagnostics: true \}\): QRStructuredAppendResult<QRCodeDiagnosticResult>;/
  );
  assert.match(
    declarations,
    /export function generateSegmentsStructuredAppend\(segments: QRSegmentInput\[], options: QRStructuredAppendSegmentsGenerateOptions & \{ diagnostics: QRStructuredAppendSegmentsFullDiagnosticSelection \}\): QRStructuredAppendSegmentsResult<QRCodeDiagnosticResult, QRStructuredAppendSegmentsFullDiagnostics>;/
  );
  assert.match(
    declarations,
    /export function generateSegmentsStructuredAppend\(segments: QRSegmentInput\[], options: QRStructuredAppendSegmentsGenerateOptions & \{ diagnostics: QRStructuredAppendSegmentsStandardDiagnosticSelection \}\): QRStructuredAppendSegmentsResult<QRCodeDiagnosticResult, QRStructuredAppendSegmentsStandardDiagnostics>;/
  );
  assert.match(
    declarations,
    /export function generate\(input: QRInput, options\?: QRCodeOptions\): QRGenerateResult;/
  );
  assert.match(
    declarations,
    /export function generateSegments\(segments: QRSegmentInput\[], options\?: QRCodeOptions\): QRGenerateResult;/
  );
  assert.match(
    declarations,
    /export function generateStructuredAppend\(input: QRInput, options\?: QRStructuredAppendGenerateOptions\): QRStructuredAppendResult;/
  );
  assert.match(
    declarations,
    /export function generateSegmentsStructuredAppend\(segments: QRSegmentInput\[], options\?: QRStructuredAppendSegmentsGenerateOptions\): QRStructuredAppendSegmentsResult;/
  );
  assert.match(declarations, /interface QRPortableCanvasContextLike\s*{/);
  assert.match(declarations, /interface QRPortableCanvasLike\s*{/);
  assert.match(
    declarations,
    /export function calculateStructuredAppendParity\(input: QRStructuredAppendParityInput\): number;/
  );
  assert.match(
    declarations,
    /export function calculateStructuredAppendSegmentsParity\(\s*segments: QRSegmentInput\[],\s*options\?: QRStructuredAppendSegmentsParityOptions\s*\): number;/
  );
  assert.match(
    declarations,
    /export function mergeStructuredAppendParts\(parts: QRStructuredAppendDecodedPart<string>\[], options\?: QRStructuredAppendMergeOptions\): QRStructuredAppendMergeResult<string>;/
  );
  assert.match(
    declarations,
    /export function createGs1DigitalLink\(\s*input: GS1Element\[] \| GS1ElementStringParseResult,\s*options: GS1DigitalLinkOptions\s*\): string;/
  );
  assert.match(
    declarations,
    /export function parseGs1DigitalLink\(\s*uri: string \| URL,\s*options\?: GS1DigitalLinkParseOptions\s*\): GS1DigitalLinkParseResult;/
  );
  assert.match(
    declarations,
    /export function validateGs1DigitalLink\(\s*uri: string \| URL,\s*options\?: GS1DigitalLinkValidationOptions\s*\): GS1DigitalLinkValidationResult;/
  );
  assert.match(
    declarations,
    /export function normalizeGs1DigitalLink\(\s*uri: string \| URL,\s*options\?: GS1DigitalLinkNormalizeOptions\s*\): string;/
  );
  assert.match(
    declarations,
    /static parseGs1ElementString\(input: string\): GS1ElementStringParseResult;/
  );
  assert.match(declarations, /static estimate\(input: QRInput, options\?: QREstimateOptions\): QREstimateResult;/);
  assert.match(declarations, /static analyzeSegments\(segments: QRSegmentInput\[], options\?: QREstimateOptions\): QREstimateResult;/);
  assert.match(declarations, /static getCapacity\(options: QRGetCapacityOptions\): QRCapacityInfo;/);
  assert.match(declarations, /static getSupportedGs1Ais\(\): GS1AiInfo\[];/);
  assert.match(declarations, /static validateGs1ElementString\(input: string, options\?: GS1ValidationOptions\): GS1ElementStringValidationResult;/);
  assert.match(declarations, /static generateStructuredAppend\(input: QRInput/);
  assert.match(declarations, /static generateSegmentsStructuredAppend\(segments: QRSegmentInput\[]/);
  assert.match(
    declarations,
    /static generate\(input: QRInput, options\?: QRCodeOptions\): QRGenerateResult;/
  );
  assert.match(
    declarations,
    /static generateSegments\(segments: QRSegmentInput\[], options\?: QRCodeOptions\): QRGenerateResult;/
  );
  assert.match(declarations, /static calculateStructuredAppendParity\(input: QRStructuredAppendParityInput\): number;/);
  assert.match(
    declarations,
    /static calculateStructuredAppendSegmentsParity\(\s*segments: QRSegmentInput\[],\s*options\?: QRStructuredAppendSegmentsParityOptions\s*\): number;/
  );
  assert.match(declarations, /static mergeStructuredAppendParts\(parts: QRStructuredAppendDecodedPart<string>\[]/);
  assert.match(declarations, /static createGs1DigitalLink\(/);
  assert.match(declarations, /static parseGs1DigitalLink\(/);
  assert.match(declarations, /static validateGs1DigitalLink\(/);
  assert.match(declarations, /static normalizeGs1DigitalLink\(/);
}

async function verifyInstalledTypeSurface(directory) {
  const fixtureDirectory = path.join(directory, "types");
  await mkdir(fixtureDirectory);

  for (const fixture of ["root-node-nodom.ts", "browser-dom.ts"]) {
    const source = await readFile(path.join(root, "tests", "types", fixture), "utf8");
    await writeFile(path.join(fixtureDirectory, fixture), source);
  }

  const nodeTypeRoot = path.join(root, "node_modules", "@types");
  await writeFile(
    path.join(fixtureDirectory, "tsconfig.root-node.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        lib: ["ES2022"],
        typeRoots: [nodeTypeRoot],
        types: ["node"],
        strict: true,
        noEmit: true,
        skipLibCheck: false
      },
      include: ["root-node-nodom.ts"]
    }, null, 2)
  );
  await writeFile(
    path.join(fixtureDirectory, "tsconfig.browser.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "Bundler",
        lib: ["ES2022", "DOM"],
        types: [],
        strict: true,
        noEmit: true,
        skipLibCheck: false
      },
      include: ["browser-dom.ts"]
    }, null, 2)
  );

  const tsc = path.join(root, "node_modules", "typescript", "bin", "tsc");
  await run(process.execPath, [tsc, "-p", "tsconfig.root-node.json"], fixtureDirectory);
  await run(process.execPath, [tsc, "-p", "tsconfig.browser.json"], fixtureDirectory);
}

async function verifyInstalledExamples(directory) {
  const packageRoot = path.join(directory, "node_modules", "specqr");
  const exampleOutput = path.join(directory, "structured-append-example");
  for (const [example, args = []] of [
    ["examples/gs1-digital-link.mjs"],
    ["examples/planning-api.mjs"],
    ["examples/structured-append-merge.mjs"],
    ["examples/structured-append.mjs", [exampleOutput]]
  ]) {
    await run(
      process.execPath,
      [path.join(packageRoot, example), ...args],
      packageRoot
    );
  }
}

function assertPackContents(packed) {
  assert.ok(Array.isArray(packed.files), "npm pack --json should include a files list");
  const paths = packed.files.map((file) => file.path).sort();
  const required = [
    "README.md",
    "CHANGELOG.md",
    "SECURITY.md",
    "CONTRIBUTING.md",
    "LICENSE",
    "package.json",
    "src/index.js",
    "src/index.d.ts",
    "src/node.js",
    "src/node.d.ts",
    "src/browser.js",
    "src/browser.d.ts",
    "docs/api.md",
    "docs/public-api-contract.md",
    "docs/release.md",
    "docs/release-notes-3.0.0-rc.1.md",
    "docs/gs1-supported-ai.md",
    "docs/spec-scope.md",
    "docs/conformance.md",
    "docs/test-plan.md",
    "docs/v2-roadmap.md",
    "docs/v3-migration.md",
    "docs/v3-roadmap.md",
    "docs/v3-structured-append-diagnostics.md",
    "docs/structured-append-parity-v2.3.md",
    "docs/structured-append-segments-parity-v2.3.md",
    "examples/gs1-digital-link.mjs",
    "examples/planning-api.mjs",
    "examples/structured-append.mjs",
    "examples/structured-append-merge.mjs",
    "playground/index.html",
    "tools/verify-packed-package.js"
  ];

  for (const requiredPath of required) {
    assert.ok(paths.includes(requiredPath), `packed package should include ${requiredPath}`);
  }

  for (const packedPath of paths) {
    assert.equal(packedPath.startsWith("e2e/"), false, `packed package should not include ${packedPath}`);
    assert.equal(packedPath.includes("node_modules/"), false, `packed package should not include ${packedPath}`);
    assert.equal(packedPath.startsWith("tmp/"), false, `packed package should not include ${packedPath}`);
    assert.equal(packedPath.startsWith("dist/"), false, `packed package should not include ${packedPath}`);
    assert.equal(packedPath.startsWith(".github/"), false, `packed package should not include ${packedPath}`);
    assert.equal(packedPath.endsWith(".tgz"), false, `packed package should not include ${packedPath}`);
    assert.equal(packedPath.endsWith(".DS_Store"), false, `packed package should not include ${packedPath}`);
  }
}

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit"
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
      }
    });
  });
}

function runCapture(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`${command} ${args.join(" ")} exited with ${code}\n${stderr}`));
      }
    });
  });
}
