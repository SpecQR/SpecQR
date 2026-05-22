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
