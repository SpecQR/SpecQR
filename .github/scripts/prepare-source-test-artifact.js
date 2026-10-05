import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  inspectTarball,
  sha256,
  verifyReleaseArtifact
} from "../../tools/lib/release-artifact.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const output = process.argv[2];
assert.ok(output && process.argv.length === 3,
  "Usage: prepare-source-test-artifact.js <empty-external-directory>");
const commit = process.env.SPECQR_EXPECTED_SOURCE_COMMIT?.trim();
assert.match(commit ?? "", /^[a-f0-9]{40}$/u, "An exact source commit is required");
function git(...args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}
function assertCheckout() {
  assert.equal(git("rev-parse", "HEAD"), commit, "Source commit mismatch");
  assert.equal(git("status", "--porcelain", "--untracked-files=all"), "",
    "Source-test artifacts require a clean committed checkout");
}
assertCheckout();
const tree = git("rev-parse", "HEAD^{tree}");
execFileSync(process.execPath, [
  "tools/prepare-release-artifact.js", "--expected-version", "3.0.0-rc.2",
  "--output-dir", path.resolve(output)
], { cwd: root, stdio: "inherit" });
assertCheckout();
const manifestPath = path.join(path.resolve(output), "specqr-release-artifact.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const originalPath = path.join(path.dirname(manifestPath), manifest.artifact.filename);
await verifyReleaseArtifact({ tarballPath: originalPath, manifestPath,
  expectedVersion: "3.0.0-rc.2", env: {} });
assert.equal(manifest.provenance.head, commit);
assert.equal(manifest.provenance.workingTreeDirty, false);
assert.equal(manifest.reproducibility.tarballSha256Matches, true);
assert.equal(manifest.reproducibility.secondTarballSha256, manifest.artifact.sha256);
const original = await readFile(originalPath);
const tar = execFileSync("gzip", ["-cd"], { input: original, maxBuffer: 64 * 1024 * 1024 });
function canonicalize() {
  const result = execFileSync("gzip", ["-n", "-9", "-c"], {
    input: tar, maxBuffer: 64 * 1024 * 1024
  });
  assert.deepEqual([...result.subarray(0, 9)],
    [0x1f, 0x8b, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02]);
  result[9] = 0xff;
  return result;
}
const canonical = canonicalize();
assert.deepEqual(canonical, canonicalize(), "Canonical gzip must be repeatable");
const filename = `specqr-source-test-${commit}.tgz`;
const tarballPath = path.join(path.dirname(manifestPath), filename);
await writeFile(`${tarballPath}.tmp`, canonical);
await rename(`${tarballPath}.tmp`, originalPath);
await rename(originalPath, tarballPath);
const inspection = await inspectTarball(tarballPath);
assert.deepEqual(inspection.contents, manifest.contents, "Normalization changed package contents");
manifest.artifact = inspection.tarball;
manifest.purpose = { kind: "unreleased-source-test", publishable: false };
manifest.provenance.tree = tree;
manifest.reproducibility.secondTarballSha256 = inspection.tarball.sha256;
manifest.normalization = {
  algorithm: "gzip -n -9; OS=255",
  originalTarballSha256: sha256(original),
  canonicalTarballSha256: inspection.tarball.sha256,
  repeatedCanonicalBytesMatch: true
};
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
assertCheckout();
await verifyReleaseArtifact({ tarballPath, manifestPath, expectedVersion: "3.0.0-rc.2",
  env: { SPECQR_ARTIFACT_KIND: "unreleased-source-test", SPECQR_EXPECTED_SOURCE_COMMIT: commit } });
console.log(`ok unreleased source-test artifact; NOT FOR PUBLICATION; commit=${commit} tree=${tree}`);
console.log(`canonical sha256=${inspection.tarball.sha256}`);
