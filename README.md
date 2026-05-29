# SpecQR

[![CI](https://github.com/SpecQR/SpecQR/actions/workflows/ci.yml/badge.svg)](https://github.com/SpecQR/SpecQR/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/specqr.svg)](https://www.npmjs.com/package/specqr)

SpecQR is a dependency-free JavaScript QR Code Model 2 generator. It focuses on standards-conscious QR generation with SVG, PNG, matrix, diagnostics, Kanji, ECI, and GS1/FNC1 support.

Repository: https://github.com/SpecQR/SpecQR

SpecQR は、通常の QR Code Model 2 を JavaScript だけで生成するためのライブラリです。実用上「生成はできるが読めない」「仕様端で壊れる」「環境で挙動が変わる」問題を避けるため、対応範囲を明確に絞り、テスト、golden fixtures、デコード検証を厚めに置いています。

Node.js は `>=18` をサポート範囲にし、CI では Node 18 / 20 / 22 / 24 の engine matrix を release gate として確認します。

## インストール

```sh
npm install specqr
```

次の prerelease channel を明示して試す場合:

```sh
npm install specqr@next
```

`specqr` は stable channel です。`specqr@next` は次の prerelease を試すための channel として扱いますが、stable 公開直後は `latest` と同じ version を指すことがあります。通常利用では `npm install specqr` を使ってください。

## Links

- Playground source: [playground/](playground/)
- GitHub Pages playground after manual deploy: https://specqr.github.io/SpecQR/playground/
- Examples: [examples/](examples/)
- API: [docs/api.md](docs/api.md)
- Conformance Matrix: [docs/conformance.md](docs/conformance.md)
- External Reference Comparison: [docs/reference-comparison.md](docs/reference-comparison.md)
- Test Plan: [docs/test-plan.md](docs/test-plan.md)
- Release Checklist: [docs/release.md](docs/release.md)
- Security Policy: [SECURITY.md](SECURITY.md)
- Contributing: [CONTRIBUTING.md](CONTRIBUTING.md)
- Project Language Policy: [docs/project-language.md](docs/project-language.md)
- Supported GS1 AIs: [docs/gs1-supported-ai.md](docs/gs1-supported-ai.md)
- GS1 Validation v2.1 Design: [docs/gs1-validation-v2.1.md](docs/gs1-validation-v2.1.md)
- GS1 Digital Link Validation v2.2 Design: [docs/gs1-digital-link-validation-v2.2.md](docs/gs1-digital-link-validation-v2.2.md)
- v2 Roadmap: [docs/v2-roadmap.md](docs/v2-roadmap.md)
- Planning / Diagnostics API v2.4 Design: [docs/planning-diagnostics-v2.4.md](docs/planning-diagnostics-v2.4.md)
- Structured Append v2 API Design: [docs/structured-append-v2.md](docs/structured-append-v2.md)
- Structured Append Parity Helper v2.3: [docs/structured-append-parity-v2.3.md](docs/structured-append-parity-v2.3.md)
- Structured Append Manual Segments Parity Helper v2.3: [docs/structured-append-segments-parity-v2.3.md](docs/structured-append-segments-parity-v2.3.md)
- Structured Append Scanning Workflow: [docs/structured-append-scanning-v2.md](docs/structured-append-scanning-v2.md)
- Structured Append Decoder Metadata Validation: [docs/structured-append-decoder-validation-v2.md](docs/structured-append-decoder-validation-v2.md)
- GS1 Digital Link v2 Design: [docs/gs1-digital-link-v2.md](docs/gs1-digital-link-v2.md)

## 現在の対応範囲

- QR Code Model 2
- Version 1 から 40
- 誤り訂正レベル L, M, Q, H
- Numeric / alphanumeric / UTF-8 byte mode
- Shift_JIS ベースの QR Kanji mode
- 自動 mixed-segment optimization
- binary input と manual segment input
- GS1 QR Code / FNC1 first position
- FNC1 second position
- Structured Append low-level header / high-level automatic splitting / parity helpers
- 対応 AI に限定した GS1 human-readable parser / element string / Digital Link helper
- GTIN / SSCC check digit helper
- `matrix`, `svg`, Data URL, PNG, canvas output
- Node PNG helper と browser Blob/ImageData/Object URL helper
- capacity、mask/version selection、contrast、quiet zone、print warning を含む diagnostics

Micro QR、rMQR、logo overlay、styled modules は現在の core package の対象外です。

詳細な対応状況は [Conformance Matrix](docs/conformance.md) にまとめています。外部参照実装との固定条件比較は [External Reference Comparison](docs/reference-comparison.md) を参照してください。

v2 系では、GS1 syntax layer、GS1 Digital Link、FNC1 second position、Structured Append、control segment model、検証体系の強化を stable release scope として扱います。詳細は [v2 Roadmap](docs/v2-roadmap.md)、[GS1 Digital Link v2 Design](docs/gs1-digital-link-v2.md)、[GS1 Digital Link Validation v2.2 Design](docs/gs1-digital-link-validation-v2.2.md) を参照してください。

2.1.0 では GS1 validation layer を stable API として強化しました。Supported AI metadata は `getSupportedGs1Ais()` / `getGs1AiInfo(ai)` で確認でき、UI / form validation では throwing API の代わりに `validateGs1Elements()` / `validateGs1ElementString()` の non-throwing result を使えます。詳細は [GS1 Validation v2.1 Design](docs/gs1-validation-v2.1.md) を参照してください。

2.2.0 では GS1 Digital Link URI 向けに `validateGs1DigitalLink()` と `normalizeGs1DigitalLink()` を stable API として追加しました。Normalization は full canonicalizer ではなく、SpecQR deterministic policy に基づく安定再出力 helper です。

2.3.0 では Structured Append の低レベル利用向けに `calculateStructuredAppendParity()` と `calculateStructuredAppendSegmentsParity()` を stable API として追加しました。どちらも QR encoded bitstream ではなく logical message bytes の XOR を返し、高レベル `generateStructuredAppend()` / `generateSegmentsStructuredAppend()` が返す `parity` と一致します。

2.4.0 では、生成前に Version / ECC / mode / capacity / warnings を見積もる planning API を設計対象にします。現時点では docs-only proposal であり、runtime API はまだ追加していません。詳細は [Planning / Diagnostics API v2.4 Design](docs/planning-diagnostics-v2.4.md) を参照してください。

Digital Link 周りの導線は次の順に読むと迷いにくいです。

| 知りたいこと | 入口 |
| --- | --- |
| GS1 QR Code と GS1 Digital Link URI QR の違い | [GS1 Digital Link v2 Design](docs/gs1-digital-link-v2.md#一番大事な区別) |
| `create` / `parse` / `validate` / `normalize` の使い分け | [API: GS1 Helpers](docs/api.md#gs1-helpers) |
| unknown query、`http:` warning、deterministic normalization policy | [GS1 Digital Link Validation v2.2 Design](docs/gs1-digital-link-validation-v2.2.md) |
| 対応 AI と path/query placement | [Supported GS1 AIs](docs/gs1-supported-ai.md) |
| ブラウザで動きを確認する | [Playground](https://specqr.github.io/SpecQR/playground/) |

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

`parseGs1HumanReadable()` は対応 AI の parentheses 表記を `{ ai, value }[]` に変換します。`createGs1ElementString()` は値を検証し、可変長 AI の後に別の AI が続く場合だけ ASCII GS separator (`"\x1D"`) を挿入します。`QRCode.generate(data, { gs1: true })` は raw GS1 element string を内部 validator で検証してから生成します。AI values は先頭ゼロを保持するため string で渡してください。AI `00` の SSCC check digit と AI `01`/`02` の GTIN check digit は validation 対象です。全 GS1 AI catalog と業界別 validation は現在の対象外です。

現在 supported AI の一覧、fixed / variable length、check digit validation、Digital Link role、separator behavior は [Supported GS1 AIs](docs/gs1-supported-ai.md) にまとめています。

`(01)04912345678904(10)ABC123` のような parentheses 付き表記は human-readable input です。QR に渡す payload は parentheses を含まない raw GS1 element string です。human-readable input を直接 `gs1: true` に渡すと reject されるため、先に `parseGs1HumanReadable()` と `createGs1ElementString()` を使ってください。外部システムから受け取った raw GS1 element string は `parseGs1ElementString()` で `{ elements, hasSeparators }` に読み戻せます。`diagnostics: true` では `diagnostics.gs1Validation` に `elementCount`、`ais`、separator 有無が入ります。

```js
import { parseGs1ElementString } from "specqr";

const parsed = parseGs1ElementString("010491234567890410ABC123\x1D17251231");
console.log(parsed.elements);
```

入力フォームなどで例外を投げずに検証したい場合は、non-throwing validation API を使えます。

```js
import { getGs1AiInfo, validateGs1ElementString } from "specqr";

console.log(getGs1AiInfo("01")?.checkDigitRule); // "gtin"

const validation = validateGs1ElementString("010491234567890410ABC12317251231");
if (!validation.ok) {
  console.log(validation.errors[0].code); // "GS1_MISSING_SEPARATOR"
}
```

## FNC1 second position

FNC1 second position は GS1 QR Code ではなく、AIM International と合意済みの業界・アプリケーション仕様を示す optional control mode です。Application Indicator は 2 桁数字、または 1 文字の Latin alphabetic character を指定します。

```js
QRCode.generate("AA1234BBB112", {
  fnc1Second: "37",
  mode: "alphanumeric",
  output: "svg"
});
```

## Structured Append

`generateStructuredAppend()` は、string / binary input を最大 16 symbols に自動分割し、元 payload bytes の XOR parity と low-level Structured Append header を各 symbol に付けます。

```js
const set = QRCode.generateStructuredAppend("A".repeat(31), {
  version: 1,
  errorCorrectionLevel: "L",
  mode: "alphanumeric",
  output: "svg"
});

console.log(set.total);
console.log(set.parity);
console.log(set.symbols);
```

各 symbol を SVG / PNG として保存する例は [examples/structured-append.mjs](examples/structured-append.mjs) にあります。Playground でも `Structured Append` mode を選ぶと、複数 symbol の preview、parity、per-symbol diagnostics を確認できます。

Structured Append は複数 QR symbols を 1 つの logical message として扱うための QR 仕様機能です。ただし、scanner によっては自動結合結果を返さず、各 symbol を個別に露出する場合があります。SpecQR の検証では decoder merge だけに依存せず、header、parity、matrix、diagnostics、golden fixture を重視しています。読み取り側 workflow と `mergeStructuredAppendParts()` の位置づけは [Structured Append Scanning Workflow](docs/structured-append-scanning-v2.md) に、metadata-returning decoder 候補と optional validation 方針は [Structured Append Decoder Metadata Validation](docs/structured-append-decoder-validation-v2.md) にまとめています。

decoder が `{ index, total, parity, data }` を返せる場合は、`mergeStructuredAppendParts()` で欠落、重複、metadata mismatch、payload parity を検証してから結合できます。

```js
const merged = QRCode.mergeStructuredAppendParts([
  { index: 2, total: 2, parity: 65, data: "AAAAAAAAAA" },
  { index: 1, total: 2, parity: 65, data: "A".repeat(21) }
]);

console.log(merged.data);
```

scanner adapter の具体例は [examples/structured-append-merge.mjs](examples/structured-append-merge.mjs) にあります。ZXing Java style の `STRUCTURED_APPEND_SEQUENCE` / `STRUCTURED_APPEND_PARITY` metadata を SpecQR の parts に変換する例と、metadata がない decoder では安全に復元しない方針を示しています。

利用者が各 symbol の `index`、`total`、`parity` を明示したい場合は、低レベル header API も使えます。

```js
QRCode.generate("PART 2", {
  structuredAppend: { index: 2, total: 4, parity: 0x5a },
  output: "svg"
});
```

低レベル API では、`parity` は各 chunk ではなく logical message 全体の original payload bytes から計算する必要があります。`calculateStructuredAppendParity(input)` を使うと、高レベル `generateStructuredAppend()` と同じ byte policy で parity を計算できます。

```js
import { QRCode, calculateStructuredAppendParity } from "specqr";

const message = "PART 1PART 2";
const parity = calculateStructuredAppendParity(message);

QRCode.generate("PART 1", {
  structuredAppend: { index: 1, total: 2, parity },
  output: "svg"
});

QRCode.generate("PART 2", {
  structuredAppend: { index: 2, total: 2, parity },
  output: "svg"
});
```

入力型ごとの byte policy は [Structured Append Parity Helper v2.3](docs/structured-append-parity-v2.3.md) を参照してください。

高レベル API の分割方針と制限は [Structured Append v2 API Design](docs/structured-append-v2.md) にまとめています。
Manual segments 版は `QRCode.generateSegmentsStructuredAppend()` で利用できます。分割方針は [Structured Append Manual Segments v2 API Design](docs/structured-append-segments-v2.md) にまとめています。
Manual segments を低レベル `structured-append` header と組み合わせて自分で分割する場合は、`calculateStructuredAppendSegmentsParity(segments)` で `generateSegmentsStructuredAppend()` と同じ canonical bytes policy の parity を計算できます。

```js
import { QRCode, calculateStructuredAppendSegmentsParity } from "specqr";

const segments = [
  { mode: "alphanumeric", data: "ORDER-" },
  { mode: "numeric", data: "12345678901234567890" },
  { mode: "byte", data: new Uint8Array([0xde, 0xad, 0xbe, 0xef]) }
];

const parity = calculateStructuredAppendSegmentsParity(segments);

QRCode.generateSegments([
  { mode: "structured-append", index: 1, total: 2, parity },
  { mode: "alphanumeric", data: "ORDER-" }
]);

QRCode.generateSegments([
  { mode: "structured-append", index: 2, total: 2, parity },
  { mode: "numeric", data: "12345678901234567890" },
  { mode: "byte", data: new Uint8Array([0xde, 0xad, 0xbe, 0xef]) }
]);

const autoSet = QRCode.generateSegmentsStructuredAppend(segments, {
  version: 1,
  errorCorrectionLevel: "L"
});

console.log(autoSet.parity === parity);
```

Manual segments parity helper の bytes policy と control segment rejection は [Structured Append Manual Segments Parity Helper v2.3](docs/structured-append-segments-parity-v2.3.md) にまとめています。

## GS1 Digital Link URI QR

GS1 Digital Link URI は通常 URL QR として生成します。`gs1: true` は指定しません。生成した URI は `parseGs1DigitalLink()` で element data に戻せます。UI / form validation では `validateGs1DigitalLink()` の non-throwing result を使えます。

| API | 役割 |
| --- | --- |
| `createGs1DigitalLink(elements, options)` | `{ ai, value }[]` から URI を作る throwing builder。 |
| `parseGs1DigitalLink(uri, options?)` | URI を `{ elements, primary, pathElements, queryElements, unknownQuery }` に戻す throwing parser。 |
| `validateGs1DigitalLink(uri, options?)` | UI / form 向けに `{ ok, result/errors, warnings }` を返す non-throwing validator。 |
| `normalizeGs1DigitalLink(uri, options?)` | SpecQR deterministic policy で URI string を安定再出力する helper。full canonicalizer ではありません。 |

```js
import {
  QRCode,
  createGs1DigitalLink,
  normalizeGs1DigitalLink,
  parseGs1DigitalLink,
  parseGs1HumanReadable,
  validateGs1DigitalLink
} from "specqr";

const elements = parseGs1HumanReadable("(01)04912345678904(10)ABC123(17)251231");
const uri = createGs1DigitalLink(elements, {
  baseUrl: "https://example.com"
});

const parsed = parseGs1DigitalLink(uri);
console.log(parsed.elements);

const validation = validateGs1DigitalLink(uri);
if (!validation.ok) {
  console.log(validation.errors[0].code);
}

const normalized = normalizeGs1DigitalLink(
  "https://example.com/01/04912345678904?17=251231&10=ABC123"
);
console.log(normalized);
// "https://example.com/01/04912345678904/10/ABC123?17=251231"

const svg = QRCode.generate(uri, { output: "svg" });
```

実行可能な Digital Link validation / normalization 例は [examples/gs1-digital-link.mjs](examples/gs1-digital-link.mjs) にあります。

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
npm run examples:structured-append
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

pack した package を一時 install し、公開 API と型定義の surface を確認します。

```sh
npm run verify:pack
```

この check は `parseGs1ElementString()`、`QRCode.parseGs1ElementString()`、`specqr/node` / `specqr/browser` とは独立した root install smoke と、同梱 `.d.ts` の軽量確認を行います。

公開済み npm package の smoke test は release 前後に実行します。

```sh
npm run verify:published
```
