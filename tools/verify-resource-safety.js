import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";

import {
  DataTooLongError,
  InvalidInputError,
  calculateStructuredAppendSegmentsParity,
  estimate,
  generate
} from "../src/index.js";

const childMode = process.argv[2];

if (childMode === "--child-oversized-input") {
  const started = performance.now();
  assert.throws(
    () => generate("a".repeat(20_000), { output: "matrix" }),
    DataTooLongError
  );
  const planning = estimate("a".repeat(20_000), { output: "matrix" });
  assert.equal(planning.ok, false);
  assert.equal(planning.reason, "data-too-long");
  assert.ok(!planning.warnings.some(({ code }) => code === "CAPACITY_NEAR_LIMIT"));
  console.log(JSON.stringify({
    case: "oversized-input",
    characters: 20_000,
    planningResult: planning.reason,
    elapsedMilliseconds: Math.round(performance.now() - started),
    rssBytes: process.memoryUsage().rss
  }));
} else if (childMode === "--child-large-parity") {
  const bytes = new Uint8Array(150_000);
  let expected = 0;
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = index % 251;
    expected ^= bytes[index];
  }
  const started = performance.now();
  const parity = calculateStructuredAppendSegmentsParity([
    { mode: "byte", data: bytes }
  ]);
  assert.equal(parity, expected);
  console.log(JSON.stringify({
    case: "large-parity",
    bytes: bytes.length,
    parity,
    elapsedMilliseconds: Math.round(performance.now() - started),
    rssBytes: process.memoryUsage().rss
  }));
} else {
  assert.throws(
    () => generate("A", { output: "png", scale: Number.MAX_VALUE }),
    (error) => error instanceof InvalidInputError &&
      error.code === "INVALID_INPUT" &&
      error.message.startsWith("Render geometry for png ")
  );

  const oversized = runLowHeapChild("--child-oversized-input");
  const parity = runLowHeapChild("--child-large-parity");
  console.log("ok resource-safety");
  console.log(JSON.stringify({
    heapLimitMegabytes: 32,
    rendererPreflight: "ok",
    children: [oversized, parity]
  }, null, 2));
}

function runLowHeapChild(mode) {
  const result = spawnSync(process.execPath, [
    "--max-old-space-size=32",
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
    throw new Error(`resource-safety child ${mode} failed with exit status ${result.status}`);
  }
  return JSON.parse(result.stdout.trim());
}
