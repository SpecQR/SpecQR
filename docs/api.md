# API

この文書は SpecQR `1.0.0` の公開 API を説明します。API 名、option 名、型名、error class 名は JavaScript/TypeScript から利用する識別子なので英語のままです。

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
  diagnostics: false,
  printDpi: null
});
```

### `QRCode.generateSegments(segments, options)`

呼び出し側が明示した segment から QR Code を生成します。対応する segment mode は `fnc1`, `eci`, `numeric`, `alphanumeric`, `byte`, `kanji` です。

```js
QRCode.generateSegments([
  { mode: "alphanumeric", data: "ORDER-" },
  { mode: "numeric", data: "1234567890" },
  { mode: "kanji", data: "漢字" },
  { mode: "byte", data: new Uint8Array([0x41, 0x42, 0x43]) }
]);
```

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
- `gs1`: boolean。default は `false`。`true` の場合、GS1 QR Code 用に QR FNC1 first position (`0101`) を先頭に挿入します。この実装では ECI と併用できません。
- `diagnostics`: `true` の場合、生成詳細と warnings を返します。
- `printDpi`: print-size diagnostics のための optional DPI。生成結果そのものには影響しません。

## GS1 / FNC1 First Position

`gs1: true` は、入力が raw GS1 element string である場合に使います。QR Code の FNC1 first position mode indicator を先頭に挿入し、通常テキスト QR ではなく GS1 QR Code として decode されることを意図します。

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

### GS1 Helpers

- `parseGs1HumanReadable(input)`: `(01)04912345678904(10)ABC123(17)251231` のような parentheses-based input を `{ ai, value }[]` に変換します。
- `createGs1ElementString(elements)`: 対応 AI の `{ ai, value }` string entries を検証し、QR input として使う raw GS1 element string を返します。leading zero を保持するため、AI values は string で渡す必要があります。
- `GS1_FNC1_SEPARATOR`: 可変長 AI の後に別の element が続く場合に挿入される ASCII GS separator `"\x1D"` です。
- `calculateGs1CheckDigit(digits)`: GS1 mod-10 check digit を計算します。
- `validateGs1CheckDigit(digitsWithCheckDigit)`: 末尾 check digit を検証します。
- `calculateGtinCheckDigit(gtinWithoutCheckDigit)`, `appendGtinCheckDigit(gtinWithoutCheckDigit)`, `validateGtinCheckDigit(gtin)`: GTIN-8/12/13/14 向け helper です。
- `calculateSsccCheckDigit(ssccWithoutCheckDigit)`, `appendSsccCheckDigit(ssccWithoutCheckDigit)`, `validateSsccCheckDigit(sscc)`: SSCC 向け helper です。

Human-readable input は、表示・入力しやすさのための `(01)04912345678904(10)ABC123` 形式です。実際に QR に encode する raw GS1 element string は parentheses を含みません。GS1 Digital Link は URL ベースの別表現であり、現時点では専用 helper / validator を提供していません。

helper が対応する代表 AI は次の範囲です。

- fixed length: `00`, `01`, `02`, `11`, `12`, `13`, `15`, `16`, `17`, `20`, `410` through `415`, `422`, `424`, `425`, `426`, `3100` through `3105`, `3200` through `3205`
- variable length: `10`, `21`, `22`, `30`, `37`, `240`, `241`, `400`, `420`, `91` through `99`

validation は、対応 AI format、fixed/max length、numeric-only AI、printable ASCII text values、raw value 内の separator/parentheses rejection、AI `00` の SSCC check digit、AI `01`/`02` の GTIN check digit を対象にします。可変長 AI の後に別の element が続く場合は `"\x1D"` を挿入し、最後の可変長 AI は separator なしで終端します。

GTIN / SSCC 以外の check digit rule、全 GS1 AI catalog、業界別 AI rule、FNC1 second position は v1 の対象外です。

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
    eciAssignmentNumber,
    fnc1,
    gs1,
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
