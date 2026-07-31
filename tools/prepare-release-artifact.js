import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtemp,
  readFile,
  rm,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  RELEASE_ARTIFACT_MANIFEST,
  assertContentManifestsEqual,
  assertEmptyExternalOutputDirectory,
  assertNpmPackMetadata,
  assertPackageContentPolicy,
  assertReleasePackageMetadata,
  inspectTarball,
  readPackageJsonFromTarball,
  readReleaseArtifactArguments,
  runNpmPack
} from "./lib/release-artifact.js";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const args = readReleaseArtifactArguments();
const sourcePackage = JSON.parse(
  await readFile(path.join(repositoryRoot, "package.json"), "utf8")
);
const expectedVersion = args.expectedVersion ?? sourcePackage.version;
assert.equal(
  sourcePackage.version,
  expectedVersion,
  "package.json version does not match --expected-version"
);

const temporaryRoot = await mkdtemp(
  path.join(tmpdir(), "specqr-release-pack-")
);
const outputDirectory = path.resolve(
  args.outputDirectory
    ?? process.env.SPECQR_RELEASE_ARTIFACT_DIR?.trim()
    ?? path.join(temporaryRoot, "artifact")
);
const secondPackDirectory = path.join(temporaryRoot, "second-pack");
const configuredCacheDirectory =
  process.env.SPECQR_NPM_CACHE?.trim() || null;
const cacheDirectory =
  configuredCacheDirectory || path.join(temporaryRoot, "npm-cache");

await assertEmptyExternalOutputDirectory(
  repositoryRoot,
  outputDirectory
);

try {
  const first = await runNpmPack({
    repositoryRoot,
    destination: outputDirectory,
    cacheDirectory
  });
  const second = await runNpmPack({
    repositoryRoot,
    destination: secondPackDirectory,
    cacheDirectory
  });

  const firstInspection = await inspectTarball(first.tarballPath);
  const secondInspection = await inspectTarball(second.tarballPath);
  assertNpmPackMetadata(first.result, firstInspection);
  assertNpmPackMetadata(second.result, secondInspection);
  assertContentManifestsEqual(firstInspection, secondInspection);

  const packageJson = await readPackageJsonFromTarball(first.tarballPath);
  const packageMetadata = assertReleasePackageMetadata(
    packageJson,
    expectedVersion
  );
  const policy = assertPackageContentPolicy(
    firstInspection.contents.files
  );
  const git = readGitState(repositoryRoot);
  const manifest = {
    schemaVersion: 1,
    package: packageMetadata,
    artifact: firstInspection.tarball,
    contents: firstInspection.contents,
    reproducibility: {
      expandedContentMatches: true,
      firstContentSha256: firstInspection.contents.sha256,
      secondContentSha256: secondInspection.contents.sha256,
      tarballSha256Matches:
        firstInspection.tarball.sha256 === secondInspection.tarball.sha256,
      secondTarballSha256: secondInspection.tarball.sha256
    },
    policy,
    provenance: {
      branch: git.branch,
      head: git.head,
      originMain: git.originMain,
      ahead: git.ahead,
      behind: git.behind,
      workingTreeDirty: git.workingTreeDirty,
      node: process.version,
      npm: npmVersion(),
      platform: `${process.platform}-${process.arch}`
    }
  };
  const manifestPath = path.join(
    outputDirectory,
    RELEASE_ARTIFACT_MANIFEST
  );
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`ok release artifact ${packageMetadata.name}@${packageMetadata.version}`);
  console.log(`tarball ${first.tarballPath}`);
  console.log(`sha256 ${firstInspection.tarball.sha256}`);
  console.log(
    `contents ${firstInspection.contents.fileCount} files, `
      + `${firstInspection.contents.unpackedSize} bytes, `
      + `${firstInspection.contents.sha256}`
  );
  console.log(
    `repack expanded content match; tarball SHA match=`
      + `${manifest.reproducibility.tarballSha256Matches}`
  );
  console.log(`manifest ${manifestPath}`);
} finally {
  await rm(secondPackDirectory, { recursive: true, force: true });
  if (!configuredCacheDirectory) {
    await rm(cacheDirectory, { recursive: true, force: true });
  }
  if (args.outputDirectory || process.env.SPECQR_RELEASE_ARTIFACT_DIR?.trim()) {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

function readGitState(cwd) {
  const branch = runGit(cwd, ["branch", "--show-current"]).trim();
  const head = runGit(cwd, ["rev-parse", "HEAD"]).trim();
  const originMain = runGit(cwd, ["rev-parse", "origin/main"]).trim();
  const [behind, ahead] = runGit(
    cwd,
    ["rev-list", "--left-right", "--count", "origin/main...HEAD"]
  ).trim().split(/\s+/).map(Number);
  const status = runGit(cwd, ["status", "--porcelain"]);
  return {
    branch,
    head,
    originMain,
    ahead,
    behind,
    workingTreeDirty: status.length > 0
  };
}

function runGit(cwd, args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  }
  return result.stdout;
}

function npmVersion() {
  const command = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(command, ["--version"], { encoding: "utf8" });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`npm --version failed: ${result.stderr}`);
  }
  return result.stdout.trim();
}
