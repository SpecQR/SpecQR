import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { toBlob, toBlobFromSegments } from "../src/browser.js";
import { toPngBuffer, toPngBufferFromSegments, writePngFile } from "../src/node.js";

const PNG_SIGNATURE = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

test("Node helpers return PNG buffers", () => {
  const buffer = toPngBuffer("HELLO");
  const segmented = toPngBufferFromSegments([{ mode: "alphanumeric", data: "HELLO" }]);

  assert.ok(Buffer.isBuffer(buffer));
  assert.deepEqual(Array.from(buffer.subarray(0, 8)), PNG_SIGNATURE);
  assert.ok(Buffer.isBuffer(segmented));
  assert.deepEqual(Array.from(segmented.subarray(0, 8)), PNG_SIGNATURE);
});

test("Node helper writes PNG files", async () => {
  const directory = await mkdtemp(join(tmpdir(), "specqr-helper-"));
  const path = join(directory, "helper-output.png");

  try {
    await writePngFile(path, "HELLO");

    const bytes = await readFile(path);
    assert.deepEqual(Array.from(bytes.subarray(0, 8)), PNG_SIGNATURE);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("Browser helpers return PNG blobs when Blob is available", async () => {
  const blob = toBlob("HELLO");
  const segmented = toBlobFromSegments([{ mode: "alphanumeric", data: "HELLO" }]);

  assert.equal(blob.type, "image/png");
  assert.equal(segmented.type, "image/png");
  assert.deepEqual(Array.from(new Uint8Array(await blob.arrayBuffer()).slice(0, 8)), PNG_SIGNATURE);
});
