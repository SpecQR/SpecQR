import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const packageSpecs = process.argv.slice(2);
const envSpecs = (process.env.SPECQR_PUBLISHED_SPECS ?? "").trim().split(/\s+/).filter(Boolean);
const specs = packageSpecs.length > 0 ? packageSpecs : envSpecs.length > 0 ? envSpecs : ["specqr", "specqr@next"];
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
    await writeSmokeTest(directory);
    await run("node", ["smoke.mjs"], directory);

    results.push({
      spec,
      version: installedPackage.version
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

for (const result of results) {
  console.log(`ok published ${result.spec} -> ${result.version}`);
}

if (results.length >= 2) {
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

const svg = specqr.QRCode.generate("https://github.com/SpecQR/SpecQR", { output: "svg" });
assert.match(svg, /^<svg /);

const png = toPngBuffer("published smoke");
assert.equal(Buffer.isBuffer(png), true);
assert.deepEqual(Array.from(png.subarray(0, 8)), [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

const blob = toBlob("published smoke");
assert.equal(blob.type, "image/png");

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
`);
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
