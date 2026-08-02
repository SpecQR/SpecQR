import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import {
  access,
  mkdir,
  readFile,
  readdir,
  stat
} from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";

export const RELEASE_ARTIFACT_MANIFEST = "specqr-release-artifact.json";

const EXPECTED_EXPORTS = Object.freeze({
  ".": {
    types: "./src/index.d.ts",
    import: "./src/index.js"
  },
  "./browser": {
    types: "./src/browser.d.ts",
    import: "./src/browser.js"
  },
  "./node": {
    types: "./src/node.d.ts",
    import: "./src/node.js"
  }
});

const ALLOWED_TOP_LEVEL_DIRECTORIES = new Set([
  "docs",
  "examples",
  "fixtures",
  "playground",
  "src",
  "tools"
]);

const ALLOWED_TOP_LEVEL_FILES = new Set([
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "LICENSE",
  "README.md",
  "SECURITY.md",
  "package.json"
]);

const REQUIRED_PATHS = Object.freeze([
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "LICENSE",
  "README.md",
  "SECURITY.md",
  "package.json",
  "src/index.js",
  "src/index.d.ts",
  "src/node.js",
  "src/node.d.ts",
  "src/browser.js",
  "src/browser.d.ts",
  "docs/api.md",
  "docs/conformance.md",
  "docs/release-artifact.md",
  "docs/release.md",
  "docs/release-notes-3.0.0-rc.1.md",
  "docs/release-notes-3.0.0-rc.2.md",
  "docs/spec-scope.md",
  "docs/test-plan.md",
  "docs/v3-migration.md",
  "docs/v3-roadmap.md",
  "docs/v3-structured-append-diagnostics.md",
  "examples/gs1-digital-link.mjs",
  "examples/planning-api.mjs",
  "examples/structured-append.mjs",
  "fixtures/golden-cases.json",
  "fixtures/structured-append-segments.json",
  "playground/index.html",
  "playground/playground.js",
  "tools/prepare-release-artifact.js",
  "tools/verify-doc-links.js",
  "tools/verify-packed-package.js",
  "tools/verify-release-artifact.js"
]);

const DENIED_TOP_LEVEL = new Set([
  ".git",
  ".github",
  "coverage",
  "dist",
  "e2e",
  "node_modules",
  "screenshots",
  "test-results",
  "tests",
  "tmp"
]);

const DENIED_SEGMENTS = new Set([
  ".cache",
  "__pycache__",
  "artifacts",
  "cache",
  "classes",
  "node_modules",
  "playwright-report",
  "screenshots",
  "target",
  "test-results",
  "tmp"
]);

const DENIED_EXTENSIONS = new Set([
  ".class",
  ".jar",
  ".log",
  ".png",
  ".tar",
  ".tgz"
]);

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export async function assertEmptyExternalOutputDirectory(
  repositoryRoot,
  outputDirectory
) {
  const root = path.resolve(repositoryRoot);
  const output = path.resolve(outputDirectory);
  const relative = path.relative(root, output);
  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
    throw new Error(
      `Release artifact output must be outside the repository: ${output}`
    );
  }

  await mkdir(output, { recursive: true });
  const entries = await readdir(output);
  if (entries.length > 0) {
    throw new Error(
      `Release artifact output directory must be empty: ${output}`
    );
  }
}

export async function runNpmPack({
  repositoryRoot,
  destination,
  cacheDirectory
}) {
  await mkdir(destination, { recursive: true });
  const stdout = await runCapture(
    npmCommand(),
    [
      "pack",
      "--json",
      "--pack-destination",
      destination,
      "--cache",
      cacheDirectory
    ],
    repositoryRoot
  );
  let result;
  try {
    const parsed = JSON.parse(stdout);
    assert.ok(Array.isArray(parsed) && parsed.length === 1);
    result = parsed[0];
  } catch (error) {
    throw new Error(`Could not parse npm pack JSON: ${error.message}\n${stdout}`);
  }
  assert.equal(typeof result.filename, "string");
  const tarballPath = path.join(destination, result.filename);
  await access(tarballPath);
  return { result, tarballPath };
}

export async function inspectTarball(tarballPath) {
  const bytes = await readFile(tarballPath);
  const files = parseNpmTarball(bytes);
  const canonicalFiles = files.map(({ path: filePath, size, sha256: hash }) => ({
    path: filePath,
    size,
    sha256: hash
  }));
  return {
    tarball: {
      filename: path.basename(tarballPath),
      size: bytes.byteLength,
      sha256: sha256(bytes)
    },
    contents: {
      fileCount: canonicalFiles.length,
      unpackedSize: canonicalFiles.reduce((total, file) => total + file.size, 0),
      sha256: sha256(`${JSON.stringify(canonicalFiles)}\n`),
      files: canonicalFiles
    }
  };
}

export function assertContentManifestsEqual(first, second) {
  assert.deepEqual(
    second.contents.files,
    first.contents.files,
    "Repeated npm pack produced different expanded package content"
  );
  assert.equal(
    second.contents.sha256,
    first.contents.sha256,
    "Repeated npm pack produced a different content-manifest hash"
  );
}

export function assertNpmPackMetadata(packResult, inspection) {
  assert.equal(packResult.filename, inspection.tarball.filename);
  assert.equal(packResult.size, inspection.tarball.size);
  assert.equal(packResult.unpackedSize, inspection.contents.unpackedSize);
  assert.equal(packResult.entryCount, inspection.contents.fileCount);
  assert.ok(Array.isArray(packResult.files));

  const npmFiles = packResult.files
    .map((file) => ({ path: file.path, size: file.size }))
    .sort(comparePaths);
  const inspectedFiles = inspection.contents.files
    .map((file) => ({ path: file.path, size: file.size }))
    .sort(comparePaths);
  assert.deepEqual(npmFiles, inspectedFiles);
}

export function assertPackageContentPolicy(files) {
  const paths = files.map((file) => file.path);
  const pathSet = new Set(paths);
  for (const requiredPath of REQUIRED_PATHS) {
    assert.ok(
      pathSet.has(requiredPath),
      `Release package is missing required path: ${requiredPath}`
    );
  }

  for (const filePath of paths) {
    assertSafePackagePath(filePath);
    const segments = filePath.split("/");
    const topLevel = segments[0];
    if (segments.length === 1) {
      assert.ok(
        ALLOWED_TOP_LEVEL_FILES.has(topLevel),
        `Release package has unexpected top-level file: ${filePath}`
      );
    } else {
      assert.ok(
        ALLOWED_TOP_LEVEL_DIRECTORIES.has(topLevel),
        `Release package has unexpected top-level directory: ${filePath}`
      );
    }
    assert.equal(
      DENIED_TOP_LEVEL.has(topLevel),
      false,
      `Release package includes denied top-level path: ${filePath}`
    );
    for (const segment of segments) {
      assert.equal(
        DENIED_SEGMENTS.has(segment),
        false,
        `Release package includes denied path segment: ${filePath}`
      );
    }
    const lowerPath = filePath.toLowerCase();
    assert.equal(
      lowerPath.includes("npm-debug"),
      false,
      `Release package includes an npm debug file: ${filePath}`
    );
    assert.equal(
      lowerPath.includes("screenshot"),
      false,
      `Release package includes a screenshot path: ${filePath}`
    );
    assert.equal(
      /(^|\/)(report|verification)(\.|\/|$)/u.test(lowerPath),
      false,
      `Release package includes a generated report path: ${filePath}`
    );
    assert.equal(
      DENIED_EXTENSIONS.has(path.extname(lowerPath)),
      false,
      `Release package includes denied generated binary/log content: ${filePath}`
    );
  }

  return {
    allowedTopLevelDirectories: Array.from(ALLOWED_TOP_LEVEL_DIRECTORIES).sort(),
    allowedTopLevelFiles: Array.from(ALLOWED_TOP_LEVEL_FILES).sort(),
    requiredPathCount: REQUIRED_PATHS.length,
    deniedTopLevel: Array.from(DENIED_TOP_LEVEL).sort(),
    deniedExtensions: Array.from(DENIED_EXTENSIONS).sort(),
    status: "passed"
  };
}

export async function readPackageJsonFromTarball(tarballPath) {
  const bytes = await readFile(tarballPath);
  const files = parseNpmTarball(bytes, { includeContent: true });
  const packageJson = files.find((file) => file.path === "package.json");
  assert.ok(packageJson, "Release tarball must contain package.json");
  return JSON.parse(packageJson.content.toString("utf8"));
}

export function assertReleasePackageMetadata(packageJson, expectedVersion) {
  assert.equal(packageJson.name, "specqr");
  if (expectedVersion) {
    assert.equal(packageJson.version, expectedVersion);
  }
  assert.equal(
    packageJson.description,
    "A dependency-free QR Code Model 2 generator for JavaScript."
  );
  assert.equal(packageJson.type, "module");
  assert.equal(packageJson.main, "./src/index.js");
  assert.equal(packageJson.types, "./src/index.d.ts");
  assert.deepEqual(packageJson.exports, EXPECTED_EXPORTS);
  assert.deepEqual(packageJson.engines, { node: ">=18" });
  assert.equal(packageJson.license, "MIT");
  assert.deepEqual(packageJson.repository, {
    type: "git",
    url: "git+https://github.com/SpecQR/SpecQR.git"
  });
  assert.equal(
    packageJson.homepage,
    "https://github.com/SpecQR/SpecQR#readme"
  );
  assert.deepEqual(packageJson.bugs, {
    url: "https://github.com/SpecQR/SpecQR/issues"
  });
  assert.equal(
    packageJson.dependencies === undefined
      || Object.keys(packageJson.dependencies).length === 0,
    true,
    "Release package must keep runtime dependencies empty"
  );
  return {
    name: packageJson.name,
    version: packageJson.version,
    description: packageJson.description,
    repository: packageJson.repository,
    homepage: packageJson.homepage,
    bugs: packageJson.bugs,
    engines: packageJson.engines,
    exports: packageJson.exports,
    runtimeDependencyCount: Object.keys(packageJson.dependencies ?? {}).length
  };
}

export async function resolveReleaseArtifact({
  argv = process.argv.slice(2),
  env = process.env,
  requireManifest = false
} = {}) {
  const parsed = parseArtifactArguments(argv);
  const artifactDirectory = parsed.artifactDirectory
    ?? trimOrNull(env.SPECQR_RELEASE_ARTIFACT_DIR);
  const explicitTarball = parsed.tarball
    ?? trimOrNull(env.SPECQR_TARBALL);
  const explicitManifest = parsed.manifest
    ?? trimOrNull(env.SPECQR_RELEASE_MANIFEST);

  if (artifactDirectory && explicitTarball) {
    throw new Error(
      "Use either --artifact-dir/SPECQR_RELEASE_ARTIFACT_DIR or "
        + "--tarball/SPECQR_TARBALL, not both"
    );
  }

  let manifestPath = explicitManifest ? path.resolve(explicitManifest) : null;
  if (artifactDirectory) {
    const resolvedDirectory = path.resolve(artifactDirectory);
    manifestPath ??= path.join(resolvedDirectory, RELEASE_ARTIFACT_MANIFEST);
  }

  let manifest = null;
  if (manifestPath) {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  } else if (requireManifest) {
    throw new Error(
      "A release artifact manifest is required. Pass --artifact-dir or --manifest."
    );
  }

  let tarballPath = explicitTarball ? path.resolve(explicitTarball) : null;
  if (!tarballPath && manifest) {
    tarballPath = path.resolve(
      path.dirname(manifestPath),
      manifest.artifact.filename
    );
  }
  if (!tarballPath) {
    return {
      provided: false,
      tarballPath: null,
      manifestPath,
      manifest,
      remainingArgs: parsed.remainingArgs
    };
  }
  await access(tarballPath);
  return {
    provided: true,
    tarballPath,
    manifestPath,
    manifest,
    remainingArgs: parsed.remainingArgs
  };
}

export async function verifyReleaseArtifact({
  tarballPath,
  manifestPath,
  expectedVersion
}) {
  assert.ok(tarballPath, "tarballPath is required");
  assert.ok(manifestPath, "manifestPath is required");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const inspection = await inspectTarball(tarballPath);
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.artifact.filename, path.basename(tarballPath));
  assert.deepEqual(manifest.artifact, inspection.tarball);
  assert.deepEqual(manifest.contents, inspection.contents);
  assert.equal(manifest.reproducibility.expandedContentMatches, true);
  assert.equal(
    manifest.reproducibility.secondContentSha256,
    inspection.contents.sha256
  );
  assert.equal(manifest.policy.status, "passed");

  const policy = assertPackageContentPolicy(inspection.contents.files);
  assert.equal(policy.status, "passed");
  const packageJson = await readPackageJsonFromTarball(tarballPath);
  const metadata = assertReleasePackageMetadata(
    packageJson,
    expectedVersion ?? manifest.package.version
  );
  assert.deepEqual(manifest.package, metadata);
  return { manifest, inspection, packageJson };
}

export async function getPathSize(filePath) {
  return (await stat(filePath)).size;
}

function parseArtifactArguments(argv) {
  const parsed = {
    artifactDirectory: null,
    tarball: null,
    manifest: null,
    expectedVersion: null,
    outputDirectory: null,
    remainingArgs: []
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const handlers = new Map([
      ["--artifact-dir", "artifactDirectory"],
      ["--tarball", "tarball"],
      ["--manifest", "manifest"],
      ["--expected-version", "expectedVersion"],
      ["--output-dir", "outputDirectory"]
    ]);
    if (handlers.has(argument)) {
      const value = argv[index + 1];
      if (!value) {
        throw new Error(`${argument} requires a value`);
      }
      parsed[handlers.get(argument)] = value;
      index += 1;
    } else {
      parsed.remainingArgs.push(argument);
    }
  }
  return parsed;
}

export function readReleaseArtifactArguments(argv = process.argv.slice(2)) {
  return parseArtifactArguments(argv);
}

function parseNpmTarball(compressed, { includeContent = false } = {}) {
  const tar = gunzipSync(compressed);
  const files = [];
  let offset = 0;
  let nextPax = null;
  let longPath = null;

  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) {
      break;
    }

    const name = readTarString(header, 0, 100);
    const prefix = readTarString(header, 345, 155);
    const type = String.fromCharCode(header[156] || 0);
    const size = readTarNumber(header, 124, 12);
    const contentStart = offset + 512;
    const contentEnd = contentStart + size;
    if (contentEnd > tar.length) {
      throw new Error(`Truncated tar entry: ${name}`);
    }
    const content = tar.subarray(contentStart, contentEnd);

    if (type === "x" || type === "g") {
      nextPax = parsePaxHeaders(content);
    } else if (type === "L") {
      longPath = content.toString("utf8").replace(/\0.*$/u, "");
    } else if (type === "5") {
      nextPax = null;
      longPath = null;
    } else if (type === "0" || type === "\0") {
      const headerPath = prefix ? `${prefix}/${name}` : name;
      const archivedPath = nextPax?.path ?? longPath ?? headerPath;
      const packagePath = normalizeNpmPackagePath(archivedPath);
      const file = {
        path: packagePath,
        size,
        sha256: sha256(content)
      };
      if (includeContent) {
        file.content = Buffer.from(content);
      }
      files.push(file);
      nextPax = null;
      longPath = null;
    } else {
      throw new Error(
        `Unsupported non-file entry in npm tarball: ${name} (type ${type})`
      );
    }

    offset = contentStart + Math.ceil(size / 512) * 512;
  }

  files.sort(comparePaths);
  const duplicates = files.filter(
    (file, index) => index > 0 && file.path === files[index - 1].path
  );
  assert.equal(
    duplicates.length,
    0,
    `Duplicate paths in npm tarball: ${duplicates.map((file) => file.path).join(", ")}`
  );
  return files;
}

function parsePaxHeaders(content) {
  const values = {};
  let offset = 0;
  while (offset < content.length) {
    const space = content.indexOf(0x20, offset);
    if (space < 0) {
      throw new Error("Invalid PAX header length");
    }
    const length = Number(content.subarray(offset, space).toString("ascii"));
    if (!Number.isSafeInteger(length) || length <= 0) {
      throw new Error("Invalid PAX record length");
    }
    const record = content
      .subarray(space + 1, offset + length - 1)
      .toString("utf8");
    const separator = record.indexOf("=");
    if (separator > 0) {
      values[record.slice(0, separator)] = record.slice(separator + 1);
    }
    offset += length;
  }
  return values;
}

function normalizeNpmPackagePath(archivedPath) {
  const normalized = archivedPath.replaceAll("\\", "/");
  if (!normalized.startsWith("package/")) {
    throw new Error(`npm tarball entry is outside package/: ${archivedPath}`);
  }
  const packagePath = normalized.slice("package/".length);
  assertSafePackagePath(packagePath);
  return packagePath;
}

function assertSafePackagePath(filePath) {
  assert.ok(filePath.length > 0, "Package path must not be empty");
  assert.equal(path.posix.isAbsolute(filePath), false);
  assert.equal(filePath.includes("\0"), false);
  assert.equal(
    filePath.split("/").some((segment) => segment === "" || segment === ".."),
    false,
    `Unsafe package path: ${filePath}`
  );
}

function readTarString(header, offset, length) {
  const bytes = header.subarray(offset, offset + length);
  const end = bytes.indexOf(0);
  return bytes.subarray(0, end < 0 ? bytes.length : end).toString("utf8");
}

function readTarNumber(header, offset, length) {
  const bytes = header.subarray(offset, offset + length);
  if ((bytes[0] & 0x80) !== 0) {
    let value = BigInt(bytes[0] & 0x7f);
    for (const byte of bytes.subarray(1)) {
      value = (value << 8n) | BigInt(byte);
    }
    const number = Number(value);
    if (!Number.isSafeInteger(number)) {
      throw new Error("Tar numeric field exceeds safe integer range");
    }
    return number;
  }
  const text = bytes.toString("ascii").replace(/\0.*$/u, "").trim();
  if (text === "") {
    return 0;
  }
  const value = Number.parseInt(text, 8);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Invalid tar numeric field: ${text}`);
  }
  return value;
}

function comparePaths(left, right) {
  return left.path < right.path ? -1 : left.path > right.path ? 1 : 0;
}

function trimOrNull(value) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function runCapture(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(
          new Error(`${command} ${args.join(" ")} exited with ${code}\n${stderr}`)
        );
      }
    });
  });
}
