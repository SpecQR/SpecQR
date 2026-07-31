import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  writeFile
} from "node:fs/promises";
import { writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertPackageContentPolicy,
  assertReleasePackageMetadata,
  inspectTarball,
  readPackageJsonFromTarball,
  resolveReleaseArtifact,
  verifyReleaseArtifact
} from "./lib/release-artifact.js";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const HARNESS_DIRECTORY = path.join(ROOT, "e2e", "zxing-java");
const MAVEN_WRAPPER = path.join(HARNESS_DIRECTORY, "mvnw");
const POM_PATH = path.join(HARNESS_DIRECTORY, "pom.xml");
const FIXTURE_DRIVER = path.join(
  HARNESS_DIRECTORY,
  "fixture-driver.mjs"
);
const JAVA_MAIN_CLASS =
  "org.specqr.e2e.StructuredAppendMetadataDecoder";
const PINNED = Object.freeze({
  jdk: "21.0.11+10",
  jdkFeature: 21,
  maven: "3.9.16",
  mavenWrapper: "3.3.4",
  zxingCore: "3.5.4",
  zxingJavase: "3.5.4"
});
const artifact = await resolveReleaseArtifact();
assert.equal(
  artifact.remainingArgs.length,
  0,
  `Unexpected arguments: ${artifact.remainingArgs.join(" ")}`
);
const sourcePackage = JSON.parse(
  await readFile(path.join(ROOT, "package.json"), "utf8")
);

const artifactBase = path.resolve(
  process.env.SPECQR_ZXING_ARTIFACT_DIR?.trim()
    || tmpdir()
);
await mkdir(artifactBase, { recursive: true });
const runDirectory = await mkdtemp(
  path.join(artifactBase, "specqr-zxing-java-")
);
const logsDirectory = path.join(runDirectory, "logs");
const packDirectory = path.join(runDirectory, "pack");
const consumerDirectory = path.join(runDirectory, "consumer");
const imageDirectory = path.join(runDirectory, "fixtures");
const mavenDirectory = path.join(runDirectory, "maven");
const reportPath = path.join(runDirectory, "report.json");
const manifestPath = path.join(runDirectory, "fixture-manifest.json");
const imageListPath = path.join(runDirectory, "image-list.txt");
const decoderOutputPath = path.join(runDirectory, "decoder-output.ndjson");
const verificationPath = path.join(runDirectory, "verification.json");
const classpathPath = path.join(runDirectory, "zxing-classpath.txt");
const npmCache = path.join(runDirectory, "npm-cache");
const report = {
  schemaVersion: 1,
  status: "running",
  startedAt: new Date().toISOString(),
  pinned: PINNED,
  artifactDirectory: runDirectory,
  artifacts: {
    fixtureManifest: manifestPath,
    imageList: imageListPath,
    decoderOutput: decoderOutputPath,
    verification: verificationPath,
    fixtures: imageDirectory,
    logs: logsDirectory,
    mavenBuild: mavenDirectory
  },
  toolchain: {},
  package: null,
  verification: null,
  commands: []
};

await Promise.all([
  mkdir(logsDirectory, { recursive: true }),
  mkdir(packDirectory, { recursive: true }),
  mkdir(consumerDirectory, { recursive: true }),
  mkdir(imageDirectory, { recursive: true }),
  mkdir(mavenDirectory, { recursive: true })
]);

try {
  const java = detectJdk();
  report.toolchain.node = process.version;
  report.toolchain.java = java;

  const mavenEnvironment = {
    ...process.env,
    MAVEN_USER_HOME:
      process.env.MAVEN_USER_HOME?.trim()
      || path.join(homedir(), ".m2")
  };
  const mavenVersion = runLogged(
    "maven-version",
    MAVEN_WRAPPER,
    ["--version"],
    {
      cwd: HARNESS_DIRECTORY,
      env: mavenEnvironment
    }
  );
  const actualMavenVersion = parseMavenVersion(
    `${mavenVersion.stdout}\n${mavenVersion.stderr}`
  );
  assert.equal(
    actualMavenVersion,
    PINNED.maven,
    "Maven Wrapper resolved an unexpected Maven version"
  );
  report.toolchain.maven = actualMavenVersion;
  report.toolchain.mavenWrapper = PINNED.mavenWrapper;

  let packResult;
  let tarballPath;
  if (artifact.provided) {
    let inspection;
    let packageJson;
    if (artifact.manifestPath) {
      const verified = await verifyReleaseArtifact({
        tarballPath: artifact.tarballPath,
        manifestPath: artifact.manifestPath,
        expectedVersion: sourcePackage.version
      });
      inspection = verified.inspection;
      packageJson = verified.packageJson;
    } else {
      inspection = await inspectTarball(artifact.tarballPath);
      assertPackageContentPolicy(inspection.contents.files);
      packageJson = await readPackageJsonFromTarball(artifact.tarballPath);
      assertReleasePackageMetadata(packageJson, sourcePackage.version);
    }
    tarballPath = artifact.tarballPath;
    packResult = {
      name: packageJson.name,
      version: packageJson.version,
      filename: inspection.tarball.filename,
      sha256: inspection.tarball.sha256
    };
    report.commands.push({
      name: "provided-release-artifact",
      command: "release-artifact",
      args: [tarballPath],
      cwd: ROOT,
      status: 0,
      signal: null,
      durationMs: 0
    });
  } else {
    const pack = runLogged(
      "npm-pack",
      npmCommand(),
      [
        "pack",
        "--json",
        "--pack-destination",
        packDirectory,
        "--cache",
        npmCache
      ],
      { cwd: ROOT }
    );
    packResult = parseNpmPackResult(pack.stdout);
    tarballPath = path.join(packDirectory, packResult.filename);
  }
  report.package = {
    name: packResult.name,
    version: packResult.version,
    tarball: tarballPath,
    shasum: packResult.shasum ?? null,
    integrity: packResult.integrity ?? null,
    sha256: packResult.sha256 ?? null,
    source: artifact.provided ? "provided-release-artifact" : "self-packed"
  };

  await writeFile(
    path.join(consumerDirectory, "package.json"),
    `${JSON.stringify({
      name: "specqr-zxing-java-packed-consumer",
      private: true,
      type: "module"
    }, null, 2)}\n`
  );
  runLogged(
    "npm-install-packed",
    npmCommand(),
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--cache",
      npmCache,
      tarballPath
    ],
    { cwd: consumerDirectory }
  );

  const installedManifest = JSON.parse(
    await readFile(
      path.join(
        consumerDirectory,
        "node_modules",
        "specqr",
        "package.json"
      ),
      "utf8"
    )
  );
  assertReleasePackageMetadata(installedManifest, sourcePackage.version);
  assert.equal(installedManifest.version, packResult.version);
  report.package.exports = installedManifest.exports;

  const installedFixtureDriver = path.join(
    consumerDirectory,
    "fixture-driver.mjs"
  );
  await copyFile(FIXTURE_DRIVER, installedFixtureDriver);
  runLogged(
    "generate-packed-fixtures",
    process.execPath,
    [
      installedFixtureDriver,
      "generate",
      imageDirectory,
      manifestPath
    ],
    { cwd: consumerDirectory }
  );

  const fixtureManifest = JSON.parse(
    await readFile(manifestPath, "utf8")
  );
  assert.equal(fixtureManifest.package.name, "specqr");
  assert.equal(
    fixtureManifest.package.version,
    installedManifest.version
  );
  const imagePaths = fixtureManifest.fixtures.flatMap((fixture) =>
    fixture.scanOrder.map(
      (symbolIndex) => fixture.symbols[symbolIndex].imagePath
    )
  );
  await writeFile(imageListPath, `${imagePaths.join("\n")}\n`);

  runLogged(
    "maven-build",
    MAVEN_WRAPPER,
    [
      "-B",
      "-ntp",
      "-f",
      POM_PATH,
      "compile",
      "dependency:build-classpath",
      `-Dspecqr.build.directory=${mavenDirectory}`,
      `-Dmdep.outputFile=${classpathPath}`
    ],
    {
      cwd: HARNESS_DIRECTORY,
      env: mavenEnvironment
    }
  );

  const resolvedClasspath = (
    await readFile(classpathPath, "utf8")
  ).trim();
  assert.ok(resolvedClasspath, "Maven produced an empty ZXing classpath");
  const classpathOverride =
    process.env.ZXING_CLASSPATH?.trim() || null;
  const decoderClasspath = [
    path.join(mavenDirectory, "classes"),
    classpathOverride || resolvedClasspath
  ].join(path.delimiter);
  report.toolchain.classpathSource = classpathOverride
    ? "ZXING_CLASSPATH override"
    : "pinned Maven dependencies";

  runLogged(
    "zxing-java-decode",
    java.javaCommand,
    [
      "-cp",
      decoderClasspath,
      JAVA_MAIN_CLASS,
      imageListPath,
      decoderOutputPath
    ],
    {
      cwd: HARNESS_DIRECTORY,
      env: process.env
    }
  );

  runLogged(
    "verify-decoded-fixtures",
    process.execPath,
    [
      installedFixtureDriver,
      "verify",
      manifestPath,
      decoderOutputPath,
      verificationPath
    ],
    { cwd: consumerDirectory }
  );

  report.verification = JSON.parse(
    await readFile(verificationPath, "utf8")
  );
  assert.equal(report.verification.status, "passed");
  assert.equal(
    report.verification.toolchain.zxingCoreVersion,
    PINNED.zxingCore,
    "decoded ZXing core version"
  );
  assert.equal(
    report.verification.toolchain.zxingJavaseVersion,
    PINNED.zxingJavase,
    "decoded ZXing javase version"
  );
  report.status = "passed";
  report.completedAt = new Date().toISOString();
  await writeReport();

  const { summary } = report.verification;
  console.log(
    `ok required ZXing Java Structured Append metadata: `
      + `${summary.symbolCount} symbols across `
      + `${summary.fixtureCount} fixtures`
  );
  console.log(
    `ok payload assertions: text-merge=${summary.textMergeAssertions} `
      + `metadata-only=${summary.metadataOnlyAssertions}`
  );
  console.log(
    `ok toolchain: JDK ${java.runtimeVersion}, `
      + `Maven ${actualMavenVersion}, ZXing ${PINNED.zxingCore}`
  );
  console.log(`report ${reportPath}`);
} catch (error) {
  report.status = "failed";
  report.completedAt = new Date().toISOString();
  report.failure = serializeError(error);
  report.verification = await readJsonIfPresent(verificationPath);
  await writeReport();

  console.error(
    "ZXing Java Structured Append verification failed.\n"
      + `${error?.stack ?? error}\n`
      + `Failure artifacts: ${runDirectory}\n`
      + "Recovery: install Eclipse Temurin JDK 21, set JAVA_HOME, "
      + "ensure Maven Central is reachable, then rerun "
      + "`npm run verify:structured-append:zxing-java`."
  );
  process.exitCode = 1;
}

function detectJdk() {
  const javaHome = process.env.JAVA_HOME?.trim();
  const javaCommand =
    process.env.JAVA?.trim()
    || (javaHome ? path.join(javaHome, "bin", "java") : "java");
  const javacCommand =
    process.env.JAVAC?.trim()
    || (javaHome ? path.join(javaHome, "bin", "javac") : "javac");
  const javaVersion = spawnSync(javaCommand, ["-version"], {
    encoding: "utf8"
  });
  const javacVersion = spawnSync(javacCommand, ["-version"], {
    encoding: "utf8"
  });

  if (
    javaVersion.error
    || javaVersion.status !== 0
    || javacVersion.error
    || javacVersion.status !== 0
  ) {
    throw new Error(
      "JDK 21 is required; both java and javac must be available. "
        + `Expected canonical CI JDK ${PINNED.jdk}.`
    );
  }

  const javaText =
    `${javaVersion.stdout}\n${javaVersion.stderr}`.trim();
  const javacText =
    `${javacVersion.stdout}\n${javacVersion.stderr}`.trim();
  const featureMatch = javacText.match(/\bjavac\s+(\d+)/u);
  if (!featureMatch) {
    throw new Error(`Could not determine JDK feature version: ${javacText}`);
  }
  const feature = Number(featureMatch[1]);
  if (feature !== PINNED.jdkFeature) {
    throw new Error(
      `JDK ${PINNED.jdkFeature} is required; detected JDK ${feature}. `
        + `The canonical CI distribution is Eclipse Temurin ${PINNED.jdk}.`
    );
  }

  const runtimeMatch = javaText.match(
    /(?:openjdk|java) version "([^"]+)"/u
  );
  return {
    javaCommand,
    javacCommand,
    feature,
    runtimeVersion: runtimeMatch?.[1] ?? "unknown",
    javaVersionOutput: javaText,
    javacVersionOutput: javacText,
    canonicalCiVersion: PINNED.jdk
  };
}

function runLogged(name, command, args, options = {}) {
  const startedAt = Date.now();
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024
  });
  const commandRecord = {
    name,
    command,
    args,
    cwd: options.cwd ?? process.cwd(),
    status: result.status,
    signal: result.signal ?? null,
    durationMs: Date.now() - startedAt
  };
  report.commands.push(commandRecord);
  const logPath = path.join(logsDirectory, `${name}.log`);
  const log = [
    `$ ${command} ${args.map(shellQuoteForLog).join(" ")}`,
    `cwd: ${commandRecord.cwd}`,
    `status: ${result.status}`,
    "",
    "stdout:",
    result.stdout ?? "",
    "",
    "stderr:",
    result.stderr ?? ""
  ].join("\n");
  writeFileSync(logPath, log);

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed with exit code `
        + `${result.status}; see ${logPath}`
    );
  }
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? ""
  };
}

function parseMavenVersion(output) {
  const match = output.match(/\bApache Maven (\d+\.\d+\.\d+)\b/u);
  if (!match) {
    throw new Error(`Could not determine Maven version:\n${output}`);
  }
  return match[1];
}

function parseNpmPackResult(stdout) {
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch (error) {
    throw new Error(
      `Could not parse npm pack JSON: ${error.message}\n${stdout}`
    );
  }
  assert.ok(Array.isArray(parsed) && parsed.length === 1);
  assert.ok(parsed[0].filename);
  return parsed[0];
}

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function shellQuoteForLog(value) {
  return /^[A-Za-z0-9_./:=+-]+$/u.test(value)
    ? value
    : JSON.stringify(value);
}

async function writeReport() {
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}

async function readJsonIfPresent(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

function serializeError(error) {
  return {
    name: error?.name ?? "Error",
    message: error?.message ?? String(error),
    stack: error?.stack ?? null
  };
}
