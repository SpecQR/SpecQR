# API

この文書は現在の SpecQR public API を説明します。SpecQR `2.1.0` では、2.0.0 で stable scope に入れた GS1 Digital Link、FNC1 second position、Structured Append API に加え、GS1 validation / supported AI introspection API を stable public API として含めています。API 名、option 名、型名、error class 名は JavaScript/TypeScript から利用する識別子なので英語のままです。

## Core

### `QRCode.generate(input, options)`

JavaScript string、byte array、`Uint8Array`、`ArrayBuffer`、`ArrayBufferView` から QR Code を生成します。

```js
import { QRCode } from "specqr";

const svg = QRCode.generate("https://example.com", {
  errorCorrectionLevel: "M",
  version: "auto",
  minVersion: 1,
  maxVersion: 40,
  maskPattern: "auto",
  mode: "auto",
  encoding: "utf-8",
  optimizeSegments: true,
  margin: 4,
  scale: 8,
  foreground: "#000000",
  background: "#ffffff",
  output: "svg",
  boostErrorCorrection: false,
  eci: false,
  gs1: false,
  fnc1Second: false,
  structuredAppend: false,
  diagnostics: false,
  printDpi: null
});
```

### `QRCode.generateStructuredAppend(input, options)`

string / binary input を最大 16 個の Structured Append symbols に自動分割します。root named export の `generateStructuredAppend(input, options)` も同じ API です。返り値は常に `{ symbols, total, parity, inputLength, byteLength, diagnostics }` の object です。

```js
import { generateStructuredAppend } from "specqr";

const result = generateStructuredAppend("A".repeat(31), {
  version: 1,
  errorCorrectionLevel: "L",
  mode: "alphanumeric",
  output: "svg"
});

console.log(result.total); // 2
console.log(result.parity); // original payload bytes の XOR
console.log(result.symbols); // SVG strings
console.log(result.diagnostics.symbols);
```

`symbols` の各要素は既存 `generate()` と同じ output shape です。`diagnostics: true` の場合、各要素は `QRCodeDiagnosticResult` になり、通常の per-symbol diagnostics も取得できます。top-level `diagnostics` は常に返り、選択 Version、total、parity、chunk offsets、各 symbol の Structured Append sequence metadata を含みます。

Node で各 symbol を SVG / PNG として保存する例は [../examples/structured-append.mjs](../examples/structured-append.mjs) にあります。Playground では `Single QR` / `Structured Append` を切り替え、複数 preview、`total`、`parity`、per-symbol index、capacity diagnostics、warnings を確認できます。

初期実装の対象は string、byte array、`Uint8Array`、`ArrayBuffer`、`ArrayBufferView` です。manual segments 版は `generateSegmentsStructuredAppend()` で提供しています。public parity helper と QR decoder は提供していません。読み取り後に decoder metadata が取れている場合の結合は `mergeStructuredAppendParts()` で扱います。

`generateStructuredAppend()` は高レベル API が header を管理するため、`eci`、`gs1: true`、`fnc1Second`、`structuredAppend`、`boostErrorCorrection` との併用を reject します。1 symbol に収まる input も Structured Append set としては不正なので、`generate()` または low-level `structuredAppend` option を使うよう `InvalidInputError` で reject します。

Structured Append を読める scanner でも、API が複数 symbols を自動結合して返すとは限りません。SpecQR は decoder merge を release gate の唯一の根拠にせず、Structured Append header、parity、matrix / golden fixture、diagnostics consistency を検証対象にします。

### `QRCode.generateSegments(segments, options)`

呼び出し側が明示した segment から QR Code を生成します。対応する segment mode は `structured-append`, `fnc1`, `fnc1-second`, `eci`, `numeric`, `alphanumeric`, `byte`, `kanji` です。

```js
QRCode.generateSegments([
  { mode: "alphanumeric", data: "ORDER-" },
  { mode: "numeric", data: "1234567890" },
  { mode: "kanji", data: "漢字" },
  { mode: "byte", data: new Uint8Array([0x41, 0x42, 0x43]) }
]);
```

### `QRCode.generateSegmentsStructuredAppend(segments, options)`

Manual segments 版の高レベル Structured Append API です。root named export の `generateSegmentsStructuredAppend(segments, options)` も同じ API です。返り値は `generateStructuredAppend()` と同じ `{ symbols, total, parity, inputLength, byteLength, diagnostics }` の object です。

```js
import { generateSegmentsStructuredAppend } from "specqr";

const result = generateSegmentsStructuredAppend([
  { mode: "alphanumeric", data: "ORDER-" },
  { mode: "numeric", data: "12345678901234567890" },
  { mode: "byte", data: new Uint8Array([0xde, 0xad, 0xbe, 0xef]) }
], {
  version: 1,
  errorCorrectionLevel: "L",
  output: "svg"
});
```

Split policy は segment boundary first です。`byte` segment だけを byte boundary、または string data の Unicode code point boundary で安全に chunking します。`numeric` / `alphanumeric` / `kanji` segment の途中分割、ECI / GS1 / FNC1 併用、low-level `{ mode: "structured-append" }` との併用は reject します。`diagnostics.splitStrategy` は `"segment-boundary-byte-chunk"` になり、`diagnostics.splitUnits` と `diagnostics.symbols` に source segment range、split unit range、byte offset、per-symbol Structured Append metadata が入ります。詳細は [Structured Append Manual Segments v2 API Design](./structured-append-segments-v2.md) を参照してください。

### `QRCode.mergeStructuredAppendParts(parts, options?)`

metadata-returning decoder が返した Structured Append parts を検証し、`index` 順に結合します。root named export の `mergeStructuredAppendParts(parts, options?)` も同じ API です。SpecQR は QR decoder や scanner integration は提供しません。この helper は decoder が `{ index, total, parity, data }` を返せた場合だけ使います。

```js
import { mergeStructuredAppendParts } from "specqr";

const merged = mergeStructuredAppendParts([
  { index: 2, total: 2, parity: 65, data: "AAAAAAAAAA" },
  { index: 1, total: 2, parity: 65, data: "A".repeat(21) }
]);

console.log(merged.data); // "A".repeat(31)
console.log(merged.diagnostics.parityCheck.matches); // true
```

`parts` は配列で、各要素は `{ index, total, parity, data }` です。`index` は 1-based、`total` は `2..16`、`parity` は `0..255` integer です。`data` は string、`Uint8Array`、`ArrayBuffer`、`ArrayBufferView` を受け取ります。string parts と binary parts の混在、metadata のない raw payload 配列、推測による順序復元は扱いません。

返り値は `{ data, total, parity, parts, diagnostics }` です。string input の場合、`data` は string 連結結果です。binary input の場合、`data` は `Uint8Array` です。`parts` は `index` 昇順の normalized metadata で、`diagnostics` には `partCount`、`dataType`、`byteLength`、`missing`、`duplicate`、`parityCheck` が入ります。

Validation は安全側です。空配列、範囲外の `index` / `total` / `parity`、duplicate index、missing symbol、total mismatch、parity mismatch、part 数不一致、string/binary 混在、invalid data type、merged payload bytes の XOR parity mismatch は `InvalidInputError` で reject します。`options` は将来拡張用に残していますが、現在は空 object のみ受け付けます。

scanner adapter は decoder 固有の output を SpecQR の part shape に寄せる薄い層です。例えば ZXing Java style の metadata を受け取る場合は、`STRUCTURED_APPEND_SEQUENCE` の上位 4 bit を `index - 1`、下位 4 bit を `total - 1` として扱い、`STRUCTURED_APPEND_PARITY` をそのまま `parity` に渡します。

```js
function zxingJavaResultToStructuredAppendPart(result) {
  const sequence = result.resultMetadata.STRUCTURED_APPEND_SEQUENCE;
  const parity = result.resultMetadata.STRUCTURED_APPEND_PARITY;

  return {
    index: (sequence >> 4) + 1,
    total: (sequence & 0x0f) + 1,
    parity,
    data: result.rawBytes ?? result.text
  };
}

const parts = zxingResults.map(zxingJavaResultToStructuredAppendPart);
const merged = mergeStructuredAppendParts(parts);
```

metadata がない decoder output、たとえば decoded string だけの配列からは、順序、欠落、重複、parity を安全に判断できません。その場合は `mergeStructuredAppendParts()` に渡さず、decoder が返した通常の decoded data として扱ってください。実行可能な adapter example は [../examples/structured-append-merge.mjs](../examples/structured-append-merge.mjs) にあります。

Structured Append を読み取る decoder が自動で payload を merge するか、各 symbol の metadata を返すかは実装依存です。読み取り側 workflow と decoder metadata がない場合の限界は [Structured Append Scanning Workflow](./structured-append-scanning-v2.md) を、metadata-returning decoder 候補と optional validation 方針は [Structured Append Decoder Metadata Validation](./structured-append-decoder-validation-v2.md) を参照してください。

### `QRCode.drawToCanvas(target, input, options)`

ブラウザの canvas element、または 2D rendering context に直接描画します。

```js
const canvas = document.querySelector("canvas");

QRCode.drawToCanvas(canvas, "https://example.com", {
  scale: 8,
  margin: 4
});
```

## Options

- `errorCorrectionLevel`: `"L" | "M" | "Q" | "H"`。default は `"M"`。
- `version`: `1..40 | "auto"`。default は `"auto"`。
- `minVersion`: `1..40`。default は `1`。
- `maxVersion`: `1..40`。default は `40`。
- `maskPattern`: `0..7 | "auto"`。default は `"auto"`。
- `mode`: `"auto" | "numeric" | "alphanumeric" | "byte" | "kanji"`。`"auto"` は効率のよい QR segment を自動選択します。
- `encoding`: 現在は byte-mode string input 向けの `"utf-8"` のみ。
- `optimizeSegments`: `mode` が `"auto"` のとき、numeric、alphanumeric、kanji、byte を混在 segment に分割して bit length を減らします。default は `true`。
- `margin`: quiet zone の module 数。default は `4`。
- `scale`: SVG/PNG/canvas/ImageData output での 1 module の pixel size。default は `8`。
- `foreground`: dark module color。default は `"#000000"`。
- `background`: light module color。default は `"#ffffff"`。
- `output`: `"matrix" | "svg" | "svg-data-url" | "png" | "png-data-url"`。default は `"svg"`。
- `boostErrorCorrection`: `true` の場合、選択 Version を増やさずに収まる範囲で error correction level を上げます。default は `false`。
- `eci`: `false | true | number`。default は `false`。`true` は UTF-8 ECI assignment number `26` を挿入し、auto-selected non-ASCII text を byte mode に保ちます。
- `gs1`: boolean。default は `false`。`true` の場合、input を raw GS1 element string として内部 validator で検証し、GS1 QR Code 用に QR FNC1 first position (`0101`) を先頭に挿入します。この実装では ECI と併用できません。
- `fnc1Second`: `false | string`。default は `false`。2 桁数字または 1 文字 Latin alphabetic の Application Indicator を指定すると、QR FNC1 second position (`1001`) と 8-bit Application Indicator codeword を先頭に挿入します。この実装では GS1/FNC1 first position と ECI との併用を reject します。
- `structuredAppend`: `false | { index, total, parity }`。default は `false`。Structured Append mode indicator (`0011`) と 8-bit Symbol Sequence Indicator、8-bit parity data を先頭に挿入します。public API の `index` は 1-based、`total` は `2..16`、`index` は `1..total`、`parity` は `0..255` integer です。この実装では ECI / FNC1 first / FNC1 second / `gs1: true` との併用を安全側で reject します。
- `diagnostics`: `true` の場合、生成詳細と warnings を返します。
- `printDpi`: print-size diagnostics のための optional DPI。生成結果そのものには影響しません。

## GS1 / FNC1 First Position

`gs1: true` は、入力が raw GS1 element string である場合に使います。QR Code の FNC1 first position mode indicator を先頭に挿入し、通常テキスト QR ではなく GS1 QR Code として decode されることを意図します。`QRCode.generate(data, { gs1: true })` は supported AI dictionary に基づき raw payload を検証します。

```js
import { QRCode, createGs1ElementString, parseGs1HumanReadable } from "specqr";

const elements = parseGs1HumanReadable("(01)04912345678904(10)ABC123(17)251231");
const data = createGs1ElementString(elements);

const svg = QRCode.generate(data, {
  gs1: true,
  output: "svg"
});
```

manual segment でも FNC1 first position を明示できます。

```js
QRCode.generateSegments([
  { mode: "fnc1" },
  { mode: "numeric", data: "0104912345678904" },
  { mode: "alphanumeric", data: "10ABC123" }
]);
```

## FNC1 Second Position

FNC1 second position は GS1 QR Code 用ではありません。AIM International と合意済みの業界・アプリケーション仕様を示すための QR control mode で、FNC1 second mode indicator `1001` に続けて 8-bit Application Indicator codeword を encode します。

SpecQR では Application Indicator を次のどちらかとして受け付けます。

- 2 桁数字: `"00"` から `"99"`。codeword は数値をそのまま 8-bit で encode します。
- 1 文字 Latin alphabetic: `"A"` から `"Z"` または `"a"` から `"z"`。codeword は ASCII value + 100 です。

```js
QRCode.generate("AA1234BBB112", {
  fnc1Second: "37",
  mode: "alphanumeric",
  output: "svg"
});
```

manual segment でも明示できます。

```js
QRCode.generateSegments([
  { mode: "fnc1-second", applicationIndicator: "A" },
  { mode: "byte", data: "application payload" }
]);
```

`fnc1Second` は `gs1: true` / manual `{ mode: "fnc1" }` と併用できません。SpecQR では現在、ECI と FNC1 second も安全側で reject します。Structured Append とも併用できません。

## Structured Append Low-Level Header

Structured Append は、複数の QR symbols を 1 つの logical message として扱うための QR control mode です。自動分割には `generateStructuredAppend()` を使います。利用者が外部システムと合わせて `index` / `total` / `parity` を明示したい場合は、低レベル header encoding も直接指定できます。

```js
QRCode.generate("PART 2", {
  structuredAppend: {
    index: 2,
    total: 4,
    parity: 0x5a
  },
  output: "svg"
});
```

SpecQR の public API では `index` を 1-based として受け付けます。実際の bit stream では、mode indicator `0011` の後に `(index - 1)` を 4 bits、`(total - 1)` を 4 bits、`parity` を 8 bits で encode します。

manual segment でも同じ header を明示できます。

```js
QRCode.generateSegments([
  { mode: "structured-append", index: 2, total: 4, parity: 0x5a },
  { mode: "byte", data: "PART 2" }
]);
```

`structuredAppend` は `gs1: true` / manual `{ mode: "fnc1" }` / `fnc1Second` / `eci` と併用できません。高レベル API の `generateStructuredAppend()` も同じ安全側の併用制限を持ちます。

詳細な API shape、分割方針、parity policy、diagnostics、error 設計、release gate は [Structured Append v2 API Design](./structured-append-v2.md) を参照してください。

### GS1 Helpers

- `parseGs1HumanReadable(input)`: `(01)04912345678904(10)ABC123(17)251231` のような parentheses-based input を `{ ai, value }[]` に変換します。
- `createGs1ElementString(elements)`: 対応 AI の `{ ai, value }` string entries を検証し、QR input として使う raw GS1 element string を返します。leading zero を保持するため、AI values は string で渡す必要があります。
- `parseGs1ElementString(input)`: raw GS1 element string を `{ elements, hasSeparators }` に読み戻す throwing parser です。
- `getSupportedGs1Ais()`: supported AI catalog を公開 metadata shape で返します。
- `getGs1AiInfo(ai)`: 1 つの supported AI metadata を返します。unsupported AI は `null` です。
- `validateGs1Elements(elements, options?)`: `{ ai, value }[]` を例外なしの result object として検証します。
- `validateGs1ElementString(input, options?)`: raw GS1 element string を例外なしの result object として検証します。
- `createGs1DigitalLink(input, options)`: 対応 AI の element data から GS1 Digital Link URI を返します。これは通常 URL QR 用の helper であり、`gs1: true` は使いません。
- `parseGs1DigitalLink(uri, options?)`: GS1 Digital Link URI から `{ elements, primary, pathElements, queryElements, unknownQuery }` を返します。
- `GS1_FNC1_SEPARATOR`: 可変長 AI の後に別の element が続く場合に挿入される ASCII GS separator `"\x1D"` です。
- `calculateGs1CheckDigit(digits)`: GS1 mod-10 check digit を計算します。
- `validateGs1CheckDigit(digitsWithCheckDigit)`: 末尾 check digit を検証します。
- `calculateGtinCheckDigit(gtinWithoutCheckDigit)`, `appendGtinCheckDigit(gtinWithoutCheckDigit)`, `validateGtinCheckDigit(gtin)`: GTIN-8/12/13/14 向け helper です。
- `calculateSsccCheckDigit(ssccWithoutCheckDigit)`, `appendSsccCheckDigit(ssccWithoutCheckDigit)`, `validateSsccCheckDigit(sscc)`: SSCC 向け helper です。

Human-readable input は、表示・入力しやすさのための `(01)04912345678904(10)ABC123` 形式です。実際に GS1 QR Code として encode する raw GS1 element string は parentheses を含みません。GS1 Digital Link は URL ベースの別表現であり、通常 URL QR として生成します。

Human-readable input を直接 `QRCode.generate(input, { gs1: true })` に渡すと `InvalidGs1Error` になります。`parseGs1HumanReadable()` で `{ ai, value }[]` に変換し、`createGs1ElementString()` で raw GS1 element string を作ってから `gs1: true` に渡してください。

現在 supported AI の一覧、fixed / variable length、check digit validation、Digital Link role、separator behavior は [Supported GS1 AIs](./gs1-supported-ai.md) にまとめています。SpecQR は full GS1 AI catalog や業界別 validation をまだ提供しません。

### `parseGs1ElementString(input)`

外部システムから受け取った raw GS1 element string を、supported AI dictionary に基づいて `{ elements, hasSeparators }` に読み戻します。Human-readable parentheses notation は受け付けません。

```js
import { parseGs1ElementString } from "specqr";

const parsed = parseGs1ElementString("010491234567890410ABC123\x1D17251231");

console.log(parsed);
// {
//   elements: [
//     { ai: "01", value: "04912345678904" },
//     { ai: "10", value: "ABC123" },
//     { ai: "17", value: "251231" }
//   ],
//   hasSeparators: true
// }
```

invalid raw input は `InvalidGs1Error` で reject します。対象は unsupported AI、invalid length、invalid charset、invalid GTIN / SSCC check digit、variable-length AI 後の missing separator、human-readable parentheses direct input です。例外を投げずに検証したい場合は `validateGs1ElementString()` を使ってください。

### GS1 Validation API

既存の throwing API を維持したまま、UI / form validation に向いた non-throwing API と catalog introspection API を提供します。

```ts
getSupportedGs1Ais(): Gs1AiInfo[];
getGs1AiInfo(ai: string): Gs1AiInfo | null;
validateGs1Elements(elements, options?): Gs1ValidationResult;
validateGs1ElementString(input, options?): Gs1ElementStringValidationResult;
```

`getSupportedGs1Ais()` / `getGs1AiInfo(ai)` は `ai`、`label`、fixed / variable length、`valueKind`、check digit rule、Digital Link role、separator requirement を公開 metadata として返します。AI family は concrete AI entries に展開して返し、internal dictionary object はそのまま露出しません。

`validateGs1Elements()` / `validateGs1ElementString()` は成功時に `{ ok: true, elements, warnings }`、失敗時に `{ ok: false, errors, warnings }` を返します。Raw element string validation の成功 result には `hasSeparators` も入ります。Detail error code は `GS1_UNSUPPORTED_AI`、`GS1_INVALID_LENGTH`、`GS1_INVALID_CHARSET`、`GS1_MISSING_SEPARATOR`、`GS1_UNEXPECTED_SEPARATOR`、`GS1_INVALID_CHECK_DIGIT`、`GS1_INVALID_DIGITAL_LINK_PLACEMENT`、`GS1_INVALID_INPUT` です。

```js
import { getGs1AiInfo, validateGs1ElementString } from "specqr";

console.log(getGs1AiInfo("01")?.length); // { type: "fixed", exact: 14 }

const result = validateGs1ElementString("010491234567890410ABC12317251231");
if (!result.ok) {
  console.log(result.errors[0].code); // "GS1_MISSING_SEPARATOR"
}
```

`validateGs1DigitalLink(uri, options?)` は Digital Link full canonicalization / resolver / unknown query policy と関係が深いため公開していません。Digital Link URI は引き続き `parseGs1DigitalLink()` / `createGs1DigitalLink()` の throwing API で扱います。詳細は [GS1 Validation v2.1 Design](./gs1-validation-v2.1.md) を参照してください。

### `createGs1DigitalLink(input, options)`

GS1 element data から GS1 Digital Link URI string を作ります。`input` は `{ ai, value }[]`、または `parseGs1ElementString()` の戻り値 `{ elements, hasSeparators }` を受け付けます。

```js
import { QRCode, createGs1DigitalLink, parseGs1HumanReadable } from "specqr";

const elements = parseGs1HumanReadable("(01)04912345678904(10)ABC123(17)251231");
const uri = createGs1DigitalLink(elements, {
  baseUrl: "https://example.com"
});

console.log(uri);
// "https://example.com/01/04912345678904/10/ABC123?17=251231"

const svg = QRCode.generate(uri, { output: "svg" });
```

`options.baseUrl` は必須です。暗黙の `https://id.gs1.org` default はありません。`baseUrl` は `http` または `https` URL のみ許可し、query / fragment は含められません。末尾 slash は normalize されるため、`https://example.com` と `https://example.com/` は同じ URI を返します。

default では dictionary の Digital Link role metadata を使って path / query を決めます。AI `01` を primary key として path に置き、現行 dictionary では GTIN primary (`01`) の key qualifier として AI `10`、`21`、`22` を path に続けます。それ以外の supported AI は data attribute として query string に置き、AI key の lexical order で並べます。`primaryAi` は `"00" | "01" | "414"`、`pathAis` は AI string array を指定できます。明示した `pathAis` は default placement より優先されますが、dictionary 上 path に置けない AI を指定すると `InvalidGs1Error` になります。

Digital Link URI は URL なので、QR 生成時は `QRCode.generate(uri)` を使います。`QRCode.generate(uri, { gs1: true })` は GS1 element string / FNC1 first position 用であり、Digital Link URI には使いません。

Digital Link 生成時も既存 GS1 validation を使うため、unsupported AI、invalid length、invalid charset、invalid GTIN / SSCC check digit、duplicate AI、invalid `baseUrl` は `InvalidGs1Error` になります。

### `parseGs1DigitalLink(uri, options?)`

GS1 Digital Link URI を GS1 element data に戻します。`uri` は absolute `http` / `https` URL だけを受け付けます。fragment は reject します。path の AI/value pair と query の AI=value を読み、percent-encoded value は decode してから既存 GS1 validation に通します。path 上の primary 以降は Digital Link role metadata でも検証し、data attribute など path に置けない AI は `InvalidGs1Error` で reject します。

```js
import { createGs1DigitalLink, parseGs1DigitalLink } from "specqr";

const parsed = parseGs1DigitalLink(
  "https://example.com/01/04912345678904/10/ABC123?17=251231&linkType=all"
);

console.log(parsed);
// {
//   elements: [
//     { ai: "01", value: "04912345678904" },
//     { ai: "10", value: "ABC123" },
//     { ai: "17", value: "251231" }
//   ],
//   primary: { ai: "01", value: "04912345678904" },
//   pathElements: [
//     { ai: "01", value: "04912345678904" },
//     { ai: "10", value: "ABC123" }
//   ],
//   queryElements: [
//     { ai: "17", value: "251231" }
//   ],
//   unknownQuery: [
//     { key: "linkType", value: "all" }
//   ]
// }

const regenerated = createGs1DigitalLink(parsed, {
  baseUrl: "https://example.com"
});
```

`unknownQuery` には GS1 AI として扱わない query parameter を `{ key, value }` で保持します。数字 2-4 桁の query key は GS1 AI として validation されるため、unsupported AI や invalid value は `InvalidGs1Error` になります。`options.unknownQuery: "reject"` を指定すると、GS1 AI ではない query parameter も reject します。

`options.primaryAi` は `"00" | "01" | "414"` を指定できます。指定しない場合は path 内の最初の supported primary AI を探します。path 上で primary AI より前にある segment は URI stem として扱い、返り値には含めません。

helper が対応する代表 AI は次の範囲です。

- fixed length: `00`, `01`, `02`, `11`, `12`, `13`, `15`, `16`, `17`, `20`, `410` through `415`, `422`, `424`, `425`, `426`, `3100` through `3105`, `3200` through `3205`
- variable length: `10`, `21`, `22`, `30`, `37`, `240`, `241`, `400`, `420`, `91` through `99`

validation は、対応 AI format、fixed/max length、numeric-only AI、printable ASCII text values、raw value 内の separator/parentheses rejection、AI `00` の SSCC check digit、AI `01`/`02` の GTIN check digit を対象にします。可変長 AI の後に別の element が続く場合は `"\x1D"` を挿入し、最後の可変長 AI は separator なしで終端します。

GTIN / SSCC 以外の check digit rule、全 GS1 AI catalog、業界別 AI rule は現在の対象外です。FNC1 second position は GS1 helper ではなく、独立した QR control mode として `fnc1Second` で扱います。

## Return Values

`output` が `"svg"` の場合、`generate()` は SVG string を返します。

`output` が `"matrix"` の場合、二次元 boolean matrix を返します。

`output` が `"svg-data-url"` または `"png-data-url"` の場合、Data URL string を返します。

`output` が `"png"` の場合、PNG `Uint8Array` を返します。

PNG と ImageData output は `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, `"black"`, `"white"`, `"transparent"` colors に対応します。

`diagnostics` が true の場合は次の形を返します。

```js
{
  matrix,
  svg,
  diagnostics: {
    version,
    size,
    errorCorrectionLevel,
    requestedErrorCorrectionLevel,
    boostedErrorCorrection,
    versionSelection,
    versionSelectionReason,
    maskPattern,
    maskPenalty,
    maskPenalties,
    maskSelectionReason,
    mode,
    controlSegments,
    eciAssignmentNumber,
    fnc1,
    fnc1Second,
    structuredAppend,
    gs1,
    gs1Validation,
    segments,
    dataBitLength,
    capacityBits,
    remainingBits,
    capacityUtilization,
    inputBytes,
    dataCodewords,
    errorCorrectionCodewords,
    totalCodewords,
    quietZone,
    colors,
    print,
    warnings
  }
}
```

`diagnostics.controlSegments` は Structured Append / ECI / FNC1 first / FNC1 second の control segment ordering を表します。`diagnostics.fnc1` は `null`、`"first-position"`、`"second-position"` のいずれかです。`diagnostics.fnc1Second` は `{ enabled, applicationIndicator, applicationIndicatorCodeword }` です。`diagnostics.structuredAppend` は `{ enabled, index, total, parity, sequenceIndex, sequenceTotal, sequenceIndicator }` です。`sequenceIndex` と `sequenceTotal` は bit stream に入る 0-based values です。

`diagnostics.gs1` は v1 互換の boolean です。`diagnostics.gs1Validation` は追加 metadata で、shape は `{ enabled, elementCount, ais, hasSeparators }` です。`generate(input, { gs1: true })` の raw string path では `elementCount` と `ais` が入ります。manual `{ mode: "fnc1" }` path では raw element string validation を行わないため、`elementCount` は `null` になります。

## Node Helpers

`specqr/node` subpath は Node-only の file / Buffer helper を core entrypoint から分離します。

```js
import { toPngBuffer, writePngFile } from "specqr/node";

const buffer = toPngBuffer("https://example.com");
await writePngFile("qr.png", "https://example.com");
```

利用可能な helper:

- `toPngBuffer(input, options)`
- `toPngBufferFromSegments(segments, options)`
- `writePngFile(path, input, options)`
- `writePngFileFromSegments(path, segments, options)`

## Browser Helpers

`specqr/browser` subpath は browser convenience helper を提供します。

```js
import { toBlob, toImageData, toObjectURL } from "specqr/browser";

const blob = toBlob("https://example.com");
const imageData = toImageData("https://example.com");
const objectUrl = toObjectURL("https://example.com");
```

利用可能な helper:

- `toBlob(input, options)`
- `toBlobFromSegments(segments, options)`
- `toObjectURL(input, options)`
- `toObjectURLFromSegments(segments, options)`
- `toImageData(input, options)`
- `toImageDataFromSegments(segments, options)`

## Errors

SpecQR は安定した error class と `code` field を export します。

- `DataTooLongError`
- `InvalidInputError`
- `InvalidVersionError`
- `InvalidModeError`
- `InvalidColorError`
- `InvalidEciError`
- `InvalidGs1Error`
- `InvalidOutputError`
- `InvalidCanvasTargetError`
