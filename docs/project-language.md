# Project Language and Writing Style

この文書は、SpecQR の公開文書、開発記録、GitHub 上の表示テキストに適用する
言語・表記方針の source of truth です。

SpecQR は日本語を中心に設計、実装、検証の意思決定を残します。一方で、npm /
GitHub での発見性、API の検索性、海外利用者向けの最小限の導線は英語で維持します。

この方針は prose の表記だけを対象とします。runtime behavior、public API、型、
package version、package exports、error / warning message、QR output bytes は変更しません。

## 適用範囲

次の文章と表示テキストに適用します。

- `README.md`、`CHANGELOG.md`、`CONTRIBUTING.md`、`SECURITY.md`
- `docs/**/*.md` と GitHub Release notes
- GitHub workflow、issue template、pull request template の表示名・説明
- examples と Playground の利用者向け prose、comment、label
- commit message、PR-style summary、Codex final report

code fence、inline code の内部、URL、file path、shell command、JSON、regular
expression、version string、Git hash、package spec、生成物の byte sequence は
書き換えません。識別子の外側にある日本語との境界は、この文書の spacing rule に
従います。

## Default Language

公開文書と開発記録は日本語を中心にします。

技術識別子は無理に訳しません。API 名、option 名、type 名、error class 名、
script 名、file path、package 名、standard / decoder 名は英語のまま使います。

## English That Should Remain

次の英語は維持します。

- `package.json` の `description`
- `package.json` の `keywords`
- npm 検索向けの short summary
- README 冒頭の短い English summary
- badges
- install command と code example
- API 名、option 名、type 名、error class 名
- decoder、library、standard の正式名称

README の冒頭に English summary を置く理由は、npm / GitHub で最初に表示された
ときに、非日本語話者にも package の用途が伝わるようにするためです。詳細な設計意図、
検証範囲、release notes は日本語を中心にします。

## Japanese and Latin Spacing

日本語の本文では、日本語と Latin 文字、英単語、ASCII 識別子、inline code の
間に半角スペースを入れます。

推奨:

- `API を使う`
- `Node.js で実行する`
- `SpecQR は ESM-first です`
- `` `splitUnits` を返す ``
- `` `diagnostics: true` の場合 ``
- `ZXing Java で decode する`

避けるもの:

```text
APIを使う
Node.jsで実行する
SpecQRはESM-firstです
`splitUnits`を返す
```

日本語と Latin text が Markdown marker を挟む場合も、表示上の境界に半角スペースを
入れます。句読点や括弧が間にある場合は、それらの直前・直後へ追加のスペースを
置きません。

```text
API、型、runtime behavior を確認します。
SpecQR（以下「library」）を検証します。
```

## Numbers and Units

数値と Latin unit symbol または英語の unit word の間には、半角スペースを入れます。

```text
32 MiB
250 ms
600 dpi
150,000 bytes
44 symbols
10 fixtures
303,140 bytes
```

SI / IEC unit は symbol の capitalization を維持します。`kB` と `KiB`、`MB` と
`MiB` は意味が異なるため、意図した単位を選びます。

独立した数値 token と日本語助詞の間にも半角スペースを入れます。

```text
Version 40 では
RC 1 の候補
32 MiB を上限にする
```

次は数値の内部、または日本語表記としてスペースを入れません。

- version: `3.0.0-rc.1`
- date: `2026-07-31`
- ratio: `3:2`
- range: `1-40`
- URL / path / command / hash / package spec
- 日本語の助数詞・年月日: `10件`、`3回`、`2026年7月31日`
- percent: `95%`
- 角度: `90°`

温度は SI の表記に合わせて `25 °C` とします。`%` と平面角の `°` は数値へ
密着させますが、`°C` は unit として数値との間にスペースを置きます。

## Punctuation

日本語 prose は原則として `、。` を使います。英語 sentence は `,` と `.` を
使います。

Markdown table、code、JSON、引用した外部名称、English summary は元の言語に
対応する punctuation を維持します。日本語 sentence の末尾を editorial 理由だけで
`.` にしません。

## Official Names and Terminology

次の spelling と capitalization を使います。

- `SpecQR`
- `QR Code Model 2`
- `Structured Append`
- `GS1 Digital Link`
- `Node.js`
- `TypeScript`
- `JavaScript`
- `Playwright`
- `ZXing Java`
- `GitHub`
- `GitHub Actions`
- `npm`
- `ECMAScript modules` または `ESM`
- `macOS Vision`

API 名、option 名、class 名は実装どおりの spelling を維持し、prose 上の都合で
大文字・小文字を変えません。

## Release Vocabulary

- `stable`: npm の `latest` が指す正式版。
- `release candidate` / `RC`: stable 公開前の候補版。
- `latest`: stable 用の npm dist-tag。
- `next`: RC 用の npm dist-tag。
- `unreleased` / `未公開`: npm registry へまだ publish していない状態。
- `published` / `公開済み`: exact version が npm registry から取得できる状態。

未公開の RC について、`next` がすでにその version を指すとは書きません。
Conformance Lab など別 repository の検証対象 version は、実際に検証された
published version と一致する場合だけ release evidence として扱います。

## Commit Messages

commit message は日本語を中心にして構いません。検索性や GitHub UI での分類に
役立つ場合だけ、短い conventional prefix を使います。

推奨例:

```text
Structured Append の検証方針を整理
docs: Structured Append の検証方針を整理
GS1 Digital Link の canonical 方針を文書化
test: GS1 raw parser の packed smoke を追加
```

避けるもの:

- 意味の薄い英語だけの message。
- 実装内容と異なる conventional prefix。
- release notes に転記したとき、内容が分からない短すぎる message。

`docs:`、`test:`、`fix:` などの英語 prefix は必須ではありません。

## Release Notes

GitHub Release notes と `CHANGELOG.md` は日本語を中心にします。ただし、version /
tag、install command、API 名、script 名、file path、package metadata、外部
decoder / reference implementation 名は英語のまま残します。

release notes は、利用者が次をすぐ確認できる構成にします。

- 何が変わったか。
- breaking change と migration。
- 何をまだ期待してはいけないか。
- どの artifact を、どの gate で検証したか。
- rollback 条件。

## PR-Style Summaries and Final Reports

PR-style summary と Codex final report は日本語を中心にします。

推奨構成:

- 変更内容
- 検証
- 変更しなかったこと
- 残リスク
- 次に進むべき `/goal`

英語の API 名や source citation はそのまま残します。

## Documentation Structure

- code block は英語識別子をそのまま使います。
- section heading は日本語でも英語でも構いませんが、文書内で粒度を揃えます。
- API shape や return shape は TypeScript 風の表記で固定します。
- `supported`、`partial`、`not supported` などの status label は、既存 matrix と
  揃えるため英語を許容します。
- specification、decoder、package 名は正式名称を優先します。
- Markdown link text は、リンク先を開かなくても対象が分かる名称にします。

## Automated Verification

`npm run verify:writing` は、公開 prose のうち機械的に曖昧なく判定できる項目だけを
検査します。

検査実装は repository 専用の `.github/scripts/verify-writing.js` に置き、npm
tarball へ含めません。公開 tarball の prose は pack 前にこの gate を通し、
canonical content manifest で固定します。

- 日本語と Latin 文字・inline code の不自然な密着。
- 既知の unit list に対する数値とのスペース欠落。
- 明確な製品名・技術名の表記揺れ。
- 日本語 sentence 末尾の一部の ASCII punctuation。

code fence、inline code の内部、URL destination、path、command、JSON などは
検査対象から除外します。例外は file / line / rule / fragment を指定した狭い
allowlist とし、理由を source に記録します。file 全体の除外や broad ignore は
使いません。

自動検査で意味を判断できない文章、workflow 表示名、package metadata、examples /
Playground の UI text は、release freeze 時に人が確認します。

## npm / GitHub Discovery

npm と GitHub の一覧で見える短い情報は英語を中心にします。

- `package.json` の `description` は英語。
- `package.json` の `keywords` は英語中心。
- README 冒頭の English summary は維持。
- README の詳細本文は日本語を中心にする。

これにより、日本語で意思決定を丁寧に残しつつ、検索・導入・API 利用の入口を
広く保ちます。
