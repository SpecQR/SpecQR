import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const artifactDirectory = process.argv[2];
assert.ok(artifactDirectory, "Usage: canonicalize-release-artifact.js <artifact-directory>");

const manifestPath = path.join(
  path.resolve(artifactDirectory),
  "specqr-release-artifact.json"
);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const tarballPath = path.join(
  path.dirname(manifestPath),
  manifest.artifact.filename
);
const original = await readFile(tarballPath);
const originalSha256 = sha256(original);

assert.equal(manifest.artifact.size, original.length);
assert.equal(manifest.artifact.sha256, originalSha256);
assert.equal(manifest.reproducibility.tarballSha256Matches, true);
assert.equal(
  manifest.reproducibility.secondTarballSha256,
  originalSha256,
  "The two npm pack results must match before gzip normalization"
);

assertExpectedManifest(manifest);

const tar = execFileSync("gzip", ["-cd"], {
  input: original,
  maxBuffer: 64 * 1024 * 1024
});
const canonical = execFileSync("gzip", ["-n", "-9", "-c"], {
  input: tar,
  maxBuffer: 64 * 1024 * 1024
});

assert.deepEqual(
  [...canonical.subarray(0, 9)],
  [0x1f, 0x8b, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02],
  "gzip -n -9 must emit the expected deterministic header"
);
canonical[9] = 0xff;

const canonicalSha256 = sha256(canonical);
assert.equal(
  canonical.length,
  Number.parseInt(requiredEnvironment("SPECQR_EXPECTED_TARBALL_SIZE"), 10)
);
assert.equal(
  canonicalSha256,
  requiredEnvironment("SPECQR_EXPECTED_TARBALL_SHA256")
);

const temporaryPath = `${tarballPath}.canonical-${process.pid}`;
await writeFile(temporaryPath, canonical);
await rename(temporaryPath, tarballPath);

manifest.artifact.size = canonical.length;
manifest.artifact.sha256 = canonicalSha256;
manifest.reproducibility.secondTarballSha256 = canonicalSha256;
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(
  `ok canonical gzip ${path.basename(tarballPath)} `
    + `${canonical.length} bytes sha256=${canonicalSha256}`
);

function assertExpectedManifest(value) {
  assert.equal(
    value.contents.fileCount,
    Number.parseInt(requiredEnvironment("SPECQR_EXPECTED_FILE_COUNT"), 10)
  );
  assert.equal(
    value.contents.unpackedSize,
    Number.parseInt(requiredEnvironment("SPECQR_EXPECTED_UNPACKED_SIZE"), 10)
  );
  assert.equal(
    value.contents.sha256,
    requiredEnvironment("SPECQR_EXPECTED_CONTENT_SHA256")
  );
}

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  assert.ok(value, `Missing required environment variable: ${name}`);
  return value;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
