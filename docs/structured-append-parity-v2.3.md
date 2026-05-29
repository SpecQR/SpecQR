# Structured Append Parity Helper v2.3

この文書は、SpecQR 2.3.0 の Structured Append polish release で追加した public parity helper の設計と実装範囲を記録します。2.3.0 release package では、この helper を stable API として公開します。

`generateStructuredAppend()` と `generateSegmentsStructuredAppend()` は parity を自動計算します。一方、低レベル API の `structuredAppend: { index, total, parity }` または manual `{ mode: "structured-append", index, total, parity }` を直接使う利用者は、同じ logical message のすべての symbols に同じ parity を渡す必要があります。v2.3.0 では、その計算を `calculateStructuredAppendParity(input)` として提供します。

## Goal

`calculateStructuredAppendParity(input)` は、QR Structured Append で使う 8-bit parity value を、元 payload bytes から計算します。

この helper の目的は次です。

- 低レベル `structuredAppend` header API を使う利用者が parity を手計算しなくて済むようにする。
- `generateStructuredAppend()` が返す `parity` と同じ値を、同じ input から再現できるようにする。
- `mergeStructuredAppendParts()` の payload parity validation と同じ byte policy を docs と tests で固定する。
- ArrayBufferView の `byteOffset` / `byteLength` など、実務で壊れやすい入力境界を public contract として明確にする。

## Public API

この文書で扱う public API は次です。

```ts
function calculateStructuredAppendParity(input: QRStructuredAppendParityInput): number;

class QRCode {
  static calculateStructuredAppendParity(input: QRStructuredAppendParityInput): number;
}

type QRStructuredAppendParityInput =
  | string
  | Uint8Array
  | ArrayBuffer
  | ArrayBufferView
  | readonly number[];
```

Return value は `0..255` の integer です。

`number[]` は既存 binary input と同じく byte array として扱います。TypeScript では `ArrayBufferView` を受けるため、`DataView`、typed array、subarray が利用できます。

### Options

初期 API では options object を追加しません。

```ts
calculateStructuredAppendParity(input);
```

`string` は常に UTF-8 bytes として扱います。SpecQR の既存 `generate()` / `generateStructuredAppend()` と同じく、現行 encoding は `"utf-8"` だけです。そのため `{ encoding?: "utf-8" }` は実質的な選択肢を増やさず、v2.3.0 では入れません。

将来、異なる input policy が必要になった場合でも、`calculateStructuredAppendParity(input, options?)` の第 2 引数は後方互換で追加できます。

## Parity Calculation Policy

QR Structured Append の parity は、logical message の original payload bytes を XOR した 8-bit value として扱います。

Rules:

- `string`: JavaScript string を UTF-8 bytes に変換して XOR する。
- `Uint8Array`: view の visible bytes だけを XOR する。
- `ArrayBuffer`: buffer 全体の bytes を XOR する。
- `ArrayBufferView`: `byteOffset` と `byteLength` を尊重し、view が指す bytes だけを XOR する。
- `number[]`: 各要素を byte として validate し、`0..255` の値を XOR する。
- empty input: `0` を返す。

Algorithm:

```js
let parity = 0;
for (const byte of payloadBytes) {
  parity ^= byte;
}
return parity;
```

この policy は QR bit stream の data codewords や mode indicator を XOR するものではありません。呼び出し側が渡した original payload bytes を対象にします。

## High-Level API Consistency

次の値は一致しなければなりません。

```js
const input = "A".repeat(31);

const set = QRCode.generateStructuredAppend(input, {
  version: 1,
  errorCorrectionLevel: "L",
  mode: "alphanumeric"
});

const parity = QRCode.calculateStructuredAppendParity(input);

console.log(set.parity === parity); // true
```

Binary input でも同じです。

```js
const bytes = new Uint8Array([0x00, 0xff, 0x41, 0x42]);

const set = QRCode.generateStructuredAppend(bytes, {
  version: 1,
  errorCorrectionLevel: "L"
});

console.log(set.parity === QRCode.calculateStructuredAppendParity(bytes)); // true
```

`ArrayBufferView` の offset は、`generateStructuredAppend()` と helper の両方で同じように尊重します。

```js
const source = new Uint8Array([0xaa, 0x10, 0x20, 0xbb]);
const view = source.subarray(1, 3);

console.log(QRCode.calculateStructuredAppendParity(view)); // 0x10 ^ 0x20
```

## Low-Level Structured Append Example

低レベル API では、利用者が chunk と metadata を自分で管理します。Logical message 全体から parity を計算してから、各 symbol に同じ値を渡します。

```js
import { QRCode, calculateStructuredAppendParity } from "specqr";

const message = "PART 1PART 2";
const parity = calculateStructuredAppendParity(message);

const first = QRCode.generate("PART 1", {
  structuredAppend: { index: 1, total: 2, parity },
  output: "svg"
});

const second = QRCode.generate("PART 2", {
  structuredAppend: { index: 2, total: 2, parity },
  output: "svg"
});
```

この例では、`parity` は各 chunk ではなく、結合前の logical message 全体から計算します。chunk ごとの XOR を渡すと、Structured Append set として不整合になります。

## Manual Segments Policy

manual segments 専用 helper は [Structured Append Manual Segments Parity Helper v2.3](./structured-append-segments-parity-v2.3.md) として実装済みです。API 名は次です。

```ts
calculateStructuredAppendSegmentsParity(
  segments: QRSegmentInput[],
  options?: QRStructuredAppendSegmentsParityOptions
): number;
```

この helper は、`generateSegmentsStructuredAppend()` の canonical payload byte stream と完全一致します。numeric / alphanumeric は ASCII bytes、byte string は UTF-8 bytes、byte binary は raw bytes、Kanji は original JavaScript string の UTF-8 bytes を使います。ECI / FNC1 / GS1 / FNC1 second / low-level `structured-append` は初期 scope では reject します。

## Merge Helper Consistency

`mergeStructuredAppendParts(parts)` は、decoder が返した parts を `index` 順に結合し、結合後 payload bytes の XOR が metadata の `parity` と一致するか検証します。v2.3.0 helper は、この validation と同じ byte policy を使います。

```js
const payload = "A".repeat(31);
const parity = QRCode.calculateStructuredAppendParity(payload);

const merged = QRCode.mergeStructuredAppendParts([
  { index: 2, total: 2, parity, data: "A".repeat(10) },
  { index: 1, total: 2, parity, data: "A".repeat(21) }
]);

console.log(merged.diagnostics.parityCheck.matches); // true
```

Binary parts でも同じく、結合後 `Uint8Array` bytes の XOR を使います。

## Error Behavior

`calculateStructuredAppendParity(input)` は generation API ではありませんが、input normalization は既存 binary input と揃えます。

- `InvalidInputError`
  - `input` が string / byte array / `Uint8Array` / `ArrayBuffer` / `ArrayBufferView` ではない。
  - `number[]` に integer でない値、`NaN`、`Infinity`、`0..255` 外の値がある。
  - `ArrayBufferView` の bytes を取得できない platform object が渡された。

Empty string、empty `Uint8Array`、empty `ArrayBuffer` は valid input とし、`0` を返します。Structured Append set として empty payload が有効という意味ではありません。これは parity helper が純粋な byte calculation helper であるためです。実際の Structured Append generation では、既存どおり 2 個以上の non-empty symbols が必要です。

## Internal Implementation Sharing

runtime では parity algorithm を `src/structured-append.js` の shared helper に寄せています。

実装方針:

- `src/structured-append.js` に `calculateStructuredAppendByteParity(bytes)` を置く。
- `generateStructuredAppend()` の string / binary parity calculation はこの helper を使う。
- `generateSegmentsStructuredAppend()` の canonical byte stream parity calculation も同じ low-level XOR helper を使う。
- `mergeStructuredAppendParts()` の parity validation も同じ XOR helper を使う。
- public `calculateStructuredAppendParity(input)` は、input normalization と error mapping を行ったうえで同じ XOR helper を呼ぶ。

この shared implementation により、high-level generation、low-level helper、merge validation が別々に drift することを防ぎます。

## TypeScript Declaration

`src/index.d.ts` には次を追加しています。

```ts
export type QRStructuredAppendParityInput =
  QRInput;

export function calculateStructuredAppendParity(input: QRStructuredAppendParityInput): number;

export class QRCode {
  static calculateStructuredAppendParity(input: QRStructuredAppendParityInput): number;
}
```

現行 declaration では、既存 binary input policy と同じ入力型を明示するため `QRStructuredAppendParityInput = QRInput` としています。

## Implemented Test Coverage

追加した主なテスト:

- root export `calculateStructuredAppendParity` が存在する。
- `QRCode.calculateStructuredAppendParity` static method が存在する。
- ASCII string parity。
- UTF-8 multi-byte string parity。
- `Uint8Array` parity。
- `ArrayBuffer` parity。
- `ArrayBufferView` offset / length parity。
- `number[]` parity。
- empty input returns `0`。
- invalid input throws `InvalidInputError`。
- invalid byte array value throws `InvalidInputError`。
- `generateStructuredAppend(input).parity` と helper が一致する。
- `generateStructuredAppend(ArrayBufferView).parity` と helper が一致する。
- `mergeStructuredAppendParts()` の successful parity check と helper が一致する。
- packed package smoke で root export と `QRCode` static method が動く。
- TypeScript consumer check で return type が `number` として扱える。

追加 golden fixture は原則不要です。helper は matrix を生成しないため、unit / packed / type smoke で十分です。ただし helper 導入で `generateStructuredAppend()` の internal parity implementation を共有化する場合は、既存 Structured Append golden fixture が変わらないことを確認します。

## Docs Updated In v2.3.0 Implementation

実装に合わせて次を更新しました。

- `README.md`: low-level `structuredAppend` の直前に helper usage を短く追加。
- `docs/api.md`: stable API として `calculateStructuredAppendParity()` を追加。
- `docs/structured-append-v2.md`: high-level parity policy から helper へリンク。
- `docs/structured-append-segments-v2.md`: manual segments 専用 helper は後続と明記。
- `docs/spec-scope.md` / `docs/conformance.md`: public parity helper を Supported / Tested に移す。
- `docs/test-plan.md`: unit / packed / type smoke coverage を追加。

## Rejected Choices

- `calculateStructuredAppendParity(input, { encoding: "utf-8" })`: 現在 `"utf-8"` 以外の選択肢がないため初期 API では不要。
- chunk array を受け取って自動結合する helper: parity は logical payload bytes の XOR なので、chunking helper にすると low-level API の責務と混ざる。利用者は元 message を渡すか、自分で結合した bytes を渡す。
- ECI / GS1 / FNC1 と manual segments parity helper の併用を同時に追加する: control metadata と logical payload bytes の責務が混ざるため後回し。
- `validateStructuredAppendParity(parts)` を追加する: 既に `mergeStructuredAppendParts()` が metadata validation を担当しているため、v2.3.0 の scope には入れない。

## Non-Scope

- manual segments 用 parity helper の挙動変更。
- `generateStructuredAppend()` の分割戦略変更。
- `mergeStructuredAppendParts()` の挙動変更。
- QR decoder / scanner integration。
- ECI / GS1 / FNC1 併用追加。
- Micro QR / rMQR。
- npm publish / GitHub Release / Pages deploy。
- runtime dependency 追加。

## Release Gate For Implementation

この変更の release gate は次です。

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

この helper は matrix を生成しませんが、実装共有により Structured Append generation / merge validation と drift しないことを上記 gate で確認します。
