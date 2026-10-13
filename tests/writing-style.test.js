import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

const checker = fileURLToPath(new URL("../.github/scripts/verify-writing.js", import.meta.url));

async function fixture(t, files = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), "specqr-writing-"));
  t.after(async () => {
    assert.equal(path.dirname(directory), path.resolve(tmpdir()));
    assert.ok(path.basename(directory).startsWith("specqr-writing-"));
    await rm(directory, { recursive: true, force: true });
  });
  const contents = {
    "README.md": "# SpecQR\n\nA QR Code Model 2 generator.\n",
    "CHANGELOG.md": "",
    "CONTRIBUTING.md": "",
    "SECURITY.md": "",
    "docs/fixture.md": "",
    "examples/fixture.md": "",
    "e2e/fixture.md": "",
    ".github/workflows/fixture.yml": "name: Writing style\n",
    "playground/index.html": "",
    "package.json": JSON.stringify({
      description: "A dependency-free QR Code Model 2 generator for JavaScript.",
      keywords: ["qr", "qrcode"]
    }),
    ...files
  };
  for (const [relativeFile, content] of Object.entries(contents)) {
    const file = path.join(directory, relativeFile);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content);
  }
  return {
    directory,
    run(args = [checker]) {
      const result = spawnSync(process.execPath, args, {
        cwd: directory,
        encoding: "utf8",
        timeout: 15_000
      });
      assert.ifError(result.error);
      return result;
    },
    async assertUnchanged() {
      for (const [relativeFile, content] of Object.entries(contents)) {
        assert.deepEqual(await readFile(path.join(directory, relativeFile)), Buffer.from(content));
      }
    }
  };
}

test("writing checker accepts integrated spacing without splitting fixed tokens", async (t) => {
  const valid = [
    "SpecQR を使い、API の検証を Node.js で実行する。",
    "失敗が 0 回あり、総数と 4,304 件を確認する。",
    "2 種類、最大 5 時間、第 2 世代、10,000 円。",
    "2026 年 10 月 12 日、更新日 2026-10-06 です。",
    "4.3 g、30 W、30.2 mm、120 Hz、32 MiB、250 ms、600 dpi。",
    "256 GB の SSD、最大 10 Gbps、95 % の結果、約 50 %。",
    "25 °C、90°、30′、15″。",
    "版は 3.0.0-rc.1、時刻は 7:30、比率は 3:2、範囲は 1-40。",
    "M1 搭載、4K の映像、USB-C、iPhone 16e、C++17、macOS。",
    "日本語 **API** を使い、[API](api.md) を確認する。",
    "<strong>Mac</strong> の設定を確認する。",
    "「Mac」を使い、Mac（税込）と記載する。"
  ].join("\n");
  const repo = await fixture(t, { "docs/fixture.md": valid });
  const first = repo.run();
  assert.equal(first.status, 0, first.stderr);
  const second = repo.run();
  assert.equal(second.status, 0, second.stderr);
  assert.equal(second.stdout, first.stdout);
  await repo.assertUnchanged();
});

test("writing checker rejects missing, duplicate and non-U+0020 spaces", async (t) => {
  const cases = [
    ["APIを使う。", "ja-latin-spacing", 1],
    ["日本語API", "ja-latin-spacing", 1],
    ["日本語  API", "ja-latin-spacing", 1],
    ["日本語\u3000API", "ja-latin-spacing", 1],
    ["API\u00a0を使う。", "ja-latin-spacing", 1],
    ["API\tを使う。", "ja-latin-spacing", 1],
    ["失敗が0回ある。", "number-prose-spacing", 2],
    ["総数と4,304件を確認する。", "number-prose-spacing", 2],
    ["2026年7月31日", "number-prose-spacing", 5],
    ["金額は1,000円", "number-prose-spacing", 2],
    ["2\u202f種類", "number-prose-spacing", 1],
    ["第  2 世代", "number-prose-spacing", 1],
    ["95%", "number-unit-spacing", 1],
    ["95 %の結果", "number-unit-spacing", 1],
    ["95\u00a0%", "number-unit-spacing", 1],
    ["32MiB", "number-unit-spacing", 1],
    ["250  ms", "number-unit-spacing", 1],
    ["25°C", "number-unit-spacing", 1],
    ["30.2mm", "number-unit-spacing", 1],
    ["10Gbps", "number-unit-spacing", 1],
    ["日本語**API**を使う。", "ja-latin-spacing", 2],
    ["日本語[API](https://example.test/95%)を使う。", "ja-latin-spacing", 2],
    ["<strong>Mac</strong>の設定", "ja-latin-spacing", 1],
    ["`95%`の結果", "ja-latin-spacing", 1]
  ];
  const repo = await fixture(t, {
    "docs/fixture.md": cases.map(([prose]) => prose).join("\n")
  });
  const first = repo.run();
  assert.equal(first.status, 1);
  const diagnostics = first.stderr.split(/\r?\n/u)
    .filter((line) => line.startsWith("docs/fixture.md:"));
  assert.equal(diagnostics.length, cases.reduce((sum, item) => sum + item[2], 0));
  for (let index = 0; index < cases.length; index += 1) {
    const [, rule, count] = cases[index];
    assert.equal(
      diagnostics.filter((line) => line.startsWith(`docs/fixture.md:${index + 1} [${rule}]`)).length,
      count,
      cases[index][0]
    );
  }
  const second = repo.run();
  assert.equal(second.status, first.status);
  assert.equal(second.stderr, first.stderr);
  await repo.assertUnchanged();
});

test("writing checker preserves code, destinations, machine values and recorded originals", async (t) => {
  const prose = [
    "内部は `APIを使う 95% 2026年 /tmp/10件 a95%@example.test` のまま。",
    "内部は ``code `95%` 10件`` のまま。",
    "ファイルは docs/30W.md、30W.pdf、./30W.txt を参照する。",
    "連絡先は a_10件@example.test です。",
    "数式は $95%$ のまま。",
    "````text",
    "```js",
    "throw new Error('APIを使う 95%');",
    "```",
    "引用・旧ログ: 2026年7月31日 10件",
    "式: x=95%",
    "````",
    "",
    "    APIを使う 95%",
    "    2026年7月31日",
    "",
    "<pre>",
    "APIを使う 95%",
    "</pre>",
    "<code>",
    "APIを使う 95%",
    "</code>",
    "[API](https://example.test/95%/10件) を確認する。",
    "https://example.test/95%/10件",
    "<!-- APIを使う 95% -->",
    "説明は **API** を使う。"
  ].join("\n");
  const repo = await fixture(t, {
    "docs/fixture.md": prose,
    "LICENSE": "原文 APIを使う 95%\n",
    "examples/fixture.js": "throw new Error('APIを使う 95%');\n",
    "playground/index.html": [
      "<script>const error = 'APIを使う 95%';</script>",
      "<style>.API{width:95%}</style>",
      "<pre>",
      "実行ログ: APIを使う 95%",
      "</pre>",
      "<p><code>APIを使う 95%</code> を確認する。</p>",
      "<p><a href='https://example.test/95%'>API</a> を確認する。</p>"
    ].join("\n"),
    ".github/workflows/fixture.yml": [
      "name: API の検査",
      "jobs:",
      "  check:",
      "    name: API検査95%",
      "    environment:",
      "      name: API環境95%",
      "    steps:",
      "      - uses: actions/upload-artifact@v4",
      "        with:",
      "          name: API成果物95%",
      "      - run: |",
      "          name: API固定値95%"
    ].join("\n")
  });
  const result = repo.run();
  assert.equal(result.status, 0, result.stderr);
  await repo.assertUnchanged();
});

test("protected fragments do not hide adjacent prose or root display metadata", async (t) => {
  const repo = await fixture(t, {
    "docs/fixture.md": [
      "`APIを使う 95%` の説明は**API**を使う。",
      "````text",
      "<pre>",
      "```",
      "95%",
      "````",
      "95%"
    ].join("\n"),
    ".github/workflows/fixture.yml": "name: API検査\n",
    "playground/index.html": "<p><code>95%</code> の結果は<strong>API</strong>を使う。</p>\n"
  });
  const result = repo.run();
  assert.equal(result.status, 1);
  for (const file of ["docs/fixture.md", ".github/workflows/fixture.yml", "playground/index.html"]) {
    assert.ok(result.stderr.includes(`${file}:1 [ja-latin-spacing]`), file);
  }
  assert.ok(result.stderr.includes("docs/fixture.md:7 [number-unit-spacing]"));
  await repo.assertUnchanged();
});

test("writing exceptions require an exact location, rule, fragment and reason", async (t) => {
  const repo = await fixture(t);
  const script = `
    import assert from 'node:assert/strict';
    import { isAllowed } from ${JSON.stringify(pathToFileURL(checker).href)};
    const candidate = { file: 'docs/rules.md', line: 8, rule: 'number-unit-spacing', fragment: '95%' };
    const entry = { ...candidate, reason: 'Original spelling in the before column.' };
    assert.equal(isAllowed(candidate, [entry]), true);
    for (const changed of [
      { file: 'README.md' }, { line: 9 }, { rule: 'terminology' }, { fragment: '50%' }
    ]) assert.equal(isAllowed({ ...candidate, ...changed }, [entry]), false);
    for (const reason of [undefined, '', '  '])
      assert.equal(isAllowed(candidate, [{ ...entry, reason }]), false);
  `;
  const result = repo.run(["--input-type=module", "-e", script]);
  assert.equal(result.status, 0, result.stderr);
  await repo.assertUnchanged();
});

test("comments, HTML blocks and paths preserve only their own protected content", async (t) => {
  const cases = [
    ["<!--\n<pre>\n-->\n95%", [[4, "number-unit-spacing", 1]]],
    ["<!--\n<script>\n-->\n95%", [[4, "number-unit-spacing", 1]]],
    ["<!--\n```\n-->\n95%", [[4, "number-unit-spacing", 1]]],
    ["<pre>\n95%\n</pre>日本語API。失敗が0回。", [
      [3, "ja-latin-spacing", 1], [3, "number-prose-spacing", 2]
    ]],
    ["参照は ./30W.txt。失敗が0回です。", [[1, "number-prose-spacing", 2]]],
    ["./README.md。日本語API。失敗が0回。95%", [
      [1, "ja-latin-spacing", 1], [1, "number-prose-spacing", 2], [1, "number-unit-spacing", 1]
    ]],
    ["./README.mdを使う。\n./README.md を使う。", [[1, "ja-latin-spacing", 1]]],
    ["- 例\n\n    ```js\n    APIを使う 95%\n    ```\n\n日本語API。", [
      [7, "ja-latin-spacing", 1]
    ]],
    ["<!--\n<pre>\n```\n-->\n95 %\n<pre>\n95%\n</pre>日本語 API。失敗が 0 回。", []]
  ];
  const files = {};
  for (let index = 0; index < cases.length; index += 1) {
    files[`docs/regression-${index}.md`] = cases[index][0];
  }
  files["playground/index.html"] = [
    "<!--", "<pre>", "-->",
    "95%",
    "<pre>", "95%", "</pre>日本語API。失敗が0回。"
  ].join("\n");
  const repo = await fixture(t, files);
  const result = repo.run();
  assert.equal(result.status, 1);
  const diagnostics = result.stderr.split(/\r?\n/u)
    .filter((line) => /^(?:docs\/regression-\d+\.md|playground\/index\.html):/u.test(line));
  for (let index = 0; index < cases.length; index += 1) {
    const expected = cases[index][1];
    const actual = diagnostics.filter((line) => line.startsWith(`docs/regression-${index}.md:`));
    assert.equal(actual.length, expected.reduce((sum, item) => sum + item[2], 0), cases[index][0]);
    for (const [line, rule, count] of expected) {
      assert.equal(
        actual.filter((item) => item.startsWith(`docs/regression-${index}.md:${line} [${rule}]`)).length,
        count,
        cases[index][0]
      );
    }
  }
  const html = diagnostics.filter((line) => line.startsWith("playground/index.html:"));
  assert.equal(html.length, 4);
  assert.ok(html.some((line) => line.startsWith("playground/index.html:4 [number-unit-spacing]")));
  assert.equal(html.filter((line) => line.startsWith("playground/index.html:7 ")).length, 3);
  await repo.assertUnchanged();
});

test("Markdown containers and raw HTML return to their own prose grammar", async (t) => {
  const bad = "日本語API。失敗が0回。95%";
  const four = (line) => [[line, "ja-latin-spacing", 1], [line, "number-prose-spacing", 2], [line, "number-unit-spacing", 1]];
  const two = (line) => [[line, "ja-latin-spacing", 1], [line, "number-unit-spacing", 1]];
  const cases = [
    ["md", "> ```html\n> <pre>\n> ```\n\n" + bad, four(5)],
    ["md", "> ```html\n> APIを使う 95%\n\n" + bad, four(4)],
    ["md", "> <pre>\n> APIを使う 95%\n\n" + bad, four(4)],
    ["md", "<!--\n`-->`\nAPIを使う 95%", two(3)],
    ["md", "<code>\n</code> の説明は `<pre>`。\nAPIを使う 95%", two(3)],
    ["md", "日本語API。失敗が0回。a@example.test", [
      [1, "ja-latin-spacing", 1], [1, "number-prose-spacing", 2]
    ]],
    ["html", "<p>`APIを使う 95%`</p>", two(1)],
    ["html", "<p>[表示](APIを使う 95%)</p>", two(1)],
    ["html", "<p>$95%$</p>", [[1, "number-unit-spacing", 1]]],
    ["md", "> ```html\n> <pre>\n> APIを使う 95%\n> ```\n\nAPI を使う 95 %", []],
    ["md", "```text\n> APIを使う 95%\n```\n" + bad, four(4)],
    ["md", "<pre>\n> APIを使う 95%\n</pre>\n" + bad, four(4)],
    ["md", "<pre\n>\nAPIを使う 95%\n</pre>\n" + bad, four(5)],
    ["md", "> ```text\n> > APIを使う 95%\n> ```\n\n" + bad, four(5)],
    ["md", "内部は `APIを使う 95% <pre> <!--` のまま。", []],
    ["md", "<code>\n`APIを使う 95%`\n</code>\nAPI を使う 95 %", []],
    ["html", "<p><code>`APIを使う 95%`</code></p>\n<p>`API を使う 95 %`</p>", []],
    ["md", "連絡先は a_95%@example.test と a_10件@example.test です。", []],
    ["md", "連絡先は `利用者@例え.テスト` です。", []]
  ];
  for (const element of ["code", "pre", "script", "style"]) {
    cases.push(["md", `<${element}>\n\`</${element}>\`\nAPIを使う 95%`, two(3)]);
  }
  for (const grammar of ["md", "html"]) {
    cases.push([grammar, '<span title="<code>">日本語API。95%</span>\n<p>失敗が0回。</p>', [
      [1, "ja-latin-spacing", 1], [1, "number-unit-spacing", 1], [2, "number-prose-spacing", 2]
    ]]);
    cases.push([grammar, '<pre\n class="sample">\nAPIを使う 95%\n</pre>\n<p>' + bad + '</p>', four(5)]);
    cases.push([grammar, '<pre\n class="sample">\nAPIを使う 95%\n</pre>\n<p>API を使う 95 %</p>', []]);
  }
  const files = {};
  for (let index = 0; index < cases.length; index += 1) {
    const [grammar, source] = cases[index];
    files[`${grammar === "md" ? "docs" : "examples"}/grammar-${index}.${grammar}`] = source;
  }
  const repo = await fixture(t, files);
  const result = repo.run();
  assert.equal(result.status, 1);
  const diagnostics = result.stderr.split(/\r?\n/u)
    .filter((line) => /^(?:docs|examples)\/grammar-\d+\.(?:md|html):/u.test(line));
  for (let index = 0; index < cases.length; index += 1) {
    const [grammar, source, expected] = cases[index];
    const file = `${grammar === "md" ? "docs" : "examples"}/grammar-${index}.${grammar}`;
    const actual = diagnostics.filter((line) => line.startsWith(`${file}:`));
    assert.equal(actual.length, expected.reduce((sum, entry) => sum + entry[2], 0), source);
    for (const [line, rule, count] of expected) {
      assert.equal(actual.filter((entry) => entry.startsWith(`${file}:${line} [${rule}]`)).length, count, source);
    }
  }
  await repo.assertUnchanged();
});
