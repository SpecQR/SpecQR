# Structured Append Manual Segments Parity Helper v2.3

この文書は、manual segments 用 Structured Append parity helper の SpecQR 2.3.0 public API と実装範囲を記録します。2.3.0 release package では、この helper を stable API として公開します。

Raw input 用の `calculateStructuredAppendParity(input)` は実装済みです。一方、manual segments を低レベル `{ mode: "structured-append", index, total, parity }` と組み合わせて自分で chunking する利用者は、`generateSegmentsStructuredAppend()` と同じ manual segment byte policy で parity を計算できる helper があると安全です。この文書では、その public API、byte policy、reject 方針、検証範囲を固定します。

## Status

- `calculateStructuredAppendSegmentsParity()` は root named export です。
- `QRCode.calculateStructuredAppendSegmentsParity()` は同じ実装を呼ぶ static method です。
- TypeScript declaration と packed package smoke で公開 surface を固定しています。
- 既存 `generateSegmentsStructuredAppend()` は引き続き parity を自動計算します。

## Public API

```ts
function calculateStructuredAppendSegmentsParity(
  segments: QRSegmentInput[],
  options?: QRStructuredAppendSegmentsParityOptions
): number;

class QRCode {
  static calculateStructuredAppendSegmentsParity(
    segments: QRSegmentInput[],
    options?: QRStructuredAppendSegmentsParityOptions
  ): number;
}

interface QRStructuredAppendSegmentsParityOptions {}
```

Return value は `0..255` の integer です。

`options` は初期実装では将来拡張用の空 object として扱います。`undefined` または `{}` だけを受け付け、未知 key は reject します。ECI / GS1 / FNC1 併用や alternate encoding を options で足すことは初期 scope に含めません。

TypeScript declaration:

```ts
export interface QRStructuredAppendSegmentsParityOptions {}

export function calculateStructuredAppendSegmentsParity(
  segments: QRSegmentInput[],
  options?: QRStructuredAppendSegmentsParityOptions
): number;

export class QRCode {
  static calculateStructuredAppendSegmentsParity(
    segments: QRSegmentInput[],
    options?: QRStructuredAppendSegmentsParityOptions
  ): number;
}
```

## Parity Target

Parity の対象は、`generateSegmentsStructuredAppend()` が分割前に扱う canonical logical message bytes です。

対象にしないもの:

- QR encoded bitstream。
- mode indicator。
- character count indicator。
- terminator / padding。
- data codewords。
- Reed-Solomon error correction codewords。
- low-level Structured Append header bytes。

つまり、この helper は「manual segment list が表す logical payload bytes の XOR」を返します。これは QR bitstream の XOR ではありません。

## Segment Byte Policy

初期実装は `generateSegmentsStructuredAppend()` の現在の canonical payload byte stream と必ず一致させます。

| Segment | Parity bytes |
| --- | --- |
| `{ mode: "numeric", data/text }` | validated string の ASCII bytes。 |
| `{ mode: "alphanumeric", data/text }` | validated string の ASCII bytes。 |
| `{ mode: "byte", data/text: string }` | JavaScript string を UTF-8 bytes にしたもの。 |
| `{ mode: "byte", data/bytes: Uint8Array | ArrayBuffer | ArrayBufferView | number[] }` | raw bytes。`ArrayBufferView` は `byteOffset` / `byteLength` を尊重。`number[]` は `0..255` integer のみ。 |
| `{ mode: "kanji", data/text }` | original JavaScript string を UTF-8 bytes にしたもの。 |

Kanji segment は QR encoding 時には Shift_JIS-compatible QR Kanji mode として bitstream 化されますが、Structured Append parity では original logical payload bytes を対象にします。そのため、Kanji segment の parity bytes は Shift_JIS bytes ではなく UTF-8 bytes です。これは `generateSegmentsStructuredAppend()` の現行 policy と一致します。

Numeric / alphanumeric segment は QR の内部 bit grouping ではなく、caller が渡した validated characters の ASCII bytes として扱います。

## Accepted Segment Scope

初期実装で accepted とする segment は data segment だけです。

- `{ mode: "numeric", data: string }`
- `{ mode: "numeric", text: string }`
- `{ mode: "alphanumeric", data: string }`
- `{ mode: "alphanumeric", text: string }`
- `{ mode: "byte", data: string | Uint8Array | ArrayBuffer | ArrayBufferView | number[] }`
- `{ mode: "byte", text: string }`
- `{ mode: "byte", bytes: Uint8Array | ArrayBuffer | ArrayBufferView | number[] }`
- `{ mode: "kanji", data: string }`
- `{ mode: "kanji", text: string }`

Control segment は初期実装では reject します。

- `{ mode: "eci", ... }`
- `{ mode: "fnc1" }`
- `{ mode: "fnc1-second", ... }`
- `{ mode: "structured-append", ... }`

理由は、これらは logical payload bytes ではなく QR control metadata だからです。特に low-level `{ mode: "structured-append" }` を含めると、この helper が計算する parity と、その structured-append segment 自体が保持する parity の責務が循環します。

## GS1 / FNC1 / ECI Policy

初期実装では ECI / FNC1 / GS1 / FNC1 second をすべて reject します。

- ECI: byte interpretation metadata であり、logical payload bytes そのものではない。
- FNC1 first / GS1: FNC1 separator と GS1 element string validation の責務が絡むため、GS1-specific helper として別設計にする。
- FNC1 second: Application Indicator は QR control metadata であり、payload bytes と混ぜない。
- `structuredAppend`: parity helper が計算する対象ではなく、低レベル header 自体。

将来 GS1 manual segments parity を扱う場合は、raw GS1 element string helper、FNC1 separator policy、`gs1: true` generation policy と合わせて別文書で固定します。

## Error Behavior

初期実装の error class は `generateSegmentsStructuredAppend()` と揃えます。

- `InvalidInputError`
  - `segments` が配列ではない。
  - `segments` が空。
  - non-empty data segment がない。
  - byte array に integer でない値、`NaN`、`Infinity`、`0..255` 外の値がある。
  - `options` が object ではない。
- `InvalidModeError`
  - unsupported segment mode。
  - manual `eci`、`fnc1-second`、`structured-append` segment。
  - unknown `options` key。
  - mode-specific validation failure が既存 manual segment validation で `InvalidModeError` になる場合。
- `InvalidGs1Error`
  - manual `{ mode: "fnc1" }` segment。
  - `gs1` option 相当が渡された場合。

既存 `normalizeManualSegments()` がより具体的な error を投げる場合は、その error を優先します。

Empty string segment や empty byte segment は、`generateSegmentsStructuredAppend()` と同じく non-empty split unit を作らないものとして扱います。全体として non-empty data がなければ `InvalidInputError` です。

## High-Level API Consistency

次は常に true であるべきです。

```js
const segments = [
  { mode: "alphanumeric", data: "ORDER-" },
  { mode: "numeric", data: "1234567890" },
  { mode: "byte", data: new Uint8Array([0xde, 0xad, 0xbe, 0xef]) },
  { mode: "kanji", data: "漢字" }
];

const set = QRCode.generateSegmentsStructuredAppend(segments, {
  version: 1,
  errorCorrectionLevel: "L"
});

const parity = QRCode.calculateStructuredAppendSegmentsParity(segments);

console.log(set.parity === parity); // true
```

`generateSegmentsStructuredAppend()` が auto version、fixed version、fixed mask、diagnostics のどれを使っても、same segment list の `parity` は helper と一致します。Version、ECC、mask、renderer は parity に影響しません。

## Low-Level Usage Example

利用者が manual segment chunks を自分で分ける場合、parity は chunk ごとではなく logical segment list 全体から計算します。

```js
import { QRCode, calculateStructuredAppendSegmentsParity } from "specqr";

const logicalSegments = [
  { mode: "alphanumeric", data: "ORDER-" },
  { mode: "numeric", data: "12345678901234567890" }
];

const parity = calculateStructuredAppendSegmentsParity(logicalSegments);

const first = QRCode.generateSegments([
  { mode: "structured-append", index: 1, total: 2, parity },
  { mode: "alphanumeric", data: "ORDER-" }
]);

const second = QRCode.generateSegments([
  { mode: "structured-append", index: 2, total: 2, parity },
  { mode: "numeric", data: "12345678901234567890" }
]);
```

この例では、`first` と `second` に渡す parity は同一です。各 chunk の parity を個別に計算してはいけません。

## Difference From `calculateStructuredAppendParity(input)`

`calculateStructuredAppendParity(input)` は string / binary input 用です。

```js
calculateStructuredAppendParity("ORDER-123");
calculateStructuredAppendParity(new Uint8Array([0x4f, 0x52]));
```

`calculateStructuredAppendSegmentsParity(segments)` は manual segment list 用です。

```js
calculateStructuredAppendSegmentsParity([
  { mode: "alphanumeric", data: "ORDER-" },
  { mode: "numeric", data: "123" }
]);
```

単純な ASCII string だけなら両者の結果が同じになることはありますが、API の目的は異なります。Manual segments helper は caller-selected modes、byte segment binary data、Kanji segment の validation を尊重します。

## Relationship To `mergeStructuredAppendParts()`

`calculateStructuredAppendSegmentsParity()` は generation 前の logical manual segment list に使います。

`mergeStructuredAppendParts()` は decoder が返した `{ index, total, parity, data }` parts を scan 後に検証します。

両者は同じ XOR policy に寄せていますが、入力の抽象度は違います。

- Segments parity helper: manual segment list -> canonical logical bytes -> XOR。
- Merge helper: decoded string/binary parts -> merged payload bytes -> XOR。

Manual segment boundaries は decoder output には残らないため、`mergeStructuredAppendParts()` が manual segment list を復元することはありません。

## Implementation Notes

実装は、`src/index.js` に既にある `generateSegmentsStructuredAppend()` 用の manual segment normalization と canonical byte extraction に寄せています。責務分離は次の通りです。

- manual segment normalization: existing `normalizeManualSegments()` を使う。
- control segment rejection: `generateSegmentsStructuredAppend()` と同じ helper を共有するか、同じ table-driven validation に寄せる。
- canonical byte extraction: `generateSegmentsStructuredAppend()` と `calculateStructuredAppendSegmentsParity()` が同じ `getStructuredAppendSegmentCanonicalBytes(segment)` policy を使う。
- XOR: existing `calculateStructuredAppendByteParity(bytes)` を使う。

これにより、`generateSegmentsStructuredAppend().parity` と public helper が drift しないようにします。

## Implemented Test Coverage

実装に合わせて追加した tests:

- root export `calculateStructuredAppendSegmentsParity` が存在する。
- `QRCode.calculateStructuredAppendSegmentsParity` static method が存在する。
- numeric segment ASCII parity。
- alphanumeric segment ASCII parity。
- byte string segment UTF-8 parity。
- byte binary segment raw byte parity。
- `ArrayBufferView` offset / length parity。
- byte `number[]` validation。
- Kanji segment UTF-8 parity。
- mixed numeric / alphanumeric / byte / kanji parity。
- empty input rejection。
- all-empty segment rejection。
- ECI / FNC1 first / FNC1 second / structured-append segment rejection。
- invalid segment mode rejection。
- invalid options object / unknown option rejection。
- `generateSegmentsStructuredAppend(segments).parity` と一致。
- low-level manual structured-append chunks に同じ parity を渡す docs example。
- TypeScript consumer check。
- packed package smoke。

Golden fixture は原則不要です。この helper は matrix を生成しないため、unit / type / packed smoke と既存 Structured Append golden fixture の非変化確認で十分です。

## Rejected Choices

- QR encoded bitstream を XOR する: Structured Append parity は logical message bytes の helper として固定するため不採用。
- Kanji segment を Shift_JIS bytes で XOR する: 現行 `generateSegmentsStructuredAppend()` の canonical payload byte stream と一致しないため不採用。
- ECI / FNC1 / GS1 を初期実装で受け付ける: control metadata と payload bytes の責務が混ざるため不採用。
- low-level `{ mode: "structured-append" }` segment を無視する: caller の入力ミスを隠すため不採用。
- `calculateStructuredAppendParityFromSegments()` という別名: root helper が `calculateStructuredAppendParity()` であるため、manual segments 版は `calculateStructuredAppendSegmentsParity()` の方が API family として自然。

## Non-Scope

- `generateSegmentsStructuredAppend()` の分割戦略変更。
- `calculateStructuredAppendParity()` の挙動変更。
- ECI / GS1 / FNC1 / FNC1 second 併用対応。
- manual segments の mid-segment splitting 追加。
- QR decoder / scanner integration。
- npm publish / GitHub Release / Pages deploy。
- runtime dependency 追加。

## Release Gate

この helper の release gate は次を含めます。

- `npm test`
- `npm run verify:types`
- `npm run examples:smoke`
- `npm run pages:build`
- `npm run verify:decode`
- `npm run verify:decode:jsqr`
- `npm run verify:reference:nayuki`
- `npm run verify:pack`
- `npm pack --dry-run --cache /private/tmp/specqr-npm-cache`
- `npm ls --omit=dev`
- `git diff --check`
- GitHub Actions green

2.3.0 release package では package version を更新しますが、npm publish、GitHub Release、Pages deploy は公開フェーズまで行いません。
