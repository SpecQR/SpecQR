# Structured Append Scanning Workflow v2

この文書は、SpecQR が生成した Structured Append symbols を読み取るときの workflow、decoder 依存の限界、将来の optional merge helper API 案を整理する docs-only design note です。

この文書は runtime behavior、public API、package version、package exports を変更しません。SpecQR は現時点では QR generator であり、decoder や scanner integration は提供しません。

## Goal

`generateStructuredAppend()` と `generateSegmentsStructuredAppend()` は、複数 QR symbols を 1 つの logical message として扱うための Structured Append header を encode します。一方で、読み取り側の decoder がどの情報を返すかは実装ごとに大きく異なります。

この文書では次を固定します。

- SpecQR generator が保証する範囲
- SpecQR が保証しない scanner / decoder behavior
- scanner workflow の推奨手順
- 将来候補の `mergeStructuredAppendParts(parts, options?)` API
- merge helper を core に入れるべきか、docs-only guidance に留めるべきかの判断材料

## What SpecQR Guarantees

SpecQR が保証するのは生成側の QR Code Model 2 construction です。

- Structured Append mode indicator `0011` を encode すること。
- public API の `index` / `total` / `parity` を QR bit stream の sequence indicator と parity data に変換すること。
- `index` は public API では 1-based、bit stream では 0-based sequence value として扱うこと。
- `total` は public API では `2..16`、bit stream では 0-based total value として扱うこと。
- `parity` は `0..255` integer として encode すること。
- high-level API では original payload bytes から deterministic XOR parity を計算すること。
- high-level API では各 symbol の diagnostics に index、total、parity、sequence values、chunk offsets を出すこと。
- fixed Version / ECC / mask の golden fixtures で matrix、codewords、diagnostics を固定すること。
- release gate で unit tests、golden tests、packed package smoke、reference comparison、decoder validation を組み合わせること。

## What SpecQR Does Not Guarantee

Structured Append の読み取り後 behavior は scanner / decoder に依存します。SpecQR は次を保証しません。

- scanner が複数 symbols を自動で merge すること。
- decoder API が Structured Append metadata を露出すること。
- decoder API が `index` / `total` / `parity` を返すこと。
- decoder API が各 symbol の raw unmerged payload を返すこと。
- decoder API が merged payload と per-symbol metadata を同時に返すこと。
- 読み取り後の payload 復元、欠落検出、重複検出、parity 検証を SpecQR runtime が実行すること。

そのため、SpecQR の conformance は decoder merge 成功だけに依存しません。Structured Append header encoding、matrix / codeword golden fixtures、diagnostics consistency を主な根拠にします。

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

High-level generator の parity は original payload bytes の XOR です。ただし、merge helper が decoded string だけを受け取る場合、その string をどの encoding で bytes に戻すかは decoder behavior に依存します。そのため、将来の helper はまず metadata consistency を検証し、payload bytes に対する parity 再計算は binary data が渡された場合に限定する方が安全です。

## Future API Proposal

この API はまだ実装しません。decoder が Structured Append metadata を返せる環境でだけ使える optional helper として検討します。

```ts
function mergeStructuredAppendParts(
  parts: StructuredAppendPart[],
  options?: StructuredAppendMergeOptions
): StructuredAppendMergeResult;

class QRCode {
  static mergeStructuredAppendParts(
    parts: StructuredAppendPart[],
    options?: StructuredAppendMergeOptions
  ): StructuredAppendMergeResult;
}
```

### Proposed Part Shape

```ts
type StructuredAppendPart = {
  index: number;
  total: number;
  parity: number;
  data: string | Uint8Array | ArrayBuffer | ArrayBufferView | number[];
};
```

Rules:

- `index` is 1-based.
- `total` is `2..16`.
- `parity` is `0..255`.
- `data` is the unmerged payload returned for that symbol.
- all parts in one call must use the same data type family: string or binary.
- metadata-less decoder output is outside this API.

Binary input should be normalized the same way as existing binary input: `ArrayBufferView.byteOffset` and `byteLength` must be respected. String input should be concatenated as strings without guessing an intermediate byte encoding.

### Proposed Options

The first implementation may not need options. If options become useful, keep them narrow.

```ts
type StructuredAppendMergeOptions = {
  dataType?: "auto" | "string" | "binary";
  verifyBinaryParity?: boolean;
};
```

Potential behavior:

- `dataType: "auto"`: infer string vs binary from `data`.
- `dataType: "string"`: reject binary parts.
- `dataType: "binary"`: reject string parts.
- `verifyBinaryParity: true`: recompute XOR parity from merged binary bytes and compare to metadata parity. This should not be enabled for string data unless the caller specifies an encoding policy in a later design.

### Proposed Return Shape

```ts
type StructuredAppendMergeResult = {
  data: string | Uint8Array;
  total: number;
  parity: number;
  parts: Array<{
    index: number;
    byteLength: number | null;
    length: number;
  }>;
  diagnostics: {
    hasAllParts: true;
    dataType: "string" | "binary";
    verifiedParity: boolean;
    warnings: QRWarning[];
  };
};
```

The helper should return normalized merged data, not regenerated QR symbols. It should not attempt to decode QR images itself.

## Error Policy

If this helper is implemented, it should use existing stable error classes unless a strong reason appears to add a new one.

- `InvalidInputError`
  - empty `parts`.
  - missing symbol.
  - duplicate index.
  - total mismatch.
  - parity mismatch across parts.
  - mixed string / binary data.
  - metadata-less part.
- `InvalidModeError`
  - invalid helper option.
- `InvalidInputError` or `DataTooLongError`
  - only if a future implementation adds output-size or memory limits.

Invalid `index`, `total`, or `parity` should use `InvalidInputError` with clear messages that identify the failing part.

## Core Helper vs Docs-Only Guidance

The merge helper is useful only when a decoder exposes Structured Append metadata and unmerged per-symbol data. Many common decoder APIs do not expose that combination. This makes the helper valuable, but not universally useful.

Reasons to include it in core later:

- It has no QR image decoding dependency.
- It can be dependency-free and small.
- It prevents application code from repeatedly reimplementing missing / duplicate / mismatch checks.
- It gives SpecQR a clear story for generation plus metadata-based merge without becoming a decoder.

Reasons to keep it docs-only:

- Scanner APIs differ widely and may not provide the required metadata.
- Merged payload semantics for string data can be encoding-dependent.
- The helper can create false confidence if users expect it to work with any QR scanner.
- Real-world demand may be small compared with GS1 Digital Link and GS1 syntax work.

Recommended decision: keep the workflow docs-only until at least one real scanner integration can provide `{ index, total, parity, data }` reliably. Once that exists, add `mergeStructuredAppendParts()` as a dependency-free helper with strict metadata validation and no image decoding responsibility.

## Non-Scope

- Implementing `mergeStructuredAppendParts()`.
- QR decoder implementation.
- Scanner integration.
- Public parity helper.
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
- packed package smoke for public exports and TypeScript declarations.
- decoder validation as a secondary signal only.

Decoder merge validation is intentionally not a release gate until the project has a stable metadata-returning decoder fixture. When such a fixture exists, add tests for missing symbol, duplicate index, total mismatch, parity mismatch, mixed data type, and valid ordered merge.
