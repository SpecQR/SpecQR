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
assert.equal(typeof specqr.createGs1DigitalLink, "function");
assert.equal(typeof specqr.QRCode.createGs1DigitalLink, "function");
assert.equal(typeof specqr.parseGs1DigitalLink, "function");
assert.equal(typeof specqr.QRCode.parseGs1DigitalLink, "function");
assert.equal(specqr.validateGs1DigitalLink, undefined);
assert.equal(specqr.QRCode.validateGs1DigitalLink, undefined);
assert.equal(specqr.validateGs1ElementString, undefined);
assert.equal(specqr.QRCode.validateGs1ElementString, undefined);

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
  assert.match(declarations, /fnc1Second\?: false \| string;/);
  assert.match(declarations, /\| { mode: "fnc1-second"; applicationIndicator: string }/);
  assert.match(declarations, /export interface QRFnc1SecondDiagnostics\s*{/);
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
    /static parseGs1ElementString\(input: string\): GS1ElementStringParseResult;/
  );
  assert.match(declarations, /static createGs1DigitalLink\(/);
  assert.match(declarations, /static parseGs1DigitalLink\(/);
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
