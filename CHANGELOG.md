# Changelog

## Unreleased

まだありません。

## 2.2.1 - 2026-05-27

SpecQR 2.2.1 is a documentation, examples, and playground polish patch for the GS1 Digital Link v2.2 APIs.

SpecQR 2.2.1 は、2.2.0 の runtime behavior、public API、package exports、runtime dependency-free policy を維持したまま、GS1 Digital Link v2.2 API の利用導線を整える patch release です。

### 改善

- README から `createGs1DigitalLink()` / `parseGs1DigitalLink()` / `validateGs1DigitalLink()` / `normalizeGs1DigitalLink()` の関係と詳細 docs に辿りやすい導線を追加しました。
- `docs/api.md`、`docs/gs1-digital-link-v2.md`、`docs/gs1-digital-link-validation-v2.2.md`、`docs/gs1-supported-ai.md`、`docs/spec-scope.md`、`docs/conformance.md`、`docs/v2-roadmap.md`、`docs/release.md` を Digital Link validation / normalization の説明に合わせて整理しました。
- Playground に `GS1 Digital Link URI` 入力形式と unknown query `preserve` / `reject` の表示を追加し、validation、warnings、normalized URI を確認しやすくしました。
- `examples/gs1-digital-link.mjs` と TypeScript usage example を補強し、parse / validate / normalize と unknown query policy の使い分けを example smoke で確認するようにしました。

### 変更なし

- QR generation runtime、public API、package exports、runtime dependencies は変更していません。
- GS1 Digital Link resolver、compression / decompression、full canonicalization、GS1 full AI catalog、Micro QR、rMQR、logo overlay、styled modules は引き続き非スコープです。

## 2.2.0 - 2026-05-27

SpecQR 2.2.0 is the stable GS1 Digital Link validation and deterministic normalization release.

SpecQR 2.2.0 は、v2.0 / v2.1 の QR / GS1 / Structured Append API を保ったまま、GS1 Digital Link URI を実務で検証・安定再出力しやすくする polish release です。QR generation runtime、package exports、runtime dependency-free policy、`createGs1DigitalLink()` の既存 output 方針は維持しています。

### 追加

- GS1 Digital Link URI 向けの non-throwing validation API として `validateGs1DigitalLink(uri, options?)` と `QRCode.validateGs1DigitalLink(uri, options?)` を追加しました。
- GS1 Digital Link URI 向けの deterministic normalization API として `normalizeGs1DigitalLink(uri, options?)` と `QRCode.normalizeGs1DigitalLink(uri, options?)` を追加しました。
- `validateGs1DigitalLink()` は成功時 `{ ok: true, result, warnings }`、失敗時 `{ ok: false, errors, warnings }` を返し、unknown query、`http:` URI、fragment、invalid percent encoding、duplicate AI、invalid placement、invalid check digit を機械的に扱えるようにしました。
- `normalizeGs1DigitalLink()` は metadata object ではなく URI string を返し、SpecQR deterministic policy に基づいて path/query placement、GS1 AI query sort、unknown query preservation、percent-encoded AI value の decode / validate / re-encode を行います。

### 検証・公開準備

- Digital Link edge fixture として percent-encoded AI value、unknown query preserve / reject、path AI と query AI の組み合わせ、repeated query key、invalid percent encoding、`http:` warning と normalization、fragment / duplicate AI / invalid placement / invalid check digit rejection を追加しました。
- `normalizeGs1DigitalLink()` の idempotency、`createGs1DigitalLink()` output の維持、`parse -> normalize -> parse` の result consistency を追加で確認しました。
- packed package smoke、TypeScript declarations、examples smoke、README / API docs / conformance matrix / test plan / release checklist を v2.2.0 stable publish 前提に更新しました。
- `package.json` / `package-lock.json` の version を `2.2.0` に更新しました。

### 意図的な制限

- `normalizeGs1DigitalLink()` は full GS1 Digital Link canonicalizer ではなく、SpecQR supported AI 範囲に限定した deterministic normalization helper です。
- Resolver、compression / decompression、web vocabulary helper、full GS1 AI catalog、industry profile validation は v2.2.0 の対象外です。
- npm publish、GitHub Release 作成、GitHub Pages deploy、`v2.2.0` tag 作成はこの準備 commit では行いません。

## 2.1.0 - 2026-05-25

SpecQR 2.1.0 is the stable GS1 validation release for dependency-free QR Code Model 2 generation.

SpecQR 2.1.0 は、2.0 系の QR / GS1 / Structured Append API を保ったまま、GS1 helper を UI や入力フォームで扱いやすくする validation release です。QR generation runtime、package exports、runtime dependency 方針は維持しています。

### 追加

- GS1 AI metadata introspection API として `getSupportedGs1Ais()` / `getGs1AiInfo(ai)`、および対応する `QRCode` static methods を追加しました。
- GS1 UI / form validation 向けの non-throwing API として `validateGs1Elements()` / `validateGs1ElementString()`、および対応する `QRCode` static methods を追加しました。
- GS1 detail error code、TypeScript declarations、unit tests、packed package smoke、README / docs を v2.1 validation API に合わせて更新しました。

### 公開準備

- `package.json` / `package-lock.json` の version を `2.1.0` に更新しました。
- README、API docs、conformance matrix、spec scope、release checklist を `2.1.0` stable publish 前提に整理しました。

### 意図的な制限

- `validateGs1DigitalLink()`、Digital Link canonicalization、full GS1 AI catalog は引き続き未公開・非スコープです。

## 2.0.1 - 2026-05-25

SpecQR 2.0.1 は、2.0.0 stable 公開後の release hygiene patch です。QR generation runtime と public API は変更せず、公開物、release checklist、security / contribution docs、GS1 対応 AI の説明、published package smoke を整えました。

### 変更

- `package.json` / `package-lock.json` の version を `2.0.1` に更新しました。
- `README.md` と docs から対応 GS1 AI 一覧へ辿れるようにしました。
- `docs/release.md` に main / tag / npm / GitHub Release / Pages の consistency check を追加し、`latest` / `next` tag の公開後運用を現状に合わせました。
- `SECURITY.md` を追加し、脆弱性報告先、supported versions、dependency-free runtime で受け付ける範囲を明記しました。
- `CONTRIBUTING.md` を追加し、golden fixtures、verify scripts、仕様引用時の注意、日本語メイン運用方針を整理しました。
- `docs/gs1-supported-ai.md` を追加し、現在 supported AI、fixed / variable length、check digit validation、Digital Link role、separator behavior、full GS1 AI catalog ではないことを明記しました。
- published package smoke を軽く補強し、GS1 raw parser、GS1 Digital Link、FNC1 second position、Structured Append public API の install 後 smoke も確認するようにしました。

### 意図的な制限

- 新機能、runtime dependency、package exports、public API は追加していません。
- GS1 full AI catalog、Digital Link validator、Structured Append parity helper、Micro QR、rMQR、logo overlay、styled modules は引き続き v2.0.1 の対象外です。

## 2.0.0 - 2026-05-25

SpecQR 2.0.0 is the stable v2 release for dependency-free QR Code Model 2 generation with GS1 syntax, GS1 Digital Link, FNC1 second position, Structured Append, and stronger release gates.

### 追加

- `parseGs1ElementString(input)` と `QRCode.parseGs1ElementString(input)` を公開し、raw GS1 element string を `{ elements, hasSeparators }` として読み戻せるようにしました。
- `createGs1DigitalLink(input, options)` / `parseGs1DigitalLink(uri, options?)` と対応する `QRCode` static methods を追加しました。
- GS1 AI metadata を catalog-driven な内部 dictionary として整理し、対応 AI の長さ、文字種、separator、GTIN / SSCC check digit、Digital Link path/query placement を検証に使うようにしました。
- FNC1 second position を `fnc1Second` option と manual `{ mode: "fnc1-second", applicationIndicator }` segments で扱えるようにしました。
- Structured Append low-level header を `structuredAppend` option と manual `{ mode: "structured-append", index, total, parity }` segments で扱えるようにしました。
- `generateStructuredAppend(input, options)` / `QRCode.generateStructuredAppend(input, options)` を追加し、string / binary input を最大 16 symbols に自動分割できるようにしました。
- `generateSegmentsStructuredAppend(segments, options)` / `QRCode.generateSegmentsStructuredAppend(segments, options)` を追加し、manual segments を Structured Append symbols に分割できるようにしました。
- `mergeStructuredAppendParts(parts, options?)` / `QRCode.mergeStructuredAppendParts(parts, options?)` を追加し、metadata-returning decoder から得た Structured Append parts を検証して結合できるようにしました。
- GS1 Digital Link、FNC1 second position、Structured Append workflow の examples、playground、scanner adapter example を追加しました。

### 変更

- v2.0.0 の API surface、conformance status、package contents、examples、playground、release gate に合わせて README / docs / CHANGELOG を整理しました。
- TypeScript compiler-based consumer check を追加し、root / `specqr/node` / `specqr/browser` と v2 public API の型 surface を固定しました。
- GitHub Actions を Node 24-compatible official action major に更新しました。
- Node 18 / 20 / 22 / 24 の CI engine matrix を追加し、重い release gates は代表 Node 20 に集約しました。
- package metadata を stable `2.0.0` に更新しました。

### 検証・公開準備

- `npm test`、`npm run verify:types`、`npm run examples:smoke`、`npm run pages:build`、`npm run verify:decode`、`npm run verify:decode:jsqr`、`npm run verify:reference:nayuki`、`npm run verify:pack`、`npm run verify:structured-append:zxing-java` を release gate として扱います。
- `npm pack --dry-run` と `npm publish --dry-run --tag latest` を stable publish 前の必須確認にしました。
- GitHub Actions `CI` は Node 18 / 20 / 22 / 24 matrix と Node 20 release gates を green にする方針です。

### 意図的な制限

- QR decoder、scanner integration、Structured Append public parity helper、full GS1 AI catalog、GS1 Digital Link resolver / compression / full canonicalizer、Micro QR、rMQR、logo overlay、styled modules、CJS build、minified browser build は v2.0.0 の対象外です。

## 2.0.0-rc.1 - 2026-05-23

SpecQR 2.0.0-rc.1 is a prerelease for the v2 line. It keeps the runtime dependency-free while adding GS1 syntax, GS1 Digital Link helpers, FNC1 second position, Structured Append support, and stronger release-gate validation.

### Added

- Added public GS1 raw element string parsing via `parseGs1ElementString(input)` and `QRCode.parseGs1ElementString(input)`, backed by strict supported-AI validation.
- Added GS1 Digital Link helpers via `createGs1DigitalLink(input, options)` / `parseGs1DigitalLink(uri, options?)` and matching `QRCode` static methods.
- Added catalog-driven GS1 AI metadata for supported AI validation, GTIN / SSCC check digit rules, separator behavior, and Digital Link path/query placement.
- Added FNC1 second position support via `fnc1Second` option and manual `{ mode: "fnc1-second", applicationIndicator }` segments.
- Added low-level Structured Append header support via `structuredAppend: { index, total, parity }` and manual `{ mode: "structured-append", index, total, parity }` segments.
- Added Structured Append diagnostics, validation, unit coverage, golden fixture coverage, and packed package smoke coverage.
- Added high-level Structured Append generation via `generateStructuredAppend(input, options)` and `QRCode.generateStructuredAppend(input, options)`.
- Added automatic string / binary splitting, original payload byte XOR parity, top-level set diagnostics, fixed version / ECC / mask golden fixture coverage, TypeScript declarations, and packed package smoke coverage for high-level Structured Append.
- Added manual segment Structured Append generation via `generateSegmentsStructuredAppend(segments, options)` and `QRCode.generateSegmentsStructuredAppend(segments, options)`.
- Added Structured Append decoded parts merge support via `mergeStructuredAppendParts(parts, options?)` and `QRCode.mergeStructuredAppendParts(parts, options?)`.
- Added merge validation for missing symbols, duplicate indexes, total/parity mismatch, mixed string/binary parts, and merged payload byte parity.
- Added Structured Append scanner adapter examples showing ZXing Java style metadata mapping, string/binary merge, shuffled scan order, and expected merge errors.
- Added playground and examples coverage for GS1 Digital Link, FNC1 second position, and Structured Append workflows.

### Changed

- Strengthened release-gate documentation for v2.0.0 API surface, conformance status, package contents, examples, playground, and validation lanes.
- Updated package metadata to `2.0.0-rc.1` for prerelease publication on the npm `next` tag.

### Notes

- Public parity helpers, QR decoder implementation, scanner integration, full GS1 AI catalog, GS1 Digital Link resolver/compression/full canonicalization, Micro QR, rMQR, logo overlay, styled modules, npm publish, and GitHub Release are not part of this change.

## 1.0.0 - 2026-05-22

### Added

- Released SpecQR as the first stable 1.0.0 package.
- Added practical examples for Node PNG output, browser Blob/Object URL usage, TypeScript usage, and GS1 QR generation.
- Added a small dependency-free browser playground with input, ECC selection, preview, diagnostics, warnings, and SVG/PNG downloads.
- Added GS1 mod-10 check digit helpers for GTIN and SSCC values.
- Added a conformance matrix and an external reference comparison report.
- Added fixed-condition matrix comparison against Nayuki QR Code generator as a dev-only reference check.
- Added GitHub Pages build/deploy workflow scaffolding for the playground.
- Added published npm package smoke test tooling for root, node, browser, and GS1 helper imports.
- Added a release checklist covering dist-tags, package contents, GitHub Release notes, and npm publish verification.

### Changed

- Strengthened supported GS1 AI validation for GTIN/SSCC check digits and representative country-of-origin AIs.
- Added examples smoke coverage, Pages build coverage, and Nayuki reference comparison to CI.

## 1.0.0-rc.2 - 2026-05-18

### 修正

- CI の新規 checkout でも helper tests が安定して通るよう、Node PNG file helper test を OS の一時ディレクトリ上で実行するように変更。

## 1.0.0-rc.1 - 2026-05-17

SpecQR の v1 target は、dependency-free な JavaScript QR Code Model 2 generator として、実用上安全な通常 QR generation に集中します。

### 含まれるもの

- QR Code Model 2 versions 1 through 40。
- Error correction levels L, M, Q, H。
- Numeric、alphanumeric、UTF-8 byte、QR Kanji、binary、ECI、manual segments、automatic mixed segmentation。
- GS1 QR Code / FNC1 first position と、対応 AI に限定した human-readable parser / element-string helper。
- Matrix、SVG、SVG Data URL、PNG、PNG Data URL、browser canvas、Node PNG、browser Blob/ImageData/Object URL output。
- Version / mask selection、capacity、codeword counts、quiet zone、color contrast、scan risk、print sizing の diagnostics。
- Golden conformance fixtures、decoder validation、jsQR independent decoder validation、release-candidate smoke tests、package smoke tests。

### 意図的な制限

- FNC1 second position は未対応。
- Full GS1 AI catalog、industry-specific GS1 validation、check-digit validation は未対応。
- Structured Append、Micro QR、rMQR、Frame QR、SQRC、logo overlay、styled modules、playground は未対応。
- Package は ESM-first。CommonJS と minified browser build は、将来 build pipeline を導入するまで保留。

### Publish Checklist

- `npm test`, `npm run verify:decode`, `npm run verify:decode:jsqr`, `npm run verify:decode:optional`, `npm pack --dry-run` を実行する。
- publish 前に `npm publish --dry-run` を実行する。
- RC は `latest` ではなく、`next` などの npm dist tag で公開する。
