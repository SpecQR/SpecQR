# Changelog

## Unreleased

### Added

- Added low-level Structured Append header support via `structuredAppend: { index, total, parity }` and manual `{ mode: "structured-append", index, total, parity }` segments.
- Added Structured Append diagnostics, validation, unit coverage, golden fixture coverage, and packed package smoke coverage.
- Added high-level Structured Append generation via `generateStructuredAppend(input, options)` and `QRCode.generateStructuredAppend(input, options)`.
- Added automatic string / binary splitting, original payload byte XOR parity, top-level set diagnostics, fixed version / ECC / mask golden fixture coverage, TypeScript declarations, and packed package smoke coverage for high-level Structured Append.
- Added Structured Append decoded parts merge support via `mergeStructuredAppendParts(parts, options?)` and `QRCode.mergeStructuredAppendParts(parts, options?)`.
- Added merge validation for missing symbols, duplicate indexes, total/parity mismatch, mixed string/binary parts, and merged payload byte parity.

### Notes

- Public parity helpers, QR decoder implementation, scanner integration, and npm publish are not part of this change.

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
