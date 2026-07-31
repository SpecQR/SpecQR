import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const markdownFiles = [
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "README.md",
  "SECURITY.md",
  ...(await collectMarkdownFiles(path.join(root, "docs")))
    .map((filePath) => path.relative(root, filePath))
].sort();
const failures = [];
let relativeLinkCount = 0;

for (const relativeFile of markdownFiles) {
  const sourcePath = path.join(root, relativeFile);
  const source = await readFile(sourcePath, "utf8");
  for (const target of extractInlineLinkTargets(source)) {
    if (isExternalOrDocumentLocal(target)) {
      continue;
    }
    relativeLinkCount += 1;
    const pathPart = target.split("#", 1)[0].split("?", 1)[0];
    if (!pathPart) {
      continue;
    }
    let decoded;
    try {
      decoded = decodeURIComponent(pathPart);
    } catch {
      failures.push(`${relativeFile}: invalid percent encoding in ${target}`);
      continue;
    }
    const resolved = path.resolve(path.dirname(sourcePath), decoded);
    const relativeToRoot = path.relative(root, resolved);
    if (
      relativeToRoot === ".."
      || relativeToRoot.startsWith(`..${path.sep}`)
      || path.isAbsolute(relativeToRoot)
    ) {
      failures.push(`${relativeFile}: link escapes repository: ${target}`);
      continue;
    }
    try {
      await stat(resolved);
    } catch {
      failures.push(`${relativeFile}: missing link target: ${target}`);
    }
  }
}

assert.deepEqual(
  failures,
  [],
  `Markdown link failures:\n${failures.join("\n")}`
);
console.log(
  `ok markdown links: ${markdownFiles.length} files, `
    + `${relativeLinkCount} relative targets`
);

async function collectMarkdownFiles(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      result.push(...await collectMarkdownFiles(filePath));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      result.push(filePath);
    }
  }
  return result;
}

function extractInlineLinkTargets(source) {
  const targets = [];
  const pattern = /!?\[[^\]]*\]\(([^)\n]+)\)/gu;
  for (const match of source.matchAll(pattern)) {
    let target = match[1].trim();
    if (target.startsWith("<")) {
      const end = target.indexOf(">");
      if (end >= 0) {
        target = target.slice(1, end);
      }
    } else {
      target = target.split(/\s+(?=["'])/u, 1)[0];
    }
    targets.push(target);
  }
  return targets;
}

function isExternalOrDocumentLocal(target) {
  return target.startsWith("#")
    || target.startsWith("/")
    || /^[a-z][a-z0-9+.-]*:/iu.test(target);
}
