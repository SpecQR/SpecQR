# Changelog

## Unreleased

### Added

- Added practical examples for Node PNG output, browser Blob/Object URL usage, TypeScript usage, and GS1 QR generation.
- Added a small dependency-free browser playground with input, ECC selection, preview, diagnostics, warnings, and SVG/PNG downloads.
- Added GS1 mod-10 check digit helpers for GTIN and SSCC values.

### Changed

- Strengthened supported GS1 AI validation for GTIN/SSCC check digits and representative country-of-origin AIs.
- Added examples smoke coverage to CI.

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
