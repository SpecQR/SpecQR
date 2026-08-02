# Structured Append Memory Hardening

この文書は、高レベル `generateStructuredAppend()` /
`generateSegmentsStructuredAppend()` の分割探索で使う内部表現、容量
preflight、memory complexity、検証方法を記録します。Public API、分割戦略、
diagnostics shape、error contract は変更していません。

## 対象

- raw string / binary input の高レベル自動分割
- manual numeric / alphanumeric / byte / Kanji segments の高レベル自動分割
- fixed Version と `version: "auto"` の greedy-largest-fitting 探索
- 最大 16 symbols までの total-capacity 判定

低レベル `structuredAppend` option、parity-only helper、scanner 側の merge は、この
内部表現を使用しません。

## Allocation / Data Flow

### 変更前

raw string は `Array.from(input)`、全 code point の UTF-8 byte length、全 byte
offset、payload 全体の UTF-8 bytes を同時に保持していました。Binary input も
typed view を全量 JavaScript `Array` へ変換していました。

manual segments は、normalized binary bytes に加え、canonical bytes 全体と
1 byte / 1 code point ごとの split-unit object を事前生成していました。
Candidate 探索では unit slice と candidate segments を繰り返し materialize して
いました。

### 変更後

```text
options normalization
  -> streaming byte length / parity / unit count
  -> safe total-capacity lower-bound preflight
  -> compact split source
  -> range-only greedy split search
  -> final rangesだけchunk materialization
  -> per-symbol single build
  -> public diagnostics assembly
```

- Binary input は、`Uint8Array` / `ArrayBuffer` / `ArrayBufferView` の range を view
  として保持します。Offset / length を維持し、最終 symbol の range だけ
  `subarray()` で参照します。Caller が渡した `number[]` は検証後にその配列を
  source として使います。
- String input は code point array、全 byte-length array、全 byte-start array を
  作りません。64 code points ごとの sparse checkpoint だけを保持し、
  UTF-16/code-point/UTF-8境界を range cursor で復元します。
- Manual input は source segment ごとに 1 descriptor を持ちます。Binary/text
  byte segment は virtual range、numeric/alphanumeric/Kanji は atomic range です。
  Canonical bytes 全体や内部用の 1-unit object は作りません。
- Binary search は `{ start, length }` だけを扱い、失敗した Version の candidate
  payload を materialize しません。選択された最終 range だけを既存 encoding
  core へ渡します。
- Parity と canonical byte length は segment を順次走査して集計します。

## Total-Capacity Preflight

Preflight は、選択できる最大 Version、ECC、Structured Append header
（20 bits）、`maxSymbols`、mode/segment overhead を使い、「どの分割でも絶対に
収まらない」場合だけ `DataTooLongError` を投げます。

Raw fixed-mode input では、payload bit length と各 symbol に最低1つ必要な mode /
character-count overhead を使います。Auto text では、全 mode より楽観的な numeric
density と最小 character-count indicator を使います。この lower bound でさえ
総容量を超える場合だけ reject するため、fit し得る input を preflight だけで
reject しません。

Manual input では、既存 source segment の payload bits と各 segment に1回だけ必要な
mode / character-count overhead を合計します。実際の split で同じ segment が複数
symbols へ分かれると overhead は増えるため、この値も楽観的 lower bound です。

`version: "auto"` では `maxVersion` を使います。Lower bound 以下の input は従来どおり
exact range accounting と greedy split 探索へ進みます。Version 9/10・26/27、
exact-fit / max+1、UTF-8/astral、Kanji、offset 付き view、manual mixed は focused
tests で固定しています。

## Complexity

`n` を raw byte/code-point 数、`s` を manual source segment 数、`u` を public
split-unit 数とします。

| Path | Preparation time | Internal extra memory |
| --- | --- | --- |
| raw binary | O(n) parity scan | O(1) + final ranges |
| raw string | O(n) UTF-8/parity/index scan | O(n / 64) checkpoints |
| manual binary/text | O(n + s) canonical scan | O(s + text code points / 64) |
| split search | Version/range probe に依存 | O(maxSymbols + s) |

Final symbol の encoding には、その symbol の既存 normalization/codeword/matrix
allocation が必要です。最大 16 symbols という既存 contract は維持します。

### Public diagnostics cost

`generateSegmentsStructuredAppend()` の top-level
diagnostics は、v3 candidate で standard/full へ分離されています。Standard は
`splitUnitCount` と `splitUnitsDetail: "summary"` だけを返し、
`materializeSplitUnits()` を呼びません。Full opt-in だけが成功後に 1 split unit
あたり 1 object を一度 materialize します。この返却値は O(u) memory です。

Version 40-L / byte / 16 symbols の 47,216-byte manual case では、
full の `splitUnits.length === 47_216`、standard の
`splitUnitCount === 47_216` です。

### v3 design status

この残存 cost に対する v3 contract は
[v3 Structured Append Diagnostics Contract](./v3-structured-append-diagnostics.md)
どおり、`3.0.0-rc.1` で prerelease 公開済みです。Standard は `splitUnits` own property を
持たず、full array は `diagnostics: { splitUnits: "full" }` で明示的に要求します。
現在の `3.0.0-rc.2` release-correction candidate は RC 1 と同じ runtime / type
contract を維持し、stable support とは扱いません。Migration は
[v3 Migration Guide](./v3-migration.md) を参照してください。

## Failure Semantics

収容不能時は既存の `DataTooLongError`（`code: "DATA_TOO_LONG"`）と fixed/auto、
raw/manual ごとの既存 message pattern を維持します。1 symbol に収まる入力は既存の
`InvalidInputError` を維持します。新しい limit、option、error class はありません。

## Deterministic Gate

```sh
npm test
npm run verify:structured-append:memory
```

専用 gate は 32 MiB V8 old-space child で次を実行します。

- 150,000-byte offset 付き binary view の早期 `DataTooLongError`
- 150,000-character ASCII string の auto Version 1..40早期 `DataTooLongError`
- 150,000-byte manual byte segment の早期 `DataTooLongError`
- Version 10-L の 4,304-byte / 16-symbol raw success
- 同じ manual success と4,304件の full `splitUnits`
- Version 40-L / 47,216-byte / 16-symbol standard の 32 MiB old-space 成功
- Standard/full を fresh child で各5回測定し、matrix hash 一致、diagnostics JSON
  size 差、heap/time 中央値を report

Pass/fail に時間や RSS の閾値は使いません。低 heap 完走、stable error、symbol 数、
parity、public diagnostics を判定します。Unit test は、変更前 checkout と照合した
matrix/diagnostics SHA-256、UTF-8/astral、offset view、manual mixed、
Version 境界、および compact source の white-box invariant を固定します。

## Baseline

測定環境は 2026-07-31、Darwin arm64、Node.js 25.9.0 です。修正前値は同じ
checkout で変更前に採った1回の baseline、修正後値は独立 child 5回の中央値です。
これは性能 SLA ではありません。

| Case | Before | After |
| --- | ---: | ---: |
| 150,000-byte raw binary | 824 ms、RSS 93,601,792 bytes、`DataTooLongError` | 1.88 ms、RSS 58,245,120 bytes、`DataTooLongError` |
| 150,000-char ASCII | 13,456 ms、RSS 210,796,544 bytes、`DataTooLongError` | 2.28 ms、RSS 58,966,016 bytes、`DataTooLongError` |
| 150,000-byte manual byte | raw `RangeError`、RSS 84,934,656 bytes | 2.08 ms、RSS 58,277,888 bytes、`DataTooLongError` |
| V10-L 4,304-byte raw / 16 symbols | 39.37 ms | 18.71 ms |
| V10-L 4,304-byte manual / 16 symbols | 40.49 ms | 19.17 ms |

Near-maximum Version 40-L / 47,216-byte / 16-symbol の v3 diagnostics 比較は、
standard 85.64 ms / heap delta 4,648,608 bytes / JSON 5,950 bytes、full
86.12 ms / heap delta 8,436,776 bytes / JSON 4,941,422 bytes でした。
両 mode の matrix hash は一致します。JIT、GC、CPU load により値は変動するため、
correctness gate は hash、低 heap 結果、Nayuki、deterministic properties を使います。

## Non-Goals

- Caller がすでに保持する string、`number[]`、typed array 自体の memory 制限
- Full `diagnostics.splitUnits` array 自体の圧縮、lazy getter、readonly 化
- Greedy-largest-fitting strategy や split 位置の変更
- 17 symbols 以上、新しい public limit/option
- Encoder/matrix/renderer の再設計
- Scanner metadata、decoder merge behavior の変更
