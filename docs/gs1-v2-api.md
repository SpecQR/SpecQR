# GS1 v2 API

この文書は、SpecQR v2 系で公開する GS1 raw element string parser API の設計記録です。`parseGs1ElementString(input)` は root export と `QRCode.parseGs1ElementString(input)` static method として実装済みです。`validateGs1ElementString()`、GS1 Digital Link、FNC1 second position、Structured Append はまだ公開していません。

v1 の public API は次の役割を持ちます。

- `parseGs1HumanReadable(input)`: `(01)04912345678904(10)ABC123` のような parentheses-based human-readable notation を `{ ai, value }[]` に変換する。
- `createGs1ElementString(elements)`: `{ ai, value }[]` から QR に encode する raw GS1 element string を作る。必要な ASCII GS separator (`"\x1D"`) を挿入する。
- `generate(data, { gs1: true })`: raw GS1 element string を検証し、QR FNC1 first position を付けて GS1 QR Code を生成する。

v2 では、この 3 つに加えて「すでに存在する raw GS1 element string を読み戻す」API として `parseGs1ElementString(input)` を公開します。

## Public API

公開 API は `parseGs1ElementString(input)` です。

```ts
function parseGs1ElementString(input: string): {
  elements: Array<{ ai: string; value: string }>;
  hasSeparators: boolean;
};
```

戻り値は小さく保ちます。

- `elements`: supported AI dictionary に基づいて読めた `{ ai, value }[]`。
- `hasSeparators`: input に ASCII GS separator (`"\x1D"`) が含まれていたかどうか。

AI label、length rule、check digit rule などの internal dictionary metadata は、初期 public API では返しません。必要になった場合は、将来の minor / major で options を追加する案を別途検討します。

```ts
// Future option candidate. Not implemented.
parseGs1ElementString(input, {
  diagnostics: true
});
```

`validateGs1ElementString(input)` は、第一弾の public API には含めない方針です。理由は、`parseGs1ElementString(input)` が成功すれば validation 済みの `elements` を返し、失敗時は `InvalidGs1Error` を throw するためです。利用者が boolean-only convenience を強く求める場合に限り、次の形を候補にします。

```ts
// Deferred convenience API candidate. Not implemented.
function validateGs1ElementString(input: string): true;
```

この候補は internal API と同じく、valid なら `true`、invalid なら `InvalidGs1Error` を throw します。`false` を返す API にはしません。失敗理由を捨てると、unsupported AI、missing separator、check digit error を利用者が区別しにくくなるためです。

## Relationship To Existing APIs

Human-readable notation から GS1 QR Code を作る場合は、v1 と同じ flow を使います。

```js
import { QRCode, createGs1ElementString, parseGs1HumanReadable } from "specqr";

const elements = parseGs1HumanReadable("(01)04912345678904(10)ABC123(17)251231");
const data = createGs1ElementString(elements);

const svg = QRCode.generate(data, {
  gs1: true,
  output: "svg"
});
```

raw parser は、外部システムから受け取った raw GS1 element string を読み戻す用途です。

```js
import { parseGs1ElementString } from "specqr";

const parsed = parseGs1ElementString("010491234567890410ABC123\u001D17251231");

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

`generate(data, { gs1: true })` は引き続き generation API です。raw string を検証して QR を生成しますが、parse result を返す API ではありません。parse result が必要な場合は `parseGs1ElementString()` を呼び出してください。

## Error Behavior

`parseGs1ElementString(input)` は invalid raw input を `InvalidGs1Error` で reject します。

```js
parseGs1ElementString("(01)04912345678904");
// InvalidGs1Error: raw parser input must not include human-readable parentheses.
// Use parseGs1HumanReadable() and createGs1ElementString() for parentheses notation.

parseGs1ElementString("010491234567890410ABC12317251231");
// InvalidGs1Error: missing FNC1 separator before the next supported fixed-length AI.

parseGs1ElementString("250ABC");
// InvalidGs1Error: unsupported AI.

parseGs1ElementString("010491234567890");
// InvalidGs1Error: invalid fixed-length value length.

parseGs1ElementString("10ロット1");
// InvalidGs1Error: invalid character set.

parseGs1ElementString("0104912345678905");
// InvalidGs1Error: invalid GTIN check digit.

parseGs1ElementString("00123456789012345670");
// InvalidGs1Error: invalid SSCC check digit.
```

Human-readable input と raw element string は別 API で扱います。raw parser は parentheses を自動的に解釈しません。これは `parseGs1HumanReadable()` と責務を分け、ユーザー入力用 notation と QR payload 用 notation を混同しないためです。

## Ambiguity Policy

raw GS1 element string は parentheses を含まないため、AI の切り出しが曖昧になり得ます。v2 parser は次の規則で安全側に倒します。

- fixed-length AI は supported AI dictionary の exact length で読む。
- variable-length AI は ASCII GS separator (`"\x1D"`) まで読む。
- final variable-length AI は separator なしを許可する。
- variable-length AI の後に別 element が続く場合、separator が必要。
- final variable-length value の末尾が supported fixed-length AI として完全に読める場合、推測で分割せず missing separator として reject する。
- unsupported AI は推測せず reject する。

例えば次は reject します。

```js
parseGs1ElementString("010491234567890410ABC12317251231");
```

`10` は variable-length AI です。`ABC12317251231` 全体を AI `10` の value として final element にすることも技術的には可能ですが、suffix の `17` + `251231` は supported fixed-length AI として完全に読めます。この場合、SpecQR は「separator が抜けている可能性が高い」と判断し、勝手に分割しません。

正しい raw element string は次のように ASCII GS separator を含みます。

```js
"010491234567890410ABC123\u001D17251231"
```

## Rejected Alternatives

- `parseGs1ElementString(input)` が `{ ai, value }[]` だけを返す案: separator の有無を利用者が確認できず、round-trip diagnostics として弱いため見送ります。
- raw parser が human-readable parentheses notation も受ける案: `parseGs1HumanReadable()` と責務が重なり、入力形式の誤用を隠してしまうため見送ります。
- variable-length AI の suffix を自動推測で分割する案: 一見便利ですが、raw GS1 payload の曖昧性をライブラリが勝手に解釈することになるため見送ります。
- public return value に dictionary metadata を含める案: v2 初期 API としては surface が大きすぎ、dictionary 拡張時の互換性制約も強くなるため見送ります。
- `validateGs1ElementString(input)` が `false` を返す案: error reason が失われ、実務での修正導線が弱くなるため見送ります。

## Non-Scope For This API

- package exports の変更
- public `validateGs1ElementString()`
- full GS1 AI catalog
- GS1 Digital Link
- FNC1 second position
- Structured Append
- Micro QR / rMQR
- logo overlay / styled modules
- npm publish / GitHub Release
