import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SOURCE_ARTIFACT = "specqr-source-test-artifact";
const FROZEN_ARTIFACT = "specqr-frozen-rc2-artifact";
const FROZEN_COMMIT = "15ad15e5c770ea0e39072f8f88b2733018f02ffd";
const consumers = ["engine-matrix", "artifact-verification", "browser-e2e",
  "structured-append-zxing-java", "release-gates"];
const frozenPins = {
  SPECQR_EXPECTED_TARBALL_SIZE: '"312544"',
  SPECQR_EXPECTED_TARBALL_SHA256: "c96c324dcd99d72c385d3890156a6ae973ad8db57b840fd5a47f987ddcbb6298",
  SPECQR_EXPECTED_FILE_COUNT: '"121"',
  SPECQR_EXPECTED_UNPACKED_SIZE: '"1294971"',
  SPECQR_EXPECTED_CONTENT_SHA256: "f507de7da842b3bc5fce88eaa6a4d04388ce1d55541c58cbebf36d4b583ae306"
};

export function verifyWorkflowContract(ci, published) {
  assert.equal(ci.includes("\t") || published.includes("\t"), false, "No YAML tabs");
  assert.match(ci, /on:\n  push:\n    branches:\n      - main\n  pull_request:/u);
  assert.equal(/continue-on-error:|\|\|\s*true|\bexit\s+0\b|workflow_dispatch:|schedule:/u.test(ci), false,
    "Required checks must not be optional or masked");
  const jobs = extractJobs(ci);
  assert.deepEqual([...jobs.keys()].sort(),
    ["package-artifact", "frozen-rc2-reproduction", ...consumers].sort());
  for (const block of jobs.values()) {
    // Only failed-upload steps may be conditional; no job or verification step may skip.
    for (const line of block.split("\n").filter((value) => /\bif:/u.test(value))) {
      assert.equal(line, "        if: failure()", "Only failure-evidence uploads may be conditional");
    }
    for (const step of extractSteps(block)) {
      if (step.includes("if: failure()")) assert.match(step, /uses: actions\/upload-artifact@v4/u);
      assert.equal(/\bnpm (?:publish|dist-tag)\b/u.test(step) && !step.includes("--dry-run --tag next"), false,
        "Actual npm publication is forbidden");
      assert.equal(/\bgit (?:push|tag)\b|\bgh release\b|deploy-pages|npm exec|npx /u.test(step), false,
        "Publication and deployment are outside source CI");
    }
  }
  const producer = jobs.get("package-artifact");
  assert.match(producer, /runs-on: macos-15-intel/u);
  assert.match(producer, /node-version: 22/u);
  assertCheckout(producer, "${{ github.sha }}");
  assert.match(producer, /fetch-depth: 0/u);
  assert.match(producer, /node \.github\/scripts\/prepare-source-test-artifact\.js/u);
  assert.match(producer, /SPECQR_EXPECTED_SOURCE_COMMIT: \$\{\{ github\.sha \}\}/u);
  assert.match(producer, /SPECQR_ARTIFACT_KIND: unreleased-source-test/u);
  assert.match(producer, /npm run verify:release:artifact/u);
  const prepareStep = extractSteps(producer).find((step) => step.includes("node .github/scripts/prepare-source-test-artifact.js"));
  assert.ok(prepareStep.includes("SPECQR_EXPECTED_SOURCE_COMMIT: ${{ github.sha }}"));
  assert.ok(prepareStep.includes('"${{ runner.temp }}/specqr-source-test-artifact"'));
  const verifyStep = extractSteps(producer).find((step) => step.includes("npm run verify:release:artifact"));
  assert.ok(verifyStep.includes("SPECQR_ARTIFACT_KIND: unreleased-source-test"));
  assert.ok(verifyStep.includes("SPECQR_EXPECTED_SOURCE_COMMIT: ${{ github.sha }}"));
  assert.ok(verifyStep.includes("SPECQR_RELEASE_ARTIFACT_DIR: ${{ runner.temp }}/specqr-source-test-artifact"));
  assertArtifactUpload(producer, SOURCE_ARTIFACT);
  assert.equal(producer.includes(FROZEN_ARTIFACT) || producer.includes("npm publish"), false);
  for (const pin of Object.keys(frozenPins)) assert.equal(producer.includes(pin), false);

  const frozen = jobs.get("frozen-rc2-reproduction");
  assert.match(frozen, /runs-on: macos-15-intel/u);
  assert.match(frozen, /node-version: 22/u);
  assertCheckout(frozen, FROZEN_COMMIT);
  assert.match(frozen, /path: frozen-rc2/u);
  assert.match(frozen, /defaults:\n      run:\n        working-directory: frozen-rc2/u);
  assert.match(frozen, /fetch-depth: 0/u);
  assert.match(frozen, /cache-dependency-path: frozen-rc2\/package-lock\.json/u);
  for (const command of ["npm ci", "npm run release:artifact --",
    "node .github/scripts/canonicalize-release-artifact.js", "npm run verify:release:artifact"]) {
    assert.ok(frozen.includes(command), `Frozen reproduction requires ${command}`);
  }
  for (const [key, value] of Object.entries(frozenPins)) {
    assert.equal(ci.split(`${key}:`).length - 1, 1, `${key} belongs only to frozen reproduction`);
    assert.ok(frozen.includes(`${key}: ${value}\n`), `Frozen pin must not change: ${key}`);
  }
  assertArtifactUpload(frozen, FROZEN_ARTIFACT);
  assert.equal(frozen.includes(SOURCE_ARTIFACT) || frozen.includes("SPECQR_EXPECTED_SOURCE_COMMIT"), false);
  assert.match(frozen, /npm publish\s+"\$\{SPECQR_RELEASE_ARTIFACT_DIR\}\/specqr-3\.0\.0-rc\.2\.tgz"\s+--dry-run --tag next/u);
  assert.equal((ci.match(/\bnpm publish\b/gu) ?? []).length, 1, "Only frozen dry-run is allowed");

  for (const name of consumers) {
    const block = jobs.get(name);
    assertJobNeeds(block, name, "package-artifact");
    assertCheckout(block, "${{ github.sha }}");
    const downloads = extractSteps(block).filter((step) => step.includes("uses: actions/download-artifact@"));
    assert.equal(downloads.length, 1, `${name} needs exactly one artifact download`);
    assert.match(downloads[0], /uses: actions\/download-artifact@v5/u);
    assert.ok(downloads[0].includes(`name: ${SOURCE_ARTIFACT}\n`));
    assert.ok(downloads[0].includes(`path: \${{ runner.temp }}/${SOURCE_ARTIFACT}`));
    assert.ok(block.includes(`SPECQR_RELEASE_ARTIFACT_DIR: \${{ runner.temp }}/${SOURCE_ARTIFACT}`));
    assert.match(block, /echo "SPECQR_RELEASE_ARTIFACT_DIR=\$\{SPECQR_RELEASE_ARTIFACT_DIR\}" >> "\$\{GITHUB_ENV\}"/u);
    assert.match(block, /^      SPECQR_EXPECTED_VERSION: 3\.0\.0-rc\.2$/mu);
    assert.match(block, /^      SPECQR_ARTIFACT_KIND: unreleased-source-test$/mu);
    assert.match(block, /^      SPECQR_EXPECTED_SOURCE_COMMIT: \$\{\{ github\.sha \}\}$/mu);
    assert.equal(block.includes(FROZEN_ARTIFACT), false, `${name} must not mix frozen artifacts`);
    assert.equal(/release:artifact --|prepare-.*artifact\.js|npm publish/u.test(block), false);
    for (const step of extractSteps(block)) {
      if (/\bnpm pack\b/u.test(step)) {
        assert.equal(name, "release-gates");
        assert.match(step, /npm pack --dry-run --cache/u);
      }
    }
  }
  const requiredCommands = {
    "engine-matrix": ["npm ci", "npm run verify:release:artifact", "npm test", "npm run verify:types",
      "npm run examples:smoke", "npm run verify:pack", "npm ls --omit=dev"],
    "artifact-verification": ["npm ci", "npm run verify:release:artifact", "npm run verify:pack"],
    "browser-e2e": ["npm ci --prefix e2e/browser", "npm --prefix e2e/browser run install:browsers:ci", "npm run verify:browser:e2e"],
    "structured-append-zxing-java": ["npm ci", "npm run verify:structured-append:zxing-java"],
    "release-gates": ["npm ci", "npm run verify:release:artifact", "npm run pages:build", "npm run verify:decode",
      "npm run verify:decode:jsqr", "npm run verify:conformance:fuzz", "npm run verify:resource-safety",
      "npm run verify:structured-append:memory", "npm run verify:links", "npm run verify:writing",
      "npm run verify:release:workflow", "npm pack --dry-run --cache"]
  };
  for (const [name, commands] of Object.entries(requiredCommands)) {
    for (const command of commands) {
      assert.ok(extractSteps(jobs.get(name)).some((step) => step.split("\n").some((line) =>
        line === `      - run: ${command}` || line.startsWith(`      - run: ${command} "`))),
      `${name} requires ${command}`);
    }
  }
  assert.match(jobs.get("engine-matrix"), /node-version: \[18, 20, 22, 24\]/u);
  assert.match(jobs.get("engine-matrix"), /fail-fast: false/u);
  for (const name of consumers.slice(0, 4)) assert.match(jobs.get(name), /runs-on: ubuntu-latest/u);
  for (const name of consumers.slice(1, 4)) assert.match(jobs.get(name), /node-version: 22/u);
  assert.match(jobs.get("release-gates"), /runs-on: macos-15-intel/u);
  assert.match(jobs.get("release-gates"), /node-version: 20/u);
  assert.match(jobs.get("release-gates"), /brew install imagemagick/u);
  assertJobNeeds(jobs.get("release-gates"), "release-gates", "frozen-rc2-reproduction");
  for (const name of ["browser-e2e", "structured-append-zxing-java", "release-gates"]) {
    assertJobNeeds(jobs.get(name), name, "engine-matrix");
  }
  assertJobNeeds(jobs.get("release-gates"), "release-gates", "artifact-verification");
  assert.match(jobs.get("structured-append-zxing-java"), /distribution: temurin/u);
  assert.match(jobs.get("structured-append-zxing-java"), /java-version: "21\.0\.11\+10"/u);
  assert.match(jobs.get("structured-append-zxing-java"), /cache-dependency-path: e2e\/zxing-java\/pom\.xml/u);
  assert.match(jobs.get("browser-e2e"), /name: browser-e2e-failure-artifacts/u);
  assert.match(jobs.get("structured-append-zxing-java"), /name: structured-append-zxing-java-failure-artifacts/u);
  assert.equal((ci.match(/npm run verify:writing/gu) ?? []).length, 1);
  assert.match(published, /default: "specqr@3\.0\.0-rc\.2 specqr@next"/u);
  assert.match(published, /default: "3\.0\.0-rc\.2"/u);
  assert.match(published, /--expected-version "\$\{\{ inputs\.expected_version \}\}"/u);
  assert.match(published, /SPECQR_PUBLISHED_SPECS: \$\{\{ inputs\.package_specs \}\}/u);
}

function extractJobs(source) {
  const lines = source.split(/\r?\n/u);
  const start = lines.indexOf("jobs:");
  assert.notEqual(start, -1);
  const jobs = new Map();
  let current;
  for (const line of lines.slice(start + 1)) {
    const match = line.match(/^  ([a-z0-9-]+):\s*$/u);
    if (match) {
      current = match[1];
      assert.equal(jobs.has(current), false, "Duplicate job");
      jobs.set(current, line);
    } else if (current) jobs.set(current, `${jobs.get(current)}\n${line}`);
  }
  return jobs;
}
function extractSteps(block) {
  return block.split(/(?=^      - (?:uses|name|run):)/mu).slice(1);
}
function assertCheckout(block, ref) {
  const steps = extractSteps(block).filter((step) => step.includes("uses: actions/checkout@"));
  assert.equal(steps.length, 1, "Each lane must have exactly one checkout");
  assert.ok(steps[0].includes(`uses: actions/checkout@v6\n        with:\n          ref: ${ref}\n`));
}
function assertArtifactUpload(block, name) {
  const steps = extractSteps(block).filter((step) => step.includes("uses: actions/upload-artifact@"));
  assert.equal(steps.length, 2, "One canonical upload and one failure-evidence upload");
  const canonical = steps.filter((step) => !step.includes("if: failure()"));
  assert.equal(canonical.length, 1);
  assert.ok(canonical[0].includes(`name: ${name}\n`));
  assert.ok(canonical[0].includes(`path: \${{ runner.temp }}/${name}/`));
  assert.match(canonical[0], /if-no-files-found: error/u);
}
function assertJobNeeds(block, job, dependency) {
  const match = block.match(/^    needs: ([a-z0-9-]+)$/mu);
  const list = block.match(/^    needs:\n((?:      - [a-z0-9-]+\n)+)/mu);
  const needs = match ? [match[1]] : (list?.[1].match(/[a-z0-9-]+(?=\n)/gu) ?? []);
  assert.ok(needs.includes(dependency), `${job} must depend on ${dependency}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  verifyWorkflowContract(
    await readFile(path.join(process.cwd(), ".github/workflows/ci.yml"), "utf8"),
    await readFile(path.join(process.cwd(), ".github/workflows/published-smoke.yml"), "utf8")
  );
  console.log("ok workflow contract: current-commit source-test consumers and mandatory immutable rc.2 reproduction");
}
