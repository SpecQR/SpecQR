import assert from "node:assert/strict";
import test from "node:test";
import { readFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { verifyWorkflowContract } from "../tools/verify-release-workflow.js";
import { assertArtifactProvenance, resolveReleaseArtifact } from "../tools/lib/release-artifact.js";

const root = new URL("../", import.meta.url);
const ci = await readFile(new URL(".github/workflows/ci.yml", root), "utf8");
const published = await readFile(new URL(".github/workflows/published-smoke.yml", root), "utf8");
test("source/frozen workflow contract accepts the checked-in two-lane pipeline", () => {
  verifyWorkflowContract(ci, published);
});
const mutations = [
  ["immutable checkout", "ref: 15ad15e5c770ea0e39072f8f88b2733018f02ffd", "ref: main"],
  ["frozen directory", "working-directory: frozen-rc2", "working-directory: ."],
  ["tarball size", 'SPECQR_EXPECTED_TARBALL_SIZE: "312544"', 'SPECQR_EXPECTED_TARBALL_SIZE: "312545"'],
  ["tarball hash", "c96c324dcd99d72c385d3890156a6ae973ad8db57b840fd5a47f987ddcbb6298", "0".repeat(64)],
  ["file count", 'SPECQR_EXPECTED_FILE_COUNT: "121"', 'SPECQR_EXPECTED_FILE_COUNT: "122"'],
  ["expanded size", 'SPECQR_EXPECTED_UNPACKED_SIZE: "1294971"', 'SPECQR_EXPECTED_UNPACKED_SIZE: "1303485"'],
  ["content hash", "f507de7da842b3bc5fce88eaa6a4d04388ce1d55541c58cbebf36d4b583ae306", "1".repeat(64)],
  ["moving-source commit", "ref: ${{ github.sha }}", "ref: main"],
  ["producer commit binding", "SPECQR_EXPECTED_SOURCE_COMMIT: ${{ github.sha }}", "SPECQR_EXPECTED_SOURCE_COMMIT: main"],
  ["producer canonicalization", "node .github/scripts/prepare-source-test-artifact.js", "npm run release:artifact --"],
  ["frozen canonicalization", "node .github/scripts/canonicalize-release-artifact.js", "echo skip"],
  ["frozen optional check", "  frozen-rc2-reproduction:\n", "  frozen-rc2-reproduction:\n    if: false\n"],
  ["frozen failure masking", "  frozen-rc2-reproduction:\n", "  frozen-rc2-reproduction:\n    continue-on-error: true\n"],
  ["frozen aggregate dependency", "      - frozen-rc2-reproduction\n", ""],
  ["consumer artifact mixing", "name: specqr-source-test-artifact\n          path:", "name: specqr-frozen-rc2-artifact\n          path:"],
  ["consumer artifact directory", "SPECQR_RELEASE_ARTIFACT_DIR: ${{ runner.temp }}/specqr-source-test-artifact", "SPECQR_RELEASE_ARTIFACT_DIR: ${{ runner.temp }}/specqr-frozen-rc2-artifact"],
  ["consumer lane requirement", "\n      SPECQR_ARTIFACT_KIND: unreleased-source-test\n", ""],
  ["consumer commit requirement", "\n      SPECQR_EXPECTED_SOURCE_COMMIT: ${{ github.sha }}\n", ""],
  ["Node 18 requirement", "node-version: [18, 20, 22, 24]", "node-version: [20, 22, 24]"],
  ["types check", "      - run: npm run verify:types\n", ""],
  ["installed package check", "      - run: npm run verify:pack\n", ""],
  ["examples check", "      - run: npm run examples:smoke\n", ""],
  ["browser gate", "      - run: npm run verify:browser:e2e\n", ""],
  ["Java gate", "      - run: npm run verify:structured-append:zxing-java\n", ""],
  ["Java pin", 'java-version: "21.0.11+10.0.LTS"', 'java-version: "17"'],
  ["abbreviated Adoptium version", 'java-version: "21.0.11+10.0.LTS"', 'java-version: "21.0.11+10"'],
  ["Vision gate", "      - run: npm run verify:decode\n", ""],
  ["Mac platform", "runs-on: macos-15-intel", "runs-on: ubuntu-latest"],
  ["repack fallback", "      - run: npm run verify:pack\n", "      - run: npm pack\n      - run: npm run verify:pack\n"],
  ["actual publish", "--dry-run --tag next", "--tag next"],
  ["tag operation", "      - run: npm ls --omit=dev\n", "      - run: npm ls --omit=dev\n      - run: git tag v3.0.0-rc.3\n"]
];
for (const [name, before, after] of mutations) {
  test(`workflow rejects changed ${name}`, () => {
    assert.ok(ci.includes(before));
    assert.throws(() => verifyWorkflowContract(ci.replace(before, after), published));
  });
}
test("workflow rejects published-smoke default drift", () => {
  assert.throws(() => verifyWorkflowContract(ci, published.replaceAll("3.0.0-rc.2", "3.0.0-rc.3")));
});
test("workflow rejects a second source artifact download", () => {
  const step = '      - uses: actions/download-artifact@v5\n        with:\n          name: specqr-source-test-artifact\n          path: ${{ runner.temp }}/specqr-source-test-artifact\n';
  assert.ok(ci.includes(step));
  assert.throws(() => verifyWorkflowContract(ci.replace(step, step + step), published));
});
const commit = "a".repeat(40);
const hash = "b".repeat(64);
const env = { SPECQR_ARTIFACT_KIND: "unreleased-source-test", SPECQR_EXPECTED_SOURCE_COMMIT: commit };
function sourceManifest() {
  return {
    purpose: { kind: "unreleased-source-test", publishable: false },
    provenance: { head: commit, tree: "c".repeat(40), workingTreeDirty: false },
    artifact: { filename: `specqr-source-test-${commit}.tgz`, sha256: hash },
    contents: { sha256: hash },
    reproducibility: { firstContentSha256: hash, tarballSha256Matches: true, secondTarballSha256: hash },
    normalization: { algorithm: "gzip -n -9; OS=255", repeatedCanonicalBytesMatch: true,
      canonicalTarballSha256: hash, originalTarballSha256: hash }
  };
}
test("source artifact provenance accepts exact clean commit, repeat-pack and normalized integrity", () => {
  assertArtifactProvenance(sourceManifest(), env);
});
for (const [name, mutate] of [
  ["frozen artifact", (m) => { delete m.purpose; }],
  ["publishable artifact", (m) => { m.purpose.publishable = true; }],
  ["different commit", (m) => { m.provenance.head = "d".repeat(40); }],
  ["dirty checkout", (m) => { m.provenance.workingTreeDirty = true; }],
  ["historical filename", (m) => { m.artifact.filename = "specqr-3.0.0-rc.2.tgz"; }],
  ["content mismatch", (m) => { m.reproducibility.firstContentSha256 = "e".repeat(64); }],
  ["repack mismatch", (m) => { m.reproducibility.tarballSha256Matches = false; }],
  ["second tarball mismatch", (m) => { m.reproducibility.secondTarballSha256 = "e".repeat(64); }],
  ["missing normalization", (m) => { delete m.normalization; }],
  ["non-repeatable normalization", (m) => { m.normalization.repeatedCanonicalBytesMatch = false; }],
  ["canonical hash mismatch", (m) => { m.normalization.canonicalTarballSha256 = "e".repeat(64); }]
]) test(`source artifact rejects ${name}`, () => {
  const manifest = sourceManifest(); mutate(manifest);
  assert.throws(() => assertArtifactProvenance(manifest, env));
});
test("source artifact needs an explicit exact commit even outside CI", () => {
  assert.throws(() => assertArtifactProvenance(sourceManifest(), {}));
  assert.throws(() => assertArtifactProvenance(sourceManifest(), { ...env, SPECQR_EXPECTED_SOURCE_COMMIT: "main" }));
});
test("required source artifact never falls back to repacking", async () => {
  await assert.rejects(resolveReleaseArtifact({ argv: [], env }), /repack fallback is forbidden/u);
  await assert.rejects(resolveReleaseArtifact({ argv: ["--tarball", "missing.tgz"], env }), /repack fallback is forbidden/u);
  const directory = await mkdtemp(path.join(tmpdir(), "specqr-missing-artifact-"));
  try {
    await assert.rejects(resolveReleaseArtifact({ argv: ["--artifact-dir", directory], env }), /ENOENT/u);
    await writeFile(path.join(directory, "specqr-release-artifact.json"), JSON.stringify(sourceManifest()));
    await assert.rejects(resolveReleaseArtifact({ argv: ["--artifact-dir", directory], env }), /ENOENT/u);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
