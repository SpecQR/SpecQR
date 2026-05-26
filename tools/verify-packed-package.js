import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const root = process.cwd();
const cacheDir = process.env.SPECQR_NPM_CACHE ?? path.join(tmpdir(), "specqr-packed-npm-cache");
const directory = await mkdtemp(path.join(tmpdir(), "specqr-packed-"));
const packDirectory = path.join(directory, "pack");
const installDirectory = path.join(directory, "install");

try {
  await mkdir(packDirectory);
  await mkdir(installDirectory);

  const packOutput = await runCapture(
    "npm",
    ["pack", "--json", "--pack-destination", packDirectory, "--cache", cacheDir],
    root
  );
  const [packed] = JSON.parse(packOutput);
  assertPackContents(packed);
  const tarball = path.join(packDirectory, packed.filename);

  await writeFile(path.join(installDirectory, "package.json"), JSON.stringify({ type: "module" }, null, 2));
  await run(
    "npm",
    ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--cache", cacheDir, tarball],
    installDirectory
  );

  await writeSmokeTest(installDirectory);
  await run("node", ["smoke.mjs"], installDirectory);
  await assertTypeDeclarations(installDirectory);

  console.log(`ok packed package smoke ${packed.id}`);
} finally {
  await rm(directory, { recursive: true, force: true });
}

async function writeSmokeTest(directory) {
  await writeFile(
    path.join(directory, "smoke.mjs"),
    `import assert from "node:assert/strict";
import * as specqr from "specqr";

assert.equal(typeof specqr.parseGs1ElementString, "function");
assert.equal(typeof specqr.QRCode.parseGs1ElementString, "function");
assert.equal(typeof specqr.generateStructuredAppend, "function");
assert.equal(typeof specqr.QRCode.generateStructuredAppend, "function");
assert.equal(typeof specqr.generateSegmentsStructuredAppend, "function");
assert.equal(typeof specqr.QRCode.generateSegmentsStructuredAppend, "function");
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
assert.deepEqual(
  manualSegmentsStructuredAppend.symbols.map((symbol) => symbol.diagnostics.structuredAppend.index),
  [1, 2]
);

const manualSegmentsStructuredAppendStatic = specqr.QRCode.generateSegmentsStructuredAppend([
  { mode: "byte", data: Uint8Array.from({ length: 31 }, (_, index) => index) }
], {
  version: 1,
  errorCorrectionLevel: "L",
  output: "svg"
});
assert.equal(manualSegmentsStructuredAppendStatic.total, 3);
assert.match(manualSegmentsStructuredAppendStatic.symbols[0], /^<svg /);

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
  assert.match(declarations, /export interface QRStructuredAppendSegmentsSummaryDiagnostics\s*{/);
  assert.match(declarations, /export interface QRStructuredAppendSegmentsResult<TSymbol = QRGenerateResult>\s*{/);
  assert.match(declarations, /export interface QRStructuredAppendDecodedPart<TData extends QRStructuredAppendPartData = QRStructuredAppendPartData>\s*{/);
  assert.match(declarations, /export interface QRStructuredAppendMergeResult<TData extends string \| Uint8Array = string \| Uint8Array>\s*{/);
  assert.match(declarations, /export interface QRStructuredAppendMergeDiagnostics\s*{/);
  assert.match(
    declarations,
    /export function generateStructuredAppend\(input: QRInput, options\?: QRStructuredAppendGenerateOptions & \{ diagnostics: true \}\): QRStructuredAppendResult<QRCodeDiagnosticResult>;/
  );
  assert.match(
    declarations,
    /export function generateSegmentsStructuredAppend\(segments: QRSegmentInput\[], options\?: QRStructuredAppendSegmentsGenerateOptions & \{ diagnostics: true \}\): QRStructuredAppendSegmentsResult<QRCodeDiagnosticResult>;/
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
  assert.match(declarations, /static getSupportedGs1Ais\(\): GS1AiInfo\[];/);
  assert.match(declarations, /static validateGs1ElementString\(input: string, options\?: GS1ValidationOptions\): GS1ElementStringValidationResult;/);
  assert.match(declarations, /static generateStructuredAppend\(input: QRInput/);
  assert.match(declarations, /static generateSegmentsStructuredAppend\(segments: QRSegmentInput\[]/);
  assert.match(declarations, /static mergeStructuredAppendParts\(parts: QRStructuredAppendDecodedPart<string>\[]/);
  assert.match(declarations, /static createGs1DigitalLink\(/);
  assert.match(declarations, /static parseGs1DigitalLink\(/);
  assert.match(declarations, /static validateGs1DigitalLink\(/);
  assert.match(declarations, /static normalizeGs1DigitalLink\(/);
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
    "src/browser.js",
    "docs/api.md",
    "docs/release.md",
    "docs/gs1-supported-ai.md",
    "docs/spec-scope.md",
    "docs/conformance.md",
    "docs/test-plan.md",
    "docs/v2-roadmap.md",
    "examples/gs1-digital-link.mjs",
    "examples/structured-append.mjs",
    "examples/structured-append-merge.mjs",
    "playground/index.html",
    "tools/verify-packed-package.js"
  ];

  for (const requiredPath of required) {
    assert.ok(paths.includes(requiredPath), `packed package should include ${requiredPath}`);
  }

  for (const packedPath of paths) {
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
