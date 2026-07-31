import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { assertReleasePackageMetadata } from "./lib/release-artifact.js";

const { expectedVersion, packageSpecs } = parseArguments(process.argv.slice(2));
const envSpecs = (process.env.SPECQR_PUBLISHED_SPECS ?? "").trim().split(/\s+/).filter(Boolean);
const specs = packageSpecs.length > 0
  ? packageSpecs
  : envSpecs.length > 0
    ? envSpecs
    : ["specqr@3.0.0-rc.1", "specqr@next"];
const requiredVersion =
  expectedVersion
  ?? process.env.SPECQR_EXPECTED_VERSION?.trim()
  ?? (packageSpecs.length === 0 && envSpecs.length === 0
    ? "3.0.0-rc.1"
    : null);
const cacheDir = process.env.SPECQR_NPM_CACHE ?? path.join(tmpdir(), "specqr-published-npm-cache");

const results = [];

for (const spec of specs) {
  const directory = await mkdtemp(path.join(tmpdir(), "specqr-published-"));
  try {
    await writeFile(path.join(directory, "package.json"), JSON.stringify({ type: "module" }, null, 2));
    await run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--cache", cacheDir, spec], directory);

    const installedPackage = JSON.parse(
      await readFile(path.join(directory, "node_modules", "specqr", "package.json"), "utf8")
    );
    assertReleasePackageMetadata(installedPackage, requiredVersion ?? undefined);
    await writeSmokeTest(directory);
    await run("node", ["smoke.mjs"], directory);
    await verifyInstalledTypeSurface(directory);

    results.push({
      spec,
      version: installedPackage.version
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

for (const result of results) {
  const sourceLabel = isLocalPackageSpec(result.spec)
    ? "local artifact equivalent"
    : "published";
  console.log(`ok ${sourceLabel} ${result.spec} -> ${result.version}`);
  if (requiredVersion) {
    assert.equal(
      result.version,
      requiredVersion,
      `${result.spec} did not resolve to the required release version`
    );
  }
}

if (requiredVersion && results.length >= 2) {
  assert.equal(
    new Set(results.map((result) => result.version)).size,
    1,
    "Exact version and dist-tag specs must resolve to the same version"
  );
  console.log(`ok published exact version and tags resolved to ${requiredVersion}`);
} else if (results.length >= 2) {
  const versions = new Set(results.map((result) => result.version));
  if (versions.size === 1) {
    console.log(`ok published all specs resolved to ${results[0].version}`);
  } else {
    console.log(`note published specs resolved to multiple versions: ${Array.from(versions).join(", ")}`);
  }
}

async function writeSmokeTest(directory) {
  await writeFile(path.join(directory, "smoke.mjs"), `import assert from "node:assert/strict";
import * as specqr from "specqr";
import { toBlob } from "specqr/browser";
import { toPngBuffer } from "specqr/node";

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
assert.deepEqual(Object.keys(await import("specqr/node")).sort(), NODE_EXPORTS);
assert.deepEqual(Object.keys(await import("specqr/browser")).sort(), BROWSER_EXPORTS);

const svg = specqr.QRCode.generate("https://github.com/SpecQR/SpecQR", { output: "svg" });
assert.match(svg, /^<svg /);

const png = toPngBuffer("published smoke");
assert.equal(Buffer.isBuffer(png), true);
assert.deepEqual(Array.from(png.subarray(0, 8)), [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

const blob = toBlob("published smoke");
assert.equal(blob.type, "image/png");

assert.equal(typeof specqr.parseGs1ElementString, "function");
assert.equal(typeof specqr.QRCode.parseGs1ElementString, "function");
assert.equal(typeof specqr.createGs1DigitalLink, "function");
assert.equal(typeof specqr.parseGs1DigitalLink, "function");
assert.equal(typeof specqr.generateStructuredAppend, "function");
assert.equal(typeof specqr.QRCode.generateStructuredAppend, "function");
assert.equal(typeof specqr.mergeStructuredAppendParts, "function");
assert.equal(typeof specqr.getSupportedGs1Ais, "function");
assert.equal(typeof specqr.QRCode.getSupportedGs1Ais, "function");
assert.equal(typeof specqr.getGs1AiInfo, "function");
assert.equal(typeof specqr.QRCode.getGs1AiInfo, "function");
assert.equal(typeof specqr.validateGs1Elements, "function");
assert.equal(typeof specqr.QRCode.validateGs1Elements, "function");
assert.equal(typeof specqr.validateGs1ElementString, "function");
assert.equal(typeof specqr.QRCode.validateGs1ElementString, "function");
if (typeof specqr.validateGs1DigitalLink === "function") {
  assert.equal(typeof specqr.QRCode.validateGs1DigitalLink, "function");
  const digitalLinkValidation = specqr.validateGs1DigitalLink("https://example.com/01/04912345678904/10/ABC123");
  assert.equal(digitalLinkValidation.ok, true);
  assert.deepEqual(digitalLinkValidation.result.elements, [
    { ai: "01", value: "04912345678904" },
    { ai: "10", value: "ABC123" }
  ]);
  if (typeof specqr.normalizeGs1DigitalLink === "function") {
    assert.equal(typeof specqr.QRCode.normalizeGs1DigitalLink, "function");
    assert.equal(
      specqr.normalizeGs1DigitalLink("https://example.com/01/04912345678904?17=251231&10=ABC123"),
      "https://example.com/01/04912345678904/10/ABC123?17=251231"
    );
  } else {
    assert.equal(specqr.QRCode.normalizeGs1DigitalLink, undefined);
  }
} else {
  assert.equal(specqr.QRCode.validateGs1DigitalLink, undefined);
}

if (typeof specqr.appendGtinCheckDigit === "function") {
  const gtin = specqr.appendGtinCheckDigit("0491234567890");
  assert.equal(gtin, "04912345678904");
}

if (
  typeof specqr.createGs1ElementString === "function" &&
  typeof specqr.parseGs1HumanReadable === "function"
) {
  const gs1 = specqr.createGs1ElementString(specqr.parseGs1HumanReadable("(01)04912345678904(17)251231"));
  assert.equal(gs1, "010491234567890417251231");
}

const rawGs1 = "010491234567890410ABC123\\x1D17251231";
const parsedGs1 = specqr.parseGs1ElementString(rawGs1);
assert.deepEqual(parsedGs1, {
  elements: [
    { ai: "01", value: "04912345678904" },
    { ai: "10", value: "ABC123" },
    { ai: "17", value: "251231" }
  ],
  hasSeparators: true
});

const supportedAis = specqr.getSupportedGs1Ais();
assert.equal(Array.isArray(supportedAis), true);
assert.equal(supportedAis.some((entry) => entry.ai === "01"), true);
assert.deepEqual(specqr.getGs1AiInfo("01").length, { type: "fixed", exact: 14 });
assert.equal(specqr.getGs1AiInfo("999"), null);

const validation = specqr.validateGs1ElementString(rawGs1);
assert.equal(validation.ok, true);
assert.deepEqual(validation.elements, parsedGs1.elements);
assert.equal(validation.hasSeparators, true);
assert.equal(specqr.QRCode.validateGs1ElementString("010491234567890410ABC12317251231").ok, false);
assert.equal(
  specqr.validateGs1Elements([{ ai: "01", value: "04912345678904" }]).ok,
  true
);
assert.equal(
  specqr.QRCode.validateGs1Elements([{ ai: "01", value: "04912345678900" }]).ok,
  false
);

const digitalLink = specqr.createGs1DigitalLink(parsedGs1, { baseUrl: "https://example.com" });
assert.equal(digitalLink, "https://example.com/01/04912345678904/10/ABC123?17=251231");
assert.deepEqual(specqr.QRCode.parseGs1DigitalLink(digitalLink).elements, parsedGs1.elements);

const fnc1Second = specqr.QRCode.generate("AA1234BBB112", {
  fnc1Second: "37",
  mode: "alphanumeric",
  version: 1,
  errorCorrectionLevel: "Q",
  output: "matrix",
  diagnostics: true
});
assert.equal(fnc1Second.diagnostics.fnc1, "second-position");
assert.equal(fnc1Second.diagnostics.fnc1Second.applicationIndicatorCodeword, 37);

const structuredAppendInput = "A".repeat(31);
const structuredAppend = specqr.generateStructuredAppend(structuredAppendInput, {
  version: 1,
  errorCorrectionLevel: "L",
  mode: "alphanumeric",
  output: "matrix",
  diagnostics: true
});
assert.equal(structuredAppend.total, 2);
assert.equal(structuredAppend.parity, 65);
const parts = structuredAppend.diagnostics.symbols.map((symbol) => ({
  index: symbol.index,
  total: symbol.total,
  parity: symbol.parity,
  data: structuredAppendInput.slice(symbol.inputStart, symbol.inputStart + symbol.inputLength)
}));
assert.equal(specqr.mergeStructuredAppendParts([parts[1], parts[0]]).data, structuredAppendInput);

const manualSegments = [
  { mode: "byte", data: Uint8Array.from({ length: 31 }, (_, index) => index) }
];
const standardManualSet = specqr.generateSegmentsStructuredAppend(manualSegments, {
  version: 1,
  errorCorrectionLevel: "L",
  output: "matrix",
  diagnostics: true
});
assert.equal(standardManualSet.diagnostics.splitUnitsDetail, "summary");
assert.equal(standardManualSet.diagnostics.splitUnitCount, 31);
assert.equal(Object.hasOwn(standardManualSet.diagnostics, "splitUnits"), false);
assert.equal(JSON.stringify(standardManualSet.diagnostics).includes('"splitUnits":'), false);

const fullManualSet = specqr.QRCode.generateSegmentsStructuredAppend(manualSegments, {
  version: 1,
  errorCorrectionLevel: "L",
  output: "png",
  diagnostics: {
    splitUnits: "full",
    symbolResults: "output"
  }
});
assert.equal(fullManualSet.diagnostics.splitUnitsDetail, "full");
assert.equal(fullManualSet.diagnostics.splitUnitCount, 31);
assert.equal(fullManualSet.diagnostics.splitUnits.length, 31);
assert.equal(fullManualSet.symbols[0] instanceof Uint8Array, true);
assert.deepEqual(
  structuredClone(fullManualSet.diagnostics).splitUnits,
  fullManualSet.diagnostics.splitUnits
);
`);
}

async function verifyInstalledTypeSurface(directory) {
  const fixtureDirectory = path.join(directory, "types");
  await mkdir(fixtureDirectory);
  for (const fixture of ["root-node-nodom.ts", "browser-dom.ts"]) {
    const source = await readFile(
      path.join(process.cwd(), "tests", "types", fixture),
      "utf8"
    );
    await writeFile(path.join(fixtureDirectory, fixture), source);
  }
  const nodeTypeRoot = path.join(process.cwd(), "node_modules", "@types");
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
  const tsc = path.join(
    process.cwd(),
    "node_modules",
    "typescript",
    "bin",
    "tsc"
  );
  await run(process.execPath, [tsc, "-p", "tsconfig.root-node.json"], fixtureDirectory);
  await run(process.execPath, [tsc, "-p", "tsconfig.browser.json"], fixtureDirectory);
}

function parseArguments(argv) {
  const packageSpecs = [];
  let expectedVersion = null;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--expected-version") {
      expectedVersion = argv[index + 1];
      if (!expectedVersion) {
        throw new Error("--expected-version requires a value");
      }
      index += 1;
    } else {
      packageSpecs.push(argv[index]);
    }
  }
  return { expectedVersion, packageSpecs };
}

function isLocalPackageSpec(spec) {
  return spec.endsWith(".tgz")
    || spec.startsWith("file:")
    || path.isAbsolute(spec)
    || spec.startsWith("./")
    || spec.startsWith("../");
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
