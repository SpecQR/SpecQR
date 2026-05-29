# Structured Append Scanning Workflow v2

この文書は、SpecQR が生成した Structured Append symbols を読み取るときの workflow、decoder 依存の限界、public merge helper API の位置づけを整理する design note です。

SpecQR は QR generator であり、decoder や scanner integration は提供しません。`mergeStructuredAppendParts()` は decoder が `index` / `total` / `parity` / unmerged data を返した場合だけ、読み取り後の parts を検証・結合する dependency-free helper です。

## Goal

`generateStructuredAppend()` と `generateSegmentsStructuredAppend()` は、複数 QR symbols を 1 つの logical message として扱うための Structured Append header を encode します。一方で、読み取り側の decoder がどの情報を返すかは実装ごとに大きく異なります。

metadata-returning decoder 候補と optional validation lane の調査は [Structured Append Decoder Metadata Validation](./structured-append-decoder-validation-v2.md) に分離しています。この文書では scanner workflow と merge helper API の境界に集中します。

この文書では次を固定します。

- SpecQR generator が保証する範囲
- SpecQR が保証しない scanner / decoder behavior
- scanner workflow の推奨手順
- `mergeStructuredAppendParts(parts, options?)` API
- merge helper が扱う範囲と扱わない範囲

## What SpecQR Guarantees

SpecQR が保証するのは生成側の QR Code Model 2 construction です。

- Structured Append mode indicator `0011` を encode すること。
- public API の `index` / `total` / `parity` を QR bit stream の sequence indicator と parity data に変換すること。
- `index` は public API では 1-based、bit stream では 0-based sequence value として扱うこと。
- `total` は public API では `2..16`、bit stream では 0-based total value として扱うこと。
- `parity` は `0..255` integer として encode すること。
- high-level API では original payload bytes から deterministic XOR parity を計算すること。
- high-level API では各 symbol の diagnostics に index、total、parity、sequence values、chunk offsets を出すこと。
- `mergeStructuredAppendParts()` では、decoder が返した parts の missing、duplicate、total mismatch、parity mismatch、data type mismatch、merged payload byte parity を検証すること。
- fixed Version / ECC / mask の golden fixtures で matrix、codewords、diagnostics を固定すること。
- release gate で unit tests、golden tests、packed package smoke、reference comparison、decoder validation を組み合わせること。

## What SpecQR Does Not Guarantee

Structured Append の読み取り後 behavior は scanner / decoder に依存します。SpecQR は次を保証しません。

- scanner が複数 symbols を自動で merge すること。
- decoder API が Structured Append metadata を露出すること。
- decoder API が `index` / `total` / `parity` を返すこと。
- decoder API が各 symbol の raw unmerged payload を返すこと。
- decoder API が merged payload と per-symbol metadata を同時に返すこと。
- metadata のない decoded payload から、順序、欠落、重複、parity を推測すること。

そのため、SpecQR の conformance は decoder merge 成功だけに依存しません。Structured Append header encoding、matrix / codeword golden fixtures、diagnostics consistency、metadata が取れた後の `mergeStructuredAppendParts()` validation を分けて検証します。

## Scanner Workflow

### 1. すべての symbols を scan する

Structured Append set は `total` 個の symbols で構成されます。読み取り側では、まず印刷・表示された全 symbols を scan します。

読み取り UI は、可能であれば次を表示できると安全です。

- 何個の symbols を読んだか。
- decoder が返した `index` / `total` / `parity`。
- 欠けている `index` があるか。
- 同じ `index` を重複して読んでいないか。
- すべての symbols の `total` / `parity` が一致しているか。

### 2. decoder が metadata を返す場合

decoder が Structured Append metadata を返す場合は、その metadata を信頼できる最小単位として扱います。

推奨 checks:

- `index` は integer で `1..total`。
- `total` は integer で `2..16`。
- `parity` は integer で `0..255`。
- すべての parts の `total` が同じ。
- すべての parts の `parity` が同じ。
- `index` が重複しない。
- `1..total` のすべての index が揃っている。
- parts を `index` 昇順に並べて payload を連結する。

この workflow では、decoder が返した per-symbol data が string なのか binary data なのかも確認します。string parts と binary parts を同じ set に混在させるべきではありません。

### 3. decoder が metadata を返さない場合

decoder が merged payload だけを返す場合、SpecQR 側で Structured Append set の整合性を検証することはできません。この場合は decoder の結果を通常の decoded data として扱い、SpecQR の merge helper の対象外にします。

decoder が per-symbol payload だけを返し、`index` / `total` / `parity` を返さない場合も、SpecQR は安全に復元順序を判断できません。印刷順や scan 順に連結することは、仕様上の metadata に基づかない推測なので推奨しません。

metadata がない場合の限界:

- missing symbol を検出できない。
- duplicate symbol を検出できない。
- 正しい順序を判断できない。
- parity mismatch を検出できない。
- decoder が自動 merge したのか、個別 payload を返したのかを判別できない場合がある。

### 4. mismatch handling

読み取り側で metadata が取れる場合、次の failure は merge 前に reject します。

- Missing symbol: `1..total` のいずれかの `index` がない。
- Duplicate symbol: 同じ `index` が複数ある。
- Total mismatch: parts 間で `total` が一致しない。
- Parity mismatch: parts 間で `parity` が一致しない。
- Invalid index / total / parity: 範囲外または integer ではない。
- Mixed data type: string data と binary data が混在している。

High-level generator の parity は original payload bytes の XOR です。`mergeStructuredAppendParts()` は string parts では UTF-8 bytes、binary parts では渡された bytes から XOR parity を再計算します。decoder が string payload を返す場合、decoder 側の文字列化が元 payload と同じ意味であることは caller 側で確認してください。binary payload が必要な用途では、decoder から unmerged binary data を取得できる経路を優先します。

## Public Merge Helper

`mergeStructuredAppendParts(parts, options?)` は、decoder が Structured Append metadata と unmerged per-symbol data を返せる環境でだけ使う helper です。root named export と `QRCode.mergeStructuredAppendParts(parts, options?)` static method を提供します。

```ts
function mergeStructuredAppendParts(
  parts: QRStructuredAppendDecodedPart[],
  options?: QRStructuredAppendMergeOptions
): QRStructuredAppendMergeResult;

class QRCode {
  static mergeStructuredAppendParts(
    parts: QRStructuredAppendDecodedPart[],
    options?: QRStructuredAppendMergeOptions
  ): QRStructuredAppendMergeResult;
}
```

### Part Shape

```ts
type QRStructuredAppendDecodedPart = {
  index: number;
  total: number;
  parity: number;
  data: string | Uint8Array | ArrayBuffer | ArrayBufferView;
};
```

Rules:

- `index` is 1-based.
- `total` is `2..16`.
- `parity` is `0..255`.
- `data` is the unmerged payload returned for that symbol.
- all parts in one call must use the same data type family: string or binary.
- metadata-less decoder output is outside this API.

Binary input is normalized with `ArrayBufferView.byteOffset` and `byteLength` respected. String input is concatenated as strings and parity is verified from UTF-8 bytes.

### Adapter Pattern

scanner adapter は、decoder 固有の result object から SpecQR の part shape に変換する薄い層です。SpecQR core は decoder を持たず、adapter も特定 decoder を必須 dependency にしません。利用側の application や integration package が decoder output を読み、metadata が揃っている場合だけ `mergeStructuredAppendParts()` に渡します。

ZXing Java style の metadata では、`STRUCTURED_APPEND_SEQUENCE` と `STRUCTURED_APPEND_PARITY` が候補になります。QR Structured Append の sequence indicator は 8 bit で、上位 4 bit が 0-based index、下位 4 bit が 0-based total count です。

```js
import { InvalidInputError, mergeStructuredAppendParts } from "specqr";

function zxingJavaResultToStructuredAppendPart(result) {
  const metadata = result.resultMetadata ?? {};
  const sequence = metadata.STRUCTURED_APPEND_SEQUENCE;
  const parity = metadata.STRUCTURED_APPEND_PARITY;

  if (!Number.isInteger(sequence) || !Number.isInteger(parity)) {
    throw new InvalidInputError("Structured Append metadata is required before merging decoded parts");
  }

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

この adapter は一例です。実際の decoder API では metadata field 名、binary data の取り出し方、string payload の扱いが違うことがあります。`examples/structured-append-merge.mjs` は ZXing Java style の mock object を使い、string parts、binary parts、shuffled scan order、missing / duplicate / parity mismatch の扱いを実行可能な形で示します。

### Metadata-less Decoders

`jsQR`、`zbarimg`、macOS Vision などは payload readability の確認には有用ですが、Structured Append metadata を常に取得できるとは限りません。metadata がない decoded string 配列を scan 順や印刷順で連結しても、仕様上の順序、欠落、重複、parity を検証したことにはなりません。

metadata がない場合の推奨:

- decoder が自動 merge 済み payload を返したなら、通常の decoded data として扱う。
- decoder が per-symbol payload だけを返したなら、SpecQR では merge しない。
- Structured Append metadata が必要な workflow では、ZXing Java や ZXing-C++ など metadata-returning decoder 候補を検討する。

### Options

`options` is reserved for future narrow extensions. The current implementation accepts only an empty object.

```ts
interface QRStructuredAppendMergeOptions {}
```

### Return Shape

```ts
type QRStructuredAppendMergeResult = {
  data: string | Uint8Array;
  total: number;
  parity: number;
  parts: Array<{
    index: number;
    total: number;
    parity: number;
    dataType: "string" | "binary";
    byteLength: number;
  }>;
  diagnostics: {
    dataType: "string" | "binary";
    byteLength: number;
    missing: number[];
    duplicate: number[];
    parityCheck: {
      expected: number;
      actual: number;
      matches: true;
    };
  };
};
```

The helper should return normalized merged data, not regenerated QR symbols. It should not attempt to decode QR images itself.

## Error Policy

This helper uses existing stable error classes.

- `InvalidInputError`
  - empty `parts`.
  - missing symbol.
  - duplicate index.
  - total mismatch.
  - parity mismatch across parts.
  - merged payload byte parity mismatch.
  - mixed string / binary data.
  - metadata-less part.
- `InvalidModeError`
  - invalid helper option.

Invalid `index`, `total`, or `parity` should use `InvalidInputError` with clear messages that identify the failing part.

## Core Helper Boundary

The merge helper is useful only when a decoder exposes Structured Append metadata and unmerged per-symbol data. Many common decoder APIs do not expose that combination. This makes the helper valuable, but not universally useful.

Reasons it belongs in core:

- It has no QR image decoding dependency.
- It can be dependency-free and small.
- It prevents application code from repeatedly reimplementing missing / duplicate / mismatch checks.
- It gives SpecQR a clear story for generation plus metadata-based merge without becoming a decoder.

Boundary:

- Scanner APIs differ widely and may not provide the required metadata.
- Merged payload semantics for string data can be encoding-dependent.
- The helper can create false confidence if users expect it to work with any QR scanner.
- The helper does not scan images, decode QR symbols, or infer metadata.

## Non-Scope

- QR decoder implementation.
- Scanner integration.
- Manual segments 専用 parity helper の実装。Raw input 用の public parity helper は [Structured Append Parity Helper v2.3](./structured-append-parity-v2.3.md) として実装済みで、manual segments 用 proposal は [Structured Append Manual Segments Parity Helper v2.3 Design](./structured-append-segments-parity-v2.3.md) に固定しています。
- Existing Structured Append API changes.
- QR core / renderer / playground behavior changes.
- ECI / GS1 / FNC1 Structured Append combinations.
- Micro QR / rMQR.
- package version change.
- npm publish / GitHub Release / Pages deploy.
- runtime dependency changes.

## Validation Position

Structured Append generation remains validated by:

- unit tests for low-level header and high-level splitting.
- golden fixtures for matrix / codewords / diagnostics.
- packed package smoke for public exports, `mergeStructuredAppendParts()`, and TypeScript declarations.
- decoder validation as a secondary signal only.

Structured Append metadata validation remains optional because it depends on external decoder capabilities. Candidate decoder research and the optional lane are tracked in [Structured Append Decoder Metadata Validation](./structured-append-decoder-validation-v2.md).

`mergeStructuredAppendParts()` itself is release-gated by unit tests and packed package smoke. External decoder metadata validation remains optional until a stable metadata-returning decoder fixture can run reliably in CI.
