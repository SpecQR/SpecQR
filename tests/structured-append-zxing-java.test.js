import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("ZXing Java Structured Append lane is required and exactly pinned", () => {
  const packageManifest = JSON.parse(read("package.json"));
  const pom = read("e2e/zxing-java/pom.xml");
  const wrapper = read("e2e/zxing-java/mvnw");
  const wrapperProperties = read(
    "e2e/zxing-java/.mvn/wrapper/maven-wrapper.properties"
  );
  const runner = read(
    "tools/verify-structured-append-zxing-java.js"
  );
  const workflow = read(".github/workflows/ci.yml");

  assert.equal(
    packageManifest.scripts["verify:structured-append:zxing-java"],
    "node tools/verify-structured-append-zxing-java.js"
  );
  assert.match(pom, /<zxing\.version>3\.5\.4<\/zxing\.version>/u);
  assert.match(pom, /<artifactId>core<\/artifactId>/u);
  assert.match(pom, /<artifactId>javase<\/artifactId>/u);
  assert.match(
    pom,
    /<directory>\$\{specqr\.build\.directory\}<\/directory>/u
  );
  assert.match(
    wrapper,
    /Apache Maven Wrapper startup batch script, version 3\.3\.4/u
  );
  assert.match(
    wrapperProperties,
    /apache-maven-3\.9\.16-bin\.zip/u
  );
  assert.match(
    wrapperProperties,
    /distributionSha256Sum=5af3b743dd8b876b5c45da33b676251e5f1687712644abb4ee519ca56e1d89ce/u
  );
  assert.doesNotMatch(runner, /SkipValidation|skip\(/u);
  assert.match(runner, /-Dspecqr\.build\.directory=/u);
  assert.match(
    workflow,
    /structured-append-zxing-java:[\s\S]*java-version: "21\.0\.11\+10"/u
  );
  assert.match(
    workflow,
    /run: npm run verify:structured-append:zxing-java/u
  );
});

test("ZXing Java fixture contract covers required Structured Append cases", () => {
  const fixtureDriver = read(
    "e2e/zxing-java/fixture-driver.mjs"
  );
  const requiredFixtureIds = [
    "raw-string-2-symbol",
    "raw-string-3-symbol-shuffled",
    "raw-string-16-symbol",
    "utf8-astral-text",
    "raw-binary",
    "raw-binary-offset-view",
    "manual-mixed-segments",
    "manual-byte-text-chunk",
    "manual-byte-binary-boundary",
    "fixed-version-ecc-mask"
  ];

  for (const fixtureId of requiredFixtureIds) {
    assert.match(fixtureDriver, new RegExp(`id: "${fixtureId}"`, "u"));
  }
  assert.match(fixtureDriver, /mergeStructuredAppendParts\(parts\)/u);
  assert.match(fixtureDriver, /kind: "metadata-only"/u);
  assert.match(fixtureDriver, /unique indices/u);
  assert.match(fixtureDriver, /complete indices/u);
  assert.match(fixtureDriver, /common parity/u);
});

test("ZXing Java harness and generated artifacts stay outside npm package files", () => {
  const packageManifest = JSON.parse(read("package.json"));
  const gitignore = read(".gitignore");

  assert.equal(packageManifest.files.includes("e2e"), false);
  assert.equal(packageManifest.dependencies, undefined);
  assert.match(gitignore, /e2e\/zxing-java\/target\//u);
  assert.match(gitignore, /e2e\/zxing-java\/artifacts\//u);
});
