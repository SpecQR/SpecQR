# SpecQR

[![CI](https://github.com/SpecQR/SpecQR/actions/workflows/ci.yml/badge.svg)](https://github.com/SpecQR/SpecQR/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/specqr.svg)](https://www.npmjs.com/package/specqr)

SpecQR is a dependency-free JavaScript QR Code Model 2 generator. It focuses on standards-conscious QR generation with SVG, PNG, matrix, diagnostics, Kanji, ECI, and GS1/FNC1 support.

Repository: https://github.com/SpecQR/SpecQR

SpecQR は、通常の QR Code Model 2 を JavaScript だけで生成するためのライブラリです。実用上「生成はできるが読めない」「仕様端で壊れる」「環境で挙動が変わる」問題を避けるため、v1 では対応範囲を明確に絞り、テストとデコード検証を厚めに置いています。

## インストール

```sh
npm install specqr
```

RC / prerelease channel を明示して試す場合:

```sh
npm install specqr@next
```

正式版では `specqr` を stable channel、`specqr@next` を prerelease channel として扱います。

## Links

- Playground source: [playground/](playground/)
- GitHub Pages playground after manual deploy: https://specqr.github.io/SpecQR/playground/
- Examples: [examples/](examples/)
- API: [docs/api.md](docs/api.md)
- Conformance Matrix: [docs/conformance.md](docs/conformance.md)
- External Reference Comparison: [docs/reference-comparison.md](docs/reference-comparison.md)
- Test Plan: [docs/test-plan.md](docs/test-plan.md)
- Release Checklist: [docs/release.md](docs/release.md)
- v2 Roadmap: [docs/v2-roadmap.md](docs/v2-roadmap.md)

## v1 の対応範囲

- QR Code Model 2
- Version 1 から 40
- 誤り訂正レベル L, M, Q, H
- Numeric / alphanumeric / UTF-8 byte mode
- Shift_JIS ベースの QR Kanji mode
- 自動 mixed-segment optimization
- binary input と manual segment input
- GS1 QR Code / FNC1 first position
- 対応 AI に限定した GS1 human-readable parser / element string helper
- GTIN / SSCC check digit helper
- `matrix`, `svg`, Data URL, PNG, canvas output
- Node PNG helper と browser Blob/ImageData/Object URL helper
- capacity、mask/version selection、contrast、quiet zone、print warning を含む diagnostics

Micro QR、rMQR、logo overlay、styled modules、FNC1 second position、Structured Append は v1 の対象外です。

詳細な対応状況は [Conformance Matrix](docs/conformance.md) にまとめています。外部参照実装との固定条件比較は [External Reference Comparison](docs/reference-comparison.md) を参照してください。

v2.0.0 では、GS1 syntax layer、GS1 Digital Link、FNC1 second position、Structured Append、control segment model、検証体系の強化を中心に計画しています。Micro QR、rMQR、logo overlay、styled modules は v2.0.0 の対象外です。詳細は [v2 Roadmap](docs/v2-roadmap.md) を参照してください。

## 基本的な使い方

```js
import { QRCode } from "specqr";

const svg = QRCode.generate("https://example.com", {
  errorCorrectionLevel: "M",
  output: "svg"
});
```

Data URL や PNG bytes も返せます。

```js
const dataUrl = QRCode.generate("https://example.com", {
  output: "png-data-url"
});

const pngBytes = QRCode.generate("https://example.com", {
  output: "png"
});
```

ブラウザの canvas に直接描画できます。

```js
const canvas = document.querySelector("canvas");

QRCode.drawToCanvas(canvas, "https://example.com", {
  scale: 8,
  margin: 4
});
```

matrix と diagnostics を取得する例です。

```js
const result = QRCode.generate("hello", {
  output: "matrix",
  diagnostics: true
});

console.log(result.matrix);
console.log(result.diagnostics);
```

## セグメント最適化

`mode: "auto"` では、入力に応じて numeric、alphanumeric、kanji、byte のセグメントを自動で選びます。

```js
QRCode.generate("ORDER-1234567890-こんにちは", {
  mode: "auto",
  optimizeSegments: true
});
```

QR Kanji mode で表現できる日本語は、自動的に compact な Kanji segment になります。

```js
const result = QRCode.generate("こんにちは漢字", {
  output: "matrix",
  diagnostics: true
});

console.log(result.diagnostics.mode); // "kanji"
```

同じ Version に収まる範囲で誤り訂正レベルを上げたい場合は `boostErrorCorrection` を使います。

```js
QRCode.generate("HELLO", {
  errorCorrectionLevel: "L",
  boostErrorCorrection: true
});
```

UTF-8 byte data であることを ECI で明示する例です。

```js
QRCode.generate("こんにちは", {
  eci: true
});
```

## GS1 QR Code / FNC1 first position

GS1 QR Code を生成する場合は、human-readable GS1 text を parse して raw GS1 element string に変換し、`gs1: true` を指定します。通常テキスト QR と違い、GS1 QR Code では先頭に FNC1 first position mode indicator が入り、GS1 element string として解釈されることを decoder に伝えます。

```js
import { QRCode, createGs1ElementString, parseGs1HumanReadable } from "specqr";

const elements = parseGs1HumanReadable("(01)04912345678904(10)ABC123(17)251231");
const data = createGs1ElementString(elements);

const svg = QRCode.generate(data, {
  gs1: true,
  output: "svg"
});
```

`parseGs1HumanReadable()` は対応 AI の parentheses 表記を `{ ai, value }[]` に変換します。`createGs1ElementString()` は値を検証し、可変長 AI の後に別の AI が続く場合だけ ASCII GS separator (`"\x1D"`) を挿入します。`QRCode.generate(data, { gs1: true })` は raw GS1 element string を内部 validator で検証してから生成します。AI values は先頭ゼロを保持するため string で渡してください。AI `00` の SSCC check digit と AI `01`/`02` の GTIN check digit は validation 対象です。全 GS1 AI catalog、業界別 validation、FNC1 second position は v1 の対象外です。

`(01)04912345678904(10)ABC123` のような parentheses 付き表記は human-readable input です。QR に渡す payload は parentheses を含まない raw GS1 element string です。human-readable input を直接 `gs1: true` に渡すと reject されるため、先に `parseGs1HumanReadable()` と `createGs1ElementString()` を使ってください。外部システムから受け取った raw GS1 element string は `parseGs1ElementString()` で `{ elements, hasSeparators }` に読み戻せます。`diagnostics: true` では `diagnostics.gs1Validation` に `elementCount`、`ais`、separator 有無が入ります。GS1 Digital Link は URL 形式の別用途として扱い、現時点では専用 helper / validation を提供していません。

```js
import { parseGs1ElementString } from "specqr";

const parsed = parseGs1ElementString("010491234567890410ABC123\x1D17251231");
console.log(parsed.elements);
```

GTIN や SSCC の check digit は helper で計算できます。

```js
import { appendGtinCheckDigit, appendSsccCheckDigit } from "specqr";

const gtin = appendGtinCheckDigit("0491234567890"); // "04912345678904"
const sscc = appendSsccCheckDigit("12345678901234567");
```

## バイナリ入力

byte-perfect な payload を扱う場合は `Uint8Array`、`ArrayBuffer`、`ArrayBufferView`、または byte array を渡せます。

```js
const matrix = QRCode.generate(new Uint8Array([0x00, 0x01, 0x02, 0xFF]), {
  output: "matrix"
});

QRCode.generate([0x41, 0x42, 0x43], {
  output: "png"
});
```

## Manual segments

QR mode を利用者側で制御したい場合は `generateSegments()` を使います。

```js
const svg = QRCode.generateSegments([
  { mode: "alphanumeric", data: "ORDER-" },
  { mode: "numeric", data: "1234567890" },
  { mode: "kanji", data: "こんにちは" }
], {
  output: "svg"
});
```

## Diagnostics

`diagnostics: true` を指定すると、選ばれた Version、mask、capacity、warnings などを取得できます。

```js
const result = QRCode.generate("HELLO", {
  output: "png",
  diagnostics: true,
  margin: 2,
  foreground: "#777777",
  background: "#888888",
  printDpi: 600
});

console.log(result.diagnostics.warnings);
```

## Node helpers

Node 専用 helper は `specqr/node` から import します。

```js
import { writePngFile, toPngBuffer } from "specqr/node";

await writePngFile("qr.png", "https://example.com");
const buffer = toPngBuffer("https://example.com");
```

## Browser helpers

ブラウザ向け helper は `specqr/browser` から import します。

```js
import { toBlob, toImageData, toObjectURL } from "specqr/browser";

const blob = toBlob("https://example.com");
const imageData = toImageData("https://example.com");
const url = toObjectURL("https://example.com");
```

## Examples / Playground

実利用向けの小さな examples を同梱しています。

```sh
npm run examples:node
npm run examples:gs1
npm run examples:smoke
```

ブラウザで動作を確認したい場合は playground を起動します。

```sh
npm run playground
```

Open `http://127.0.0.1:4173/playground/`.

GitHub Pages に公開する場合は、repository settings で Pages source を `GitHub Actions` にし、`Deploy Playground` workflow を手動実行します。push だけでは deploy しません。

## Errors

エラーは安定した class と `code` field を持ちます。

```js
import { DataTooLongError, QRCode } from "specqr";

try {
  QRCode.generate("x".repeat(100), { version: 1 });
} catch (error) {
  if (error instanceof DataTooLongError) {
    console.error(error.code);
  }
}
```

## 開発と検証

```sh
npm test
```

`npm test` には、固定 Version / 誤り訂正 / mask の golden conformance fixture が含まれます。matrix rows、codewords、diagnostics、format bits、version bits、remainder bits の代表ケースを固定しています。

QR 構築ロジックの意図した変更を受け入れる場合だけ、snapshot を更新します。

```sh
npm run fixtures:golden
npm test
```

macOS では Vision を使った fixture decode validation も実行できます。

```sh
npm run verify:decode
```

ローカルに利用可能な decoder がある場合は optional multi-decoder validation も使えます。

```sh
npm run verify:decode:optional
```

この optional script は `jsqr`、`zbarimg`、ZXing 系 CLI を検出し、未導入の decoder は skip します。

portable な独立 decoder release gate として、jsQR-backed check も用意しています。

```sh
npm run verify:decode:jsqr
```

`jsqr` は devDependency のみです。SpecQR の runtime package は dependency-free のままです。

固定条件での外部参照比較には Nayuki QR Code generator を使います。

```sh
npm run verify:reference:nayuki
```

この check は fixed payload、fixed Version、fixed ECC、fixed mask の matrix を外部実装と比較します。auto segmentation や GS1 semantics の完全一致は目的にしていません。

公開済み npm package の smoke test は release 前後に実行します。

```sh
npm run verify:published
```
