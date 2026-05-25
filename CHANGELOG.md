# Changelog

## Unreleased

- まだありません。

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
