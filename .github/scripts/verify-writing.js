import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.cwd());
const failures = [];
const checked = {
  markdownFiles: 0,
  markdownLines: 0,
  workflowDisplayStrings: 0,
  exampleComments: 0,
  htmlTextLines: 0
};

const allowlist = [
  // Keep exceptions line-specific and explain why the preferred spelling is unsuitable.
];

const terminologyRules = [
  [/\bQR Model 2\b/gu, "QR Code Model 2"],
  [/\bQR Code model 2\b/gu, "QR Code Model 2"],
  [/\bQR code Model 2\b/gu, "QR Code Model 2"],
  [/\bstructured append\b|\bStructured append\b|\bSTRUCTURED APPEND\b/gu, "Structured Append"],
  [/\bGS1 digital link\b|\bGS1 Digital link\b|\bGS1 DIGITAL LINK\b/gu, "GS1 Digital Link"],
  [/\bNodeJS\b|\bNode JS\b|\bnode\.js\b/gu, "Node.js"],
  [/\bTypescript\b/gu, "TypeScript"],
  [/\bJavascript\b/gu, "JavaScript"],
  [/\bPlayWright\b/gu, "Playwright"],
  [/\bZXingJava\b|\bZXing java\b/gu, "ZXing Java"],
  [/\bGithub\b/gu, "GitHub"],
  [/\bMacOS\b|\bmacOS vision\b/gu, "macOS Vision"],
  [/\bNPM\b/gu, "npm"],
  [/\bRC1\b/gu, "RC 1"]
];

const markdownFiles = [
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "README.md",
  "SECURITY.md",
  ...await collectFiles("docs", (file) => file.endsWith(".md")),
  ...await collectFiles("examples", (file) => file.endsWith(".md")),
  ...await collectFiles("e2e", (file) => file.endsWith(".md"), {
    ignoredDirectories: new Set(["node_modules", "test-results", "playwright-report"])
  })
].sort();

for (const relativeFile of markdownFiles) {
  const source = await readFile(path.join(root, relativeFile), "utf8");
  checked.markdownFiles += 1;
  lintMarkdown(relativeFile, source);
}

for (const relativeFile of await collectFiles(
  ".github",
  (file) => file.endsWith(".yml") || file.endsWith(".yaml")
)) {
  const source = await readFile(path.join(root, relativeFile), "utf8");
  lintWorkflowDisplayText(relativeFile, source);
}

for (const relativeFile of await collectFiles(
  "examples",
  (file) => /\.(?:mjs|js|ts|html)$/u.test(file)
)) {
  const source = await readFile(path.join(root, relativeFile), "utf8");
  if (relativeFile.endsWith(".html")) {
    lintHtmlText(relativeFile, source);
  } else {
    lintLeadingComments(relativeFile, source);
  }
}

for (const relativeFile of ["playground/index.html"]) {
  const source = await readFile(path.join(root, relativeFile), "utf8");
  lintHtmlText(relativeFile, source);
}

await lintPackageMetadata();

assert.deepEqual(
  failures,
  [],
  `Writing style failures (${failures.length}):\n${failures.join("\n")}`
);

console.log(
  "ok writing style: "
    + `${checked.markdownFiles} Markdown files / ${checked.markdownLines} lines, `
    + `${checked.workflowDisplayStrings} workflow display strings, `
    + `${checked.exampleComments} example comments, `
    + `${checked.htmlTextLines} HTML text lines`
);

function lintMarkdown(relativeFile, source) {
  const lines = source.split(/\r?\n/u);
  let fence = null;
  let inHtmlComment = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/u);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (fence === null) {
        fence = marker;
      } else if (fence === marker) {
        fence = null;
      }
      continue;
    }
    if (fence !== null) {
      continue;
    }

    let prose = line;
    if (inHtmlComment) {
      const end = prose.indexOf("-->");
      if (end < 0) {
        continue;
      }
      prose = " ".repeat(end + 3) + prose.slice(end + 3);
      inHtmlComment = false;
    }
    const commentStart = prose.indexOf("<!--");
    if (commentStart >= 0) {
      const commentEnd = prose.indexOf("-->", commentStart + 4);
      if (commentEnd >= 0) {
        prose = maskRange(prose, commentStart, commentEnd + 3, " ");
      } else {
        prose = prose.slice(0, commentStart);
        inHtmlComment = true;
      }
    }

    checked.markdownLines += 1;
    lintProse(relativeFile, index + 1, prepareMarkdownProse(prose));
  }
}

function lintWorkflowDisplayText(relativeFile, source) {
  const lines = source.split(/\r?\n/u);
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(
      /^\s*(?:name|run-name|description):\s*(?![>|])(.+?)\s*$/u
    );
    if (!match) {
      continue;
    }
    checked.workflowDisplayStrings += 1;
    lintProse(relativeFile, index + 1, stripYamlQuotes(match[1]));
  }
}

function lintLeadingComments(relativeFile, source) {
  const lines = source.split(/\r?\n/u);
  let inBlock = false;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trimStart();
    let prose = null;
    if (inBlock) {
      prose = trimmed.replace(/^\*+\s?/u, "");
      if (trimmed.includes("*/")) {
        prose = prose.replace(/\*\/.*$/u, "");
        inBlock = false;
      }
    } else if (trimmed.startsWith("//")) {
      prose = trimmed.slice(2).trimStart();
    } else if (trimmed.startsWith("/*")) {
      prose = trimmed.slice(2);
      if (prose.includes("*/")) {
        prose = prose.replace(/\*\/.*$/u, "");
      } else {
        inBlock = true;
      }
    }
    if (prose === null || prose.length === 0) {
      continue;
    }
    checked.exampleComments += 1;
    lintProse(relativeFile, index + 1, prose);
  }
}

function lintHtmlText(relativeFile, source) {
  const lines = source.split(/\r?\n/u);
  let ignoredElement = null;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (ignoredElement !== null) {
      if (new RegExp(`</${ignoredElement}>`, "iu").test(line)) {
        ignoredElement = null;
      }
      continue;
    }
    const ignoredStart = line.match(/<(script|style)\b/iu);
    if (ignoredStart) {
      if (!new RegExp(`</${ignoredStart[1]}>`, "iu").test(line)) {
        ignoredElement = ignoredStart[1];
      }
      continue;
    }
    const prose = decodeBasicEntities(line.replace(/<[^>]*>/gu, " ")).trim();
    if (!prose) {
      continue;
    }
    checked.htmlTextLines += 1;
    lintProse(relativeFile, index + 1, prose);
  }
}

async function lintPackageMetadata() {
  const packageJson = JSON.parse(
    await readFile(path.join(root, "package.json"), "utf8")
  );
  if (
    packageJson.description
    !== "A dependency-free QR Code Model 2 generator for JavaScript."
  ) {
    failures.push(
      "package.json:1 [package-description] Keep the English discovery "
        + "description with the official QR Code Model 2 / JavaScript names."
    );
  }
  if (
    !Array.isArray(packageJson.keywords)
    || packageJson.keywords.some(
      (keyword) => typeof keyword !== "string"
        || !/^[a-z0-9-]+$/u.test(keyword)
    )
  ) {
    failures.push(
      "package.json:1 [package-keywords] Keywords must remain lowercase ASCII "
        + "discovery terms."
    );
  }
}

function lintProse(relativeFile, lineNumber, prose) {
  if (!prose || !hasJapanese(prose)) {
    lintTerminology(relativeFile, lineNumber, prose);
    lintNumberUnits(relativeFile, lineNumber, prose);
    return;
  }

  for (const [pattern, direction] of [
    [
      /([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])([A-Za-z])/gu,
      "Add a half-width space between Japanese and Latin text."
    ],
    [
      /([A-Za-z])([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])/gu,
      "Add a half-width space between Latin and Japanese text."
    ]
  ]) {
    for (const match of prose.matchAll(pattern)) {
      report(relativeFile, lineNumber, "ja-latin-spacing", match[0], direction);
    }
  }

  for (const match of prose.matchAll(
    /([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])(?!\d[\d,.]*(?:年|月|日|件|回|個|つ|人|本|枚|章|節|項|桁|文字))(\d[\d,.]*(?:\.\d+)?)/gu
  )) {
    report(
      relativeFile,
      lineNumber,
      "number-prose-spacing",
      match[0],
      "Add a half-width space before a standalone numeric token."
    );
  }

  for (const match of prose.matchAll(
    /(\d)(?=(?:では|で|に|を|へ|は|が|の|と|も|から|まで|向け|時点|対象|以上|以下|未満|超|以降|以前|として|だけ|ずつ))/gu
  )) {
    report(
      relativeFile,
      lineNumber,
      "number-prose-spacing",
      match[0],
      "Add a half-width space after a standalone numeric token."
    );
  }

  for (const [pattern, direction] of [
    [
      /((?:v\d+(?:\.\d+)*|\d+\.\d+(?:\.\d+)*(?:-[0-9A-Za-z.-]+)?))([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])/gu,
      "Add a half-width space after the version token."
    ],
    [
      /([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])((?:v\d+(?:\.\d+)*|\d+\.\d+(?:\.\d+)*(?:-[0-9A-Za-z.-]+)?))/gu,
      "Add a half-width space before the version token."
    ]
  ]) {
    for (const match of prose.matchAll(pattern)) {
      report(
        relativeFile,
        lineNumber,
        "ascii-token-spacing",
        match[0],
        direction
      );
    }
  }

  for (const match of prose.matchAll(
    /([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]),/gu
  )) {
    report(
      relativeFile,
      lineNumber,
      "japanese-punctuation",
      match[0],
      "Use Japanese punctuation `、` in Japanese prose."
    );
  }

  if (/[.]\s*$/u.test(prose) && hasJapanese(prose)) {
    report(
      relativeFile,
      lineNumber,
      "japanese-punctuation",
      prose.trim().slice(-24),
      "Use Japanese sentence punctuation `。` when the sentence is Japanese."
    );
  }

  lintTerminology(relativeFile, lineNumber, prose);
  lintNumberUnits(relativeFile, lineNumber, prose);
}

function lintTerminology(relativeFile, lineNumber, prose) {
  for (const [pattern, preferred] of terminologyRules) {
    for (const match of prose.matchAll(pattern)) {
      report(
        relativeFile,
        lineNumber,
        "terminology",
        match[0],
        `Use the official spelling \`${preferred}\`.`
      );
    }
  }
}

function lintNumberUnits(relativeFile, lineNumber, prose) {
  const unitPattern = /(?:\d|\d[\d,.]*\d)(?:(?:Ki|Mi|Gi|Ti)?B|kB|MB|GB|TB|bits?|bytes?|ms|dpi|ppi|px|pixels?|symbols?|fixtures?|cases?|files?|rows?|characters?|modules?|codewords?|°C)(?=$|[^A-Za-z])/gu;
  for (const match of prose.matchAll(unitPattern)) {
    report(
      relativeFile,
      lineNumber,
      "number-unit-spacing",
      match[0],
      "Add a half-width space between the number and Latin unit."
    );
  }
}

function report(relativeFile, lineNumber, rule, fragment, message) {
  const normalizedFragment = fragment.replace(/\s+/gu, " ").trim();
  const candidate = {
    file: relativeFile,
    line: lineNumber,
    rule,
    fragment: normalizedFragment
  };
  if (isAllowed(candidate)) {
    return;
  }
  failures.push(
    `${relativeFile}:${lineNumber} [${rule}] ${message} `
      + `Found: ${JSON.stringify(normalizedFragment)}`
  );
}

function isAllowed(candidate) {
  return allowlist.some(
    (entry) => entry.file === candidate.file
      && entry.line === candidate.line
      && entry.rule === candidate.rule
      && entry.fragment === candidate.fragment
  );
}

function prepareMarkdownProse(line) {
  let result = line;
  result = maskPattern(
    result,
    /(!?\[)([^\]\n]*)(\]\()([^)\n]*)(\))/gu,
    (match) => " ".repeat(match[1].length)
      + match[2]
      + " ".repeat(match[3].length + match[4].length + match[5].length)
  );
  result = maskPattern(
    result,
    /(`+)([^`\n]*?)\1/gu,
    (match) => "A".repeat(match[0].length)
  );
  result = maskPattern(
    result,
    /https?:\/\/[^\s<>)\]}]+/gu,
    (match) => "U".repeat(match[0].length)
  );
  result = maskPattern(
    result,
    /<[^>\n]+>/gu,
    (match) => " ".repeat(match[0].length)
  );
  return result;
}

function maskPattern(source, pattern, replacement) {
  return source.replace(pattern, (...args) => {
    const match = {
      0: args[0],
      1: args[1],
      2: args[2],
      3: args[3],
      4: args[4],
      5: args[5]
    };
    return replacement(match);
  });
}

function maskRange(source, start, end, character) {
  return source.slice(0, start)
    + character.repeat(end - start)
    + source.slice(end);
}

function hasJapanese(source) {
  return /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(source);
}

function stripYamlQuotes(source) {
  if (
    (source.startsWith("\"") && source.endsWith("\""))
    || (source.startsWith("'") && source.endsWith("'"))
  ) {
    return source.slice(1, -1);
  }
  return source;
}

function decodeBasicEntities(source) {
  return source
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'");
}

async function collectFiles(directory, predicate, options = {}) {
  const absoluteDirectory = path.join(root, directory);
  const ignoredDirectories = options.ignoredDirectories ?? new Set();
  const result = [];
  for (const entry of await readdir(absoluteDirectory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
      continue;
    }
    const absolutePath = path.join(absoluteDirectory, entry.name);
    const relativePath = path.relative(root, absolutePath);
    if (entry.isDirectory()) {
      result.push(
        ...await collectFiles(relativePath, predicate, options)
      );
    } else if (entry.isFile() && predicate(relativePath)) {
      result.push(relativePath);
    }
  }
  return result.sort();
}
