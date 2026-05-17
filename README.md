# SpecQR

SpecQR is a dependency-free JavaScript QR Code Model 2 generator. It focuses on standards-conscious QR generation with SVG, PNG, matrix, diagnostics, Kanji, ECI, and GS1/FNC1 support.

Repository: https://github.com/SpecQR/SpecQR

SpecQR は、通常の QR Code Model 2 を JavaScript だけで生成するためのライブラリです。実用上「生成はできるが読めない」「仕様端で壊れる」「環境で挙動が変わる」問題を避けるため、v1 では対応範囲を明確に絞り、テストとデコード検証を厚めに置いています。

## インストール

```sh
npm install specqr@1.0.0-rc.1
```

## v1 RC の対応範囲

- QR Code Model 2
- Version 1 から 40
- 誤り訂正レベル L, M, Q, H
- Numeric / alphanumeric / UTF-8 byte mode
- Shift_JIS ベースの QR Kanji mode
- 自動 mixed-segment optimization
- binary input と manual segment input
- GS1 QR Code / FNC1 first position
- 対応 AI に限定した GS1 human-readable parser / element string helper
- `matrix`, `svg`, Data URL, PNG, canvas output
- Node PNG helper と browser Blob/ImageData/Object URL helper
- capacity、mask/version selection、contrast、quiet zone、print warning を含む diagnostics

Micro QR、rMQR、logo overlay、styled modules、FNC1 second position、Structured Append は v1 RC の対象外です。

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

GS1 QR Code を生成する場合は、human-readable GS1 text を parse して raw GS1 element string に変換し、`gs1: true` を指定します。

```js
import { QRCode, createGs1ElementString, parseGs1HumanReadable } from "specqr";

const elements = parseGs1HumanReadable("(01)04912345678904(10)ABC123(17)251231");
const data = createGs1ElementString(elements);

const svg = QRCode.generate(data, {
  gs1: true,
  output: "svg"
});
```

`parseGs1HumanReadable()` は対応 AI の parentheses 表記を `{ ai, value }[]` に変換します。`createGs1ElementString()` は値を検証し、可変長 AI の後に別の AI が続く場合だけ ASCII GS separator (`"\x1D"`) を挿入します。AI values は先頭ゼロを保持するため string で渡してください。全 GS1 AI catalog、業界別 validation、check digit validation は v1 RC の対象外です。

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
