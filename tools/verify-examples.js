import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";

const directory = await mkdtemp(join(tmpdir(), "specqr-examples-"));

try {
  const pngPath = join(directory, "node.png");
  await run("node", ["examples/node-save-png.mjs", pngPath]);
  const png = await readFile(pngPath);
  assert.deepEqual(Array.from(png.subarray(0, 8)), [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  const svgPath = join(directory, "gs1.svg");
  await run("node", ["examples/gs1-qr.mjs", svgPath]);
  const svg = await readFile(svgPath, "utf8");
  assert.match(svg, /^<svg /);

  const digitalLinkSvgPath = join(directory, "gs1-digital-link.svg");
  await run("node", ["examples/gs1-digital-link.mjs", digitalLinkSvgPath]);
  const digitalLinkSvg = await readFile(digitalLinkSvgPath, "utf8");
  assert.match(digitalLinkSvg, /^<svg /);

  const structuredAppendDir = join(directory, "structured-append");
  await run("node", ["examples/structured-append.mjs", structuredAppendDir]);
  const structuredSummary = JSON.parse(await readFile(join(structuredAppendDir, "summary.json"), "utf8"));
  assert.equal(structuredSummary.string.total, 2);
  assert.equal(structuredSummary.string.parity, 65);
  assert.deepEqual(structuredSummary.string.symbols.map((symbol) => symbol.index), [1, 2]);
  assert.equal(structuredSummary.binary.total, 3);
  assert.ok(structuredSummary.binary.symbols.every((symbol) => symbol.parity === structuredSummary.binary.parity));
  const structuredSvg = await readFile(join(structuredAppendDir, "string-1.svg"), "utf8");
  assert.match(structuredSvg, /^<svg /);
  const structuredPng = await readFile(join(structuredAppendDir, "binary-1.png"));
  assert.deepEqual(Array.from(structuredPng.subarray(0, 8)), [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  const structuredMergePath = join(directory, "structured-append-merge.json");
  await run("node", ["examples/structured-append-merge.mjs", structuredMergePath]);
  const structuredMerge = JSON.parse(await readFile(structuredMergePath, "utf8"));
  assert.equal(structuredMerge.string.data, "A".repeat(31));
  assert.deepEqual(structuredMerge.string.inputOrder, [2, 1]);
  assert.deepEqual(structuredMerge.string.mergedOrder, [1, 2]);
  assert.equal(structuredMerge.binary.dataType, "binary");
  assert.deepEqual(structuredMerge.binary.inputOrder, [3, 1, 2]);
  assert.deepEqual(structuredMerge.binary.mergedOrder, [1, 2, 3]);
  assert.equal(structuredMerge.adapter.metadataRequired, true);
  assert.equal(structuredMerge.negative.missing.code, "INVALID_INPUT");
  assert.equal(structuredMerge.negative.duplicate.code, "INVALID_INPUT");
  assert.equal(structuredMerge.negative.parityMismatch.code, "INVALID_INPUT");
  assert.equal(structuredMerge.negative.metadataMissing.code, "INVALID_INPUT");

  await assertReadable("examples/typescript-usage.ts");
  await assertReadable("examples/browser-blob-object-url.html");
  await assertReadable("playground/index.html");
  await assertReadable("playground/playground.js");

  console.log("Example smoke checks passed.");
} finally {
  await rm(directory, { recursive: true, force: true });
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
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

async function assertReadable(path) {
  const contents = await readFile(path, "utf8");
  assert.ok(contents.length > 0, `${path} should not be empty`);
}
