import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const ciPath = path.join(root, ".github", "workflows", "ci.yml");
const publishedPath = path.join(
  root,
  ".github",
  "workflows",
  "published-smoke.yml"
);
const ci = await readFile(ciPath, "utf8");
const published = await readFile(publishedPath, "utf8");

assert.equal(ci.includes("\t"), false, "ci.yml must not contain tabs");
assert.equal(
  published.includes("\t"),
  false,
  "published-smoke.yml must not contain tabs"
);

const jobs = extractJobs(ci);
for (const requiredJob of [
  "package-artifact",
  "engine-matrix",
  "artifact-verification",
  "browser-e2e",
  "structured-append-zxing-java",
  "release-gates"
]) {
  assert.ok(jobs.has(requiredJob), `Missing CI job: ${requiredJob}`);
}

const producer = jobs.get("package-artifact");
assert.match(producer, /npm run release:artifact/u);
assert.match(producer, /name: specqr-release-artifact/u);
assert.match(
  producer,
  /path: \$\{\{ runner\.temp \}\}\/specqr-release-artifact\//u
);

for (const consumer of [
  "engine-matrix",
  "artifact-verification",
  "browser-e2e",
  "structured-append-zxing-java",
  "release-gates"
]) {
  const block = jobs.get(consumer);
  assertJobNeeds(block, consumer, "package-artifact");
  assert.match(block, /uses: actions\/download-artifact@v5/u);
  assert.match(block, /name: specqr-release-artifact/u);
  assert.match(
    block,
    /SPECQR_RELEASE_ARTIFACT_DIR: \$\{\{ runner\.temp \}\}\/specqr-release-artifact/u
  );
  assert.match(block, /SPECQR_EXPECTED_VERSION: 3\.0\.0-rc\.1/u);
}

assert.match(
  jobs.get("engine-matrix"),
  /node-version: \[18, 20, 22, 24\]/u
);
assert.match(jobs.get("engine-matrix"), /npm run verify:pack/u);
assert.match(jobs.get("artifact-verification"), /npm run verify:release:artifact/u);
assert.match(jobs.get("artifact-verification"), /npm run verify:pack/u);
assert.match(jobs.get("browser-e2e"), /npm run verify:browser:e2e/u);
assert.match(
  jobs.get("structured-append-zxing-java"),
  /npm run verify:structured-append:zxing-java/u
);
assert.match(
  jobs.get("release-gates"),
  /npm publish\s+"\$\{SPECQR_RELEASE_ARTIFACT_DIR\}\/specqr-3\.0\.0-rc\.1\.tgz"\s+--dry-run --tag next/u
);
assert.equal(
  (ci.match(/npm run verify:writing/gu) ?? []).length,
  1,
  "verify:writing must run exactly once in the release workflow"
);

for (const packageConsumer of [
  "engine-matrix",
  "artifact-verification",
  "browser-e2e",
  "structured-append-zxing-java"
]) {
  assert.equal(
    /^\s*-\s+run:\s+npm pack\b/mu.test(jobs.get(packageConsumer)),
    false,
    `${packageConsumer} must not repack the package`
  );
}

assert.match(
  published,
  /default: "specqr@3\.0\.0-rc\.1 specqr@next"/u
);
assert.match(published, /default: "3\.0\.0-rc\.1"/u);
assert.match(
  published,
  /--expected-version "\$\{\{ inputs\.expected_version \}\}"/u
);
assert.match(
  published,
  /SPECQR_PUBLISHED_SPECS: \$\{\{ inputs\.package_specs \}\}/u
);

console.log(
  "ok release workflow contract: one producer, canonical artifact consumers, "
    + "Node 18/20/22/24, browser, ZXing, and exact post-publish inputs"
);

function extractJobs(source) {
  const lines = source.split(/\r?\n/u);
  const jobsLine = lines.findIndex((line) => line === "jobs:");
  assert.notEqual(jobsLine, -1, "Workflow must define jobs");
  const jobs = new Map();
  let current = null;
  let buffer = [];

  for (const line of lines.slice(jobsLine + 1)) {
    const match = line.match(/^  ([a-z0-9-]+):\s*$/u);
    if (match) {
      if (current) {
        jobs.set(current, buffer.join("\n"));
      }
      current = match[1];
      buffer = [line];
    } else if (current) {
      buffer.push(line);
    }
  }
  if (current) {
    jobs.set(current, buffer.join("\n"));
  }
  return jobs;
}

function assertJobNeeds(block, job, dependency) {
  const single = new RegExp(`needs:\\s*${dependency}\\b`, "u");
  const list = new RegExp(`needs:[\\s\\S]*?\\n\\s+- ${dependency}\\b`, "u");
  assert.ok(
    single.test(block) || list.test(block),
    `${job} must depend on ${dependency}`
  );
}
