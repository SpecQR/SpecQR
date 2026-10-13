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
  const htmlState = { comment: false, element: null };
  let inIndentedCode = false;
  let inList = false;
  let quoteDepth = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const quoteMarkers = lines[index].match(/^(?: {0,3}>[ \t]?)+/u)?.[0].match(/ {0,3}>[ \t]?/gu) ?? [];
    const inProtectedBlock = fence !== null || htmlState.comment || htmlState.element !== null || htmlState.tag;
    const quotePrefix = (inProtectedBlock ? quoteMarkers.slice(0, quoteDepth) : quoteMarkers).join("");
    const currentQuoteDepth = [...quotePrefix].filter((character) => character === ">").length;
    const line = lines[index].slice(quotePrefix.length);
    if ((line.trim() !== "" || currentQuoteDepth > 0) && currentQuoteDepth !== quoteDepth) {
      // A quote container cannot leave fence or raw HTML state in its parent.
      fence = null;
      htmlState.comment = false;
      htmlState.element = null;
      htmlState.tag = null;
      inIndentedCode = false;
      inList = false;
      quoteDepth = currentQuoteDepth;
    }
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/u);
    if (fence !== null) {
      if (fenceMatch
        && fence[0] === fenceMatch[1][0]
        && fenceMatch[1].length >= fence.length
        && line.slice(fenceMatch[0].length).trim() === ""
      ) {
        fence = null;
      }
      continue;
    }
    if (!htmlState.comment && htmlState.element === null && !htmlState.tag) {
      if (fenceMatch) {
        fence = fenceMatch[1];
        continue;
      }
      // Recognize top-level indented blocks; nested list syntax needs review.
      if (/^ {0,3}(?:[-+*]|\d+[.)])\s/u.test(line)) {
        inList = true;
      } else if (/^\S/u.test(line)) {
        inList = false;
      }
      if (/^(?: {4}|\t)/u.test(line) && !inList
        && (inIndentedCode || index === 0 || lines[index - 1].trim() === "")) {
        inIndentedCode = true;
        continue;
      }
      if (line.trim() !== "") {
        inIndentedCode = false;
      }
    }

    const prose = maskHtmlProtected(line, htmlState, true);
    checked.markdownLines += 1;
    lintProse(relativeFile, index + 1, prepareMarkdownProse(prose));
  }
}

function maskHtmlProtected(source, state, markdown = false) {
  let result = "";
  let rest = state.tag ? state.tag + "\n" + source : source;
  state.tag = null;
  while (rest !== "") {
    if (state.comment || state.element !== null) {
      const closing = state.comment ? /-->/u : new RegExp(`</${state.element}\\s*>`, "iu");
      const match = closing.exec(rest);
      if (state.element === "code") {
        result += "A";
      }
      if (!match) {
        return result;
      }
      rest = rest.slice(match.index + match[0].length);
      state.comment = false;
      state.element = null;
      continue;
    }
    const match = /<!--|<\/?[A-Za-z][A-Za-z0-9:-]*(?=\s|\/?>|$)/iu.exec(rest);
    const code = markdown ? /(?<!`)(`+)(?!`)[^\n]*?(?<!`)\1(?!`)/u.exec(rest) : null;
    if (code && (!match || code.index < match.index)) {
      result += rest.slice(0, code.index) + "A".repeat(code[0].length);
      rest = rest.slice(code.index + code[0].length);
      continue;
    }
    if (!match) {
      return result + rest;
    }
    result += rest.slice(0, match.index);
    rest = rest.slice(match.index);
    state.comment = match[0] === "<!--";
    if (state.comment) {
      rest = rest.slice(4);
      continue;
    }
    const end = htmlTagEnd(rest);
    if (end < 0) {
      state.tag = rest;
      return result;
    }
    const tag = rest.slice(0, end + 1);
    rest = rest.slice(end + 1);
    const protectedElement = tag.match(/^<(script|style|pre|code)\b/iu);
    if (!protectedElement) {
      result += tag;
      continue;
    }
    state.element = protectedElement[1].toLowerCase();
    // A block element separates its surrounding prose; inline code does not.
    if (!state.comment && state.element !== "code") {
      result += " ";
    }
  }
  return result;
}

function htmlTagEnd(source) {
  let quote = null;
  for (let index = 1; index < source.length; index += 1) {
    const character = source[index];
    if (quote !== null) {
      if (character === quote) {
        quote = null;
      }
    } else if (character === "\"" || character === "'") {
      quote = character;
    } else if (character === ">") {
      return index;
    }
  }
  return -1;
}

function lintWorkflowDisplayText(relativeFile, source) {
  const lines = source.split(/\r?\n/u);
  for (let index = 0; index < lines.length; index += 1) {
    // Nested names can be artifact/environment identifiers or required checks.
    // Review those fields in context; only unambiguous root metadata is linted.
    const match = lines[index].match(
      /^(?:name|run-name|description):\s*(?![>|])(.+?)\s*$/u
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
  const htmlState = { comment: false, element: null };
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const prose = prepareHtmlProse(maskHtmlProtected(line, htmlState)).trim();
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
      /([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])([^\S\r\n]*)(?=([A-Za-z]))/gu,
      "Add a half-width space between Japanese and Latin text."
    ],
    [
      /([A-Za-z])([^\S\r\n]*)(?=([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]))/gu,
      "Add a half-width space between Latin and Japanese text."
    ]
  ]) {
    for (const match of prose.matchAll(pattern)) {
      if (match[2] === " ") {
        continue;
      }
      report(relativeFile, lineNumber, "ja-latin-spacing", match[0] + match[3], direction);
    }
  }

  for (const match of prose.matchAll(
    /([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])([^\S\r\n]*)(?=(\d[\d,.]*))/gu
  )) {
    if (match[2] === " ") {
      continue;
    }
    report(
      relativeFile,
      lineNumber,
      "number-prose-spacing",
      match[0] + match[3],
      "Add a half-width space before a standalone numeric token."
    );
  }

  for (const match of prose.matchAll(
    /(\d)([^\S\r\n]*)(?=([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]))/gu
  )) {
    if (match[2] === " ") {
      continue;
    }
    report(
      relativeFile,
      lineNumber,
      "number-prose-spacing",
      match[0] + match[3],
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
  const unitPattern = /(?<![A-Za-z0-9_.])(?:\d|\d[\d,.]*\d)([^\S\r\n]*)(?:(?:Ki|Mi|Gi|Ti)?B|kB|MB|GB|TB|[GM]bps|MB\/s|bits?|bytes?|ms|mm|g|W|Hz|dpi|ppi|px|pixels?|symbols?|fixtures?|cases?|files?|rows?|characters?|modules?|codewords?|°C)(?=$|[^A-Za-z])/gu;
  for (const match of prose.matchAll(unitPattern)) {
    if (match[1] === " ") {
      continue;
    }
    report(
      relativeFile,
      lineNumber,
      "number-unit-spacing",
      match[0],
      "Add a half-width space between the number and Latin unit."
    );
  }
  for (const pattern of [
    /\d([^\S\r\n]*)%/gu,
    /%([^\S\r\n]*)(?=([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]))/gu
  ]) {
    for (const match of prose.matchAll(pattern)) {
      if (match[1] !== " ") {
        report(
          relativeFile,
          lineNumber,
          "number-unit-spacing",
          match[0] + (match[2] ?? ""),
          "Use one half-width space at the percentage boundary."
        );
      }
    }
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

// Exported only for the repository's checker tests, not from the npm package.
export function isAllowed(candidate, entries = allowlist) {
  return entries.some(
    (entry) => typeof entry.reason === "string" && entry.reason.trim() !== ""
      && entry.file === candidate.file
      && entry.line === candidate.line
      && entry.rule === candidate.rule
      && entry.fragment === candidate.fragment
  );
}

function maskInlineCode(source) {
  // Mask code before processing link/HTML syntax that may occur inside it.
  return maskPattern(
    source,
    /(?<!`)(`+)(?!`)[^\n]*?(?<!`)\1(?!`)/gu,
    (match) => "A".repeat(match[0].length)
  );
}

function prepareMarkdownProse(line) {
  let result = maskInlineCode(line);
  result = maskPattern(
    result,
    /(!?\[)([^\]\n]*)(\]\()([^)\n]*)(\))/gu,
    (match) => match[2]
  );
  result = maskPattern(
    result,
    /<(?:code|pre)\b[^>]*>.*?<\/(?:code|pre)>/giu,
    (match) => "A".repeat(match[0].length)
  );
  result = maskPattern(
    result,
    /<https?:\/\/[^>]+>|<[\w.+-]+@[\w.-]+>/gu,
    (match) => "U".repeat(match[0].length)
  );
  result = maskPattern(result, /(?<!\\)\$[^$\n]+\$/gu, (match) => "A".repeat(match[0].length));
  result = prepareHtmlProse(result);
  return result.replace(/(\*{1,3}|_{1,3}|~~)(\S(?:.*?\S)?)\1/gu, "$2");
}

function prepareHtmlProse(line) {
  let result = line;
  result = maskPattern(
    result,
    /https?:\/\/[^\s<>)\]}]+/gu,
    (match) => "U".repeat(match[0].length)
  );
  // These bounded forms are protected tokens, not prose unit declarations.
  for (const pattern of [
    /[\p{L}\p{N}.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/gu,
    /(?:[A-Za-z]:[\\/]|\.{1,2}[\\/])[A-Za-z0-9_./\\%~+-]+|[\w.-]+(?:[\\/][\w.%-]+)+\.[A-Za-z0-9]+/gu,
    /\b[\w%-]*\d[\w%-]*\.(?:md|pdf|txt|json|ya?ml|[cm]?js|ts|html|csv|svg|png)\b/gu
  ]) {
    result = maskPattern(result, pattern, (match) => "A".repeat(match[0].length));
  }
  // Formatting syntax does not create visible spaces around its text.
  result = result.replace(/<\/?(?:a|b|del|em|i|ins|mark|s|small|span|strong|sub|sup|u)\b(?:[^<>"']|"[^"]*"|'[^']*')*>/giu, "");
  result = result.replace(/<(?:[^<>"']|"[^"]*"|'[^']*')*>/gu, " ");
  return decodeBasicEntities(result);
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
    const relativePath = path.relative(root, absolutePath).split(path.sep).join("/");
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
