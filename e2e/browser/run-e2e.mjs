import { chromium, firefox, webkit } from "@playwright/test";
import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertPackageContentPolicy,
  assertReleasePackageMetadata,
  inspectTarball,
  readPackageJsonFromTarball,
  resolveReleaseArtifact,
  verifyReleaseArtifact
} from "../../tools/lib/release-artifact.js";

const harnessRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(harnessRoot, "..", "..");
const installCommand = "npm --prefix e2e/browser run install:browsers";
const artifact = await resolveReleaseArtifact();
const playwrightArgs = artifact.remainingArgs;
const sourcePackage = JSON.parse(
  await readFile(path.join(repositoryRoot, "package.json"), "utf8")
);

assertSupportedNode();
await assertBrowsersInstalled();
await run("npm", ["run", "pages:build"], repositoryRoot);

const temporaryRoot = await mkdtemp(path.join(tmpdir(), "specqr-browser-e2e-"));
const packDirectory = path.join(temporaryRoot, "pack");
const installDirectory = path.join(temporaryRoot, "install");
const fixtureDirectory = path.join(temporaryRoot, "packed");
const cacheDirectory =
  process.env.SPECQR_NPM_CACHE ??
  path.join(tmpdir(), "specqr-browser-e2e-npm-cache");

let server;
try {
  await Promise.all([
    mkdir(packDirectory),
    mkdir(installDirectory),
    mkdir(fixtureDirectory)
  ]);

  let packed;
  let tarball;
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
    packed = {
      id: `${packageJson.name}@${packageJson.version}`,
      name: packageJson.name,
      version: packageJson.version,
      filename: inspection.tarball.filename,
      files: inspection.contents.files
    };
    tarball = artifact.tarballPath;
    console.log(`using provided release artifact ${tarball}`);
  } else {
    const packOutput = await runCapture(
      "npm",
      [
        "pack",
        "--json",
        "--pack-destination",
        packDirectory,
        "--cache",
        cacheDirectory
      ],
      repositoryRoot
    );
    [packed] = JSON.parse(packOutput);
    tarball = path.join(packDirectory, packed.filename);
  }
  if (packed.files.some((file) => file.path.startsWith("e2e/"))) {
    throw new Error("Browser E2E harness must not be included in the npm tarball");
  }

  await writeFile(
    path.join(installDirectory, "package.json"),
    JSON.stringify({ private: true, type: "module" }, null, 2)
  );
  await run(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--package-lock=false",
      "--cache",
      cacheDirectory,
      tarball
    ],
    installDirectory
  );

  const packageRoot = path.join(
    installDirectory,
    "node_modules",
    packed.name
  );
  const packageJson = JSON.parse(
    await readFile(path.join(packageRoot, "package.json"), "utf8")
  );
  assertReleasePackageMetadata(packageJson, sourcePackage.version);
  const rootEntry = resolveImportExport(packageJson.exports?.["."], ".");
  const browserEntry = resolveImportExport(
    packageJson.exports?.["./browser"],
    "./browser"
  );
  await Promise.all([
    access(path.join(packageRoot, stripDotSlash(rootEntry))),
    access(path.join(packageRoot, stripDotSlash(browserEntry)))
  ]);

  await writePackedFixture(fixtureDirectory, {
    packageJson,
    packed,
    rootEntry,
    browserEntry
  });

  const pagesRoot = path.join(repositoryRoot, "dist", "pages");
  await access(path.join(pagesRoot, "playground", "index.html"));
  server = await startFixtureServer({
    fixtureDirectory,
    packageRoot,
    pagesRoot
  });

  const baseURL = `http://127.0.0.1:${server.address().port}`;
  console.log(
    `SpecQR browser E2E fixture: ${packed.id}, root=${rootEntry}, browser=${browserEntry}`
  );
  console.log(`SpecQR browser E2E server: ${baseURL}`);

  const playwright = path.join(
    harnessRoot,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "playwright.cmd" : "playwright"
  );
  await run(
    playwright,
    ["test", ...playwrightArgs],
    harnessRoot,
    {
      ...process.env,
      SPECQR_E2E_BASE_URL: baseURL,
      PLAYWRIGHT_HTML_OPEN: "never"
    }
  );
} finally {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
  await rm(temporaryRoot, { recursive: true, force: true });
}

function assertSupportedNode() {
  const major = Number(process.versions.node.split(".")[0]);
  if (major < 22) {
    throw new Error(
      `Browser E2E requires Node.js >=22; current=${process.versions.node}`
    );
  }
}

async function assertBrowsersInstalled() {
  const missing = [];
  for (const [name, browserType] of [
    ["chromium", chromium],
    ["firefox", firefox],
    ["webkit", webkit]
  ]) {
    try {
      await access(browserType.executablePath());
    } catch {
      missing.push(name);
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `Playwright browser binaries are missing (${missing.join(", ")}). Run: ${installCommand}`
    );
  }
}

function resolveImportExport(descriptor, subpath) {
  if (typeof descriptor === "string") {
    return assertRelativeExport(descriptor, subpath);
  }
  if (descriptor && typeof descriptor === "object") {
    for (const condition of ["import", "browser", "default"]) {
      if (typeof descriptor[condition] === "string") {
        return assertRelativeExport(descriptor[condition], subpath);
      }
    }
  }
  throw new Error(`Package export ${subpath} has no browser-importable entry`);
}

function assertRelativeExport(entry, subpath) {
  if (!entry.startsWith("./") || entry.includes("..")) {
    throw new Error(`Package export ${subpath} is not a safe relative path: ${entry}`);
  }
  return entry;
}

function stripDotSlash(value) {
  return value.slice(2);
}

async function writePackedFixture(
  directory,
  { packageJson, packed, rootEntry, browserEntry }
) {
  const imports = {
    specqr: `/installed/specqr/${stripDotSlash(rootEntry)}`,
    "specqr/browser": `/installed/specqr/${stripDotSlash(browserEntry)}`
  };
  const metadata = {
    fixtureKind: "npm-pack-installed",
    package: {
      name: packageJson.name,
      version: packageJson.version,
      id: packed.id
    },
    entries: {
      root: rootEntry,
      browser: browserEntry
    },
    exports: packageJson.exports,
    imports
  };

  await writeFile(
    path.join(directory, "fixture-manifest.json"),
    JSON.stringify(metadata, null, 2)
  );
  await writeFile(
    path.join(directory, "index.html"),
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>SpecQR packed browser contract</title>
    <script type="importmap">${escapeInlineJson({ imports })}</script>
  </head>
  <body>
    <main><h1>SpecQR packed browser contract</h1></main>
    <script type="module">
      import * as specqr from "specqr";
      import * as specqrBrowser from "specqr/browser";

      globalThis.__specqr = specqr;
      globalThis.__specqrBrowser = specqrBrowser;
      globalThis.__specqrFixture = Object.freeze(${escapeInlineJson(metadata)});
      globalThis.__specqrReady = true;
    </script>
  </body>
</html>
`
  );
}

function escapeInlineJson(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

async function startFixtureServer({ fixtureDirectory, packageRoot, pagesRoot }) {
  const routes = [
    {
      prefix: "/packed/",
      root: fixtureDirectory,
      fixture: "packed-fixture"
    },
    {
      prefix: "/installed/specqr/",
      root: packageRoot,
      fixture: "packed-install"
    },
    {
      prefix: "/pages/",
      root: pagesRoot,
      fixture: "built-pages"
    }
  ];
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      if (url.pathname === "/favicon.ico") {
        response.writeHead(204);
        response.end();
        return;
      }
      if (url.pathname === "/") {
        response.writeHead(302, { Location: "/packed/" });
        response.end();
        return;
      }
      const route = routes.find(({ prefix }) => url.pathname.startsWith(prefix));
      if (!route) {
        response.writeHead(404);
        response.end("Not found");
        return;
      }

      const relativePath = decodeURIComponent(
        url.pathname.slice(route.prefix.length)
      );
      const filePath = await resolveFile(route.root, relativePath);
      const file = await stat(filePath);
      response.writeHead(200, {
        "Content-Type": getContentType(filePath),
        "Cache-Control": "no-store",
        "Content-Length": file.size,
        "X-SpecQR-Fixture": route.fixture
      });
      if (request.method === "HEAD") {
        response.end();
      } else {
        createReadStream(filePath).pipe(response);
      }
    } catch (error) {
      const statusCode = error?.code === "ENOENT" ? 404 : 500;
      response.writeHead(statusCode);
      response.end(statusCode === 404 ? "Not found" : "Internal server error");
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return server;
}

async function resolveFile(root, relativePath) {
  const normalizedRoot = path.resolve(root);
  let candidate = path.resolve(normalizedRoot, relativePath || ".");
  if (
    candidate !== normalizedRoot &&
    !candidate.startsWith(`${normalizedRoot}${path.sep}`)
  ) {
    throw Object.assign(new Error("Forbidden"), { code: "EACCES" });
  }
  const details = await stat(candidate);
  if (details.isDirectory()) {
    candidate = path.join(candidate, "index.html");
  }
  return candidate;
}

function getContentType(filePath) {
  const extension = path.extname(filePath);
  return new Map([
    [".css", "text/css; charset=utf-8"],
    [".html", "text/html; charset=utf-8"],
    [".js", "text/javascript; charset=utf-8"],
    [".json", "application/json; charset=utf-8"],
    [".png", "image/png"],
    [".svg", "image/svg+xml; charset=utf-8"]
  ]).get(extension) ?? "application/octet-stream";
}

function run(command, args, cwd, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: "inherit"
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
      }
    });
  });
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
