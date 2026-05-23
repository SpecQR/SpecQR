# Structured Append v2 API Design

この文書は、SpecQR v2 系で設計し、現在の runtime に実装した string / binary input 向け高レベル Structured Append API の設計記録です。低レベル header API の `structuredAppend: { index, total, parity }` と manual `{ mode: "structured-append", index, total, parity }` に加えて、`generateStructuredAppend()` が public export として利用できます。Manual segments 版の高レベル API は [Structured Append Manual Segments v2 API Design](./structured-append-segments-v2.md) に分けています。

## Goal

`generateStructuredAppend(input, options)` は、1 つの input を最大 16 個の QR Code Model 2 symbols に自動分割し、それぞれに Structured Append header を付与して返します。利用者が index / total / parity を個別に管理しなくても、安全に multi-symbol QR set を作れる API にします。

この文書で固定している範囲は次の通りです。

- public API shape
- input / option validation
- automatic split strategy
- parity calculation policy
- diagnostics shape
- error classes
- release gate

現在の実装では package version は変えず、runtime dependency も追加していません。

## Public API

```ts
function generateStructuredAppend(
  input: QRInput,
  options?: QRStructuredAppendGenerateOptions
): QRStructuredAppendResult;

class QRCode {
  static generateStructuredAppend(
    input: QRInput,
    options?: QRStructuredAppendGenerateOptions
  ): QRStructuredAppendResult;
}
```

`QRInput` は既存 `generate()` と同じく、string、byte array、`Uint8Array`、`ArrayBuffer`、`ArrayBufferView` を受け付けます。

`generateStructuredAppend()` は常に object を返します。各 symbol の生成結果は、既存 `generate()` と同じ output type です。

```ts
interface QRStructuredAppendResult<TSymbol = QRGenerateResult> {
  symbols: TSymbol[];
  total: number;
  parity: number;
  inputLength: number;
  byteLength: number;
  diagnostics: QRStructuredAppendSummaryDiagnostics;
}
```

`QRGenerateResult` は `generate(chunk, options)` の戻り値と同じです。TypeScript では `diagnostics` / `output` に応じた overload で `symbols` の型を絞ります。

- `output: "svg"`: `symbols` は SVG string の array
- `output: "svg-data-url"`: `symbols` は SVG Data URL string の array
- `output: "png"`: `symbols` は PNG `Uint8Array` の array
- `output: "png-data-url"`: `symbols` は PNG Data URL string の array
- `output: "matrix"`: `symbols` は boolean matrix の array
- `diagnostics: true`: `symbols` の各要素は既存 `QRCodeDiagnosticResult`

top-level `diagnostics` は常に返します。`diagnostics: true` の場合は、各 symbol の既存 diagnostics も `symbols[index].diagnostics` で取得できます。

実利用の入口として、`examples/structured-append.mjs` は string input と binary input の自動分割、SVG / PNG symbol output、`total`、`parity`、per-symbol diagnostics summary を保存します。Playground は `Single QR` / `Structured Append` を切り替え、複数 symbol preview、`maxSymbols`、ECC、Version、warnings を確認できます。

## Options

高レベル API は、既存 `QRCodeOptions` のうち Structured Append と衝突しないものを再利用します。新しい短縮名は増やしません。

```ts
interface QRStructuredAppendGenerateOptions {
  errorCorrectionLevel?: "L" | "M" | "Q" | "H";
  version?: 1..40 | "auto";
  minVersion?: 1..40;
  maxVersion?: 1..40;
  maskPattern?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | "auto";
  mode?: "auto" | "numeric" | "alphanumeric" | "byte" | "kanji";
  encoding?: "utf-8";
  optimizeSegments?: boolean;
  margin?: number;
  scale?: number;
  foreground?: string;
  background?: string;
  output?: "matrix" | "svg" | "svg-data-url" | "png" | "png-data-url";
  diagnostics?: boolean;
  printDpi?: number | null;
  maxSymbols?: number;
}
```

Defaults follow `generate()` unless stated otherwise.

- `maxSymbols`: default `16`; valid range `2..16`.
- `version`: default `"auto"`.
- `minVersion`: default `1`.
- `maxVersion`: default `40`.
- `maskPattern`: default `"auto"`; fixed mask applies to every symbol.
- `errorCorrectionLevel`: default `"M"`.
- `output`: default `"svg"`.

Rejected aliases:

- `errorCorrection`: use existing `errorCorrectionLevel`.
- `mask`: use existing `maskPattern`.
- `structuredAppend`: high-level API computes index / total / parity itself.
- `parity`: parity override is not part of the first high-level API.

## Parity Policy

The high-level API computes parity from the original payload bytes. It does not expose a public parity helper in the first implementation.

Rules:

- string input: parity is calculated from the UTF-8 bytes of the original JavaScript string before splitting.
- binary input: parity is calculated from the original byte sequence, respecting `ArrayBufferView.byteOffset` and `byteLength`.
- parity algorithm: XOR all original input bytes into one unsigned 8-bit value.
- empty input has parity `0`, but a Structured Append set still requires at least 2 non-empty symbols; see split policy.

Rationale:

- The low-level `structuredAppend` option already supports custom parity for users who need exact external control.
- The high-level API should keep all symbols internally consistent and avoid accidentally producing a set whose parity no longer matches the original payload.
- A public `calculateStructuredAppendParity()` helper can be added later if real-world interop demands it.

## Input Scope

Initial implementation scope:

- string input
- binary input
- `mode: "auto"`, `"numeric"`, `"alphanumeric"`, `"byte"`, `"kanji"`
- existing mixed-segment optimizer per chunk

Manual segment splitting is handled by the separate `generateSegmentsStructuredAppend(segments, options)` API. Its chunk boundaries, character counts, raw byte parity, and mode preservation rules are documented in [Structured Append Manual Segments v2 API Design](./structured-append-segments-v2.md).

## Control Mode Compatibility

The first high-level implementation rejects all other control modes.

- `eci !== false`: reject with `InvalidModeError`.
- `gs1: true`: reject with `InvalidGs1Error`.
- `fnc1Second !== false`: reject with `InvalidModeError`.
- `structuredAppend`: reject with `InvalidModeError`; the high-level API owns the header.
- manual `{ mode: "fnc1" }`, `{ mode: "fnc1-second" }`, `{ mode: "eci" }`, `{ mode: "structured-append" }`: rejected by `generateSegmentsStructuredAppend()` as well.

Kanji mode is allowed because it is a data mode, not a control mode. If the runtime lacks Shift_JIS `TextDecoder`, explicit `mode: "kanji"` keeps the existing reject behavior, and `mode: "auto"` may fall back to byte mode just like `generate()`.

GS1 Digital Link URI strings are allowed as ordinary URL payloads because they do not require FNC1 first position. They should be passed without `gs1: true`.

## Split Strategy

The implementation should prefer deterministic, easy-to-audit behavior over maximum compression.

### Version Selection

If `version` is a number:

- All symbols use that exact Version.
- The splitter tries to divide the input into `2..maxSymbols` chunks that each fit with the Structured Append header.
- If the input fits in one symbol at that Version, the API rejects and tells the user to use `generate()` or the low-level header API.
- If the input cannot fit within `maxSymbols`, throw `DataTooLongError`.

If `version` is `"auto"`:

- Scan candidate versions from `minVersion` to `maxVersion`.
- For each version, attempt a split into `2..maxSymbols` symbols at the requested `errorCorrectionLevel`.
- Select the smallest version that can split the payload within `maxSymbols`.
- All symbols in the returned set use the same Version and error correction level.

Using one Version for the whole set keeps printed symbols visually predictable and simplifies diagnostics. A future option may allow per-symbol versions, but that is not part of the first API.

### Chunking

Use a greedy largest-fitting chunk strategy for each candidate version.

1. Convert input into split units:
   - string input: Unicode code points
   - binary input: bytes
2. For the remaining input, find the largest non-empty prefix that fits in one symbol with a temporary low-level Structured Append header.
3. Use binary search over split units to find the largest fitting chunk.
4. Continue until all input is consumed or the chunk count exceeds `maxSymbols`.
5. For `mode: "auto"`, run existing per-chunk segmentation independently.

The splitter must reserve at least one split unit for each remaining required symbol when it already knows the result must contain at least 2 symbols. This prevents a first chunk from consuming the entire payload and producing an invalid one-symbol Structured Append set.

This strategy is intentionally not globally optimal. It is predictable and relies on existing `generate()` capacity checks as the source of truth. Golden fixtures should lock the result.

### One-Symbol Inputs

Structured Append total count is `2..16`. Therefore the high-level API should not return `total: 1`.

If the selected version policy would fit the whole input in one symbol:

- For a fixed Version, reject with `InvalidInputError` and recommend `generate()` or the low-level `structuredAppend` option.
- For `version: "auto"`, continue trying smaller candidate versions if available. If no candidate can produce at least 2 symbols, reject with `InvalidInputError`.

This keeps `generateStructuredAppend()` semantically honest: it returns a Structured Append set, not a sometimes-normal QR wrapper.

## Diagnostics

Top-level diagnostics should summarize the set.

```ts
interface QRStructuredAppendSummaryDiagnostics {
  version: number;
  errorCorrectionLevel: "L" | "M" | "Q" | "H";
  versionSelection: "fixed" | "auto-minimum";
  versionSelectionReason: string;
  total: number;
  parity: number;
  byteLength: number;
  inputLength: number;
  maxSymbols: number;
  splitStrategy: "greedy-largest-fitting";
  symbols: QRStructuredAppendSymbolDiagnostics[];
  warnings: QRWarning[];
}

interface QRStructuredAppendSymbolDiagnostics {
  index: number;
  total: number;
  parity: number;
  sequenceIndex: number;
  sequenceTotal: number;
  sequenceIndicator: number;
  inputStart: number;
  inputLength: number;
  byteStart: number;
  byteLength: number;
  version: number;
  errorCorrectionLevel: "L" | "M" | "Q" | "H";
  dataBitLength: number;
  capacityBits: number;
  remainingBits: number;
  maskPattern: number;
}
```

When `diagnostics: true`, each generated symbol already contains the normal QR diagnostics. The top-level summary avoids duplicating the entire per-symbol diagnostics tree and instead exposes the set-level fields needed to audit the split.

Warnings:

- `STRUCTURED_APPEND_SINGLE_SYMBOL_REJECTED`: only if the API chooses to expose a pre-error warning in a future diagnostic mode. The first implementation can simply throw.
- `STRUCTURED_APPEND_MAX_SYMBOLS_NEAR_LIMIT`: emitted when `total === maxSymbols`.
- `STRUCTURED_APPEND_DECODER_SUPPORT_VARIES`: optional info warning when diagnostics are enabled, because decoder APIs differ in how they expose Structured Append semantics.

## Error Behavior

- `InvalidInputError`
  - input is empty or cannot be split into at least 2 non-empty symbols.
  - input would fit in one symbol under the chosen fixed Version.
- `InvalidModeError`
  - `maxSymbols` is not an integer from `2..16`.
  - incompatible options such as `eci`, `fnc1Second`, `structuredAppend`, `boostErrorCorrection`.
  - mode-specific validation failures, following existing `generate()` behavior.
- `InvalidGs1Error`
  - `gs1: true` is passed.
- `InvalidVersionError`
  - invalid `version`, `minVersion`, or `maxVersion`, following existing option validation.
- `InvalidOutputError`
  - invalid `output`, following existing option validation.
- `DataTooLongError`
  - no version in range can split the payload into `maxSymbols` or fewer symbols.
  - fixed Version cannot split the payload into `maxSymbols` or fewer symbols.

Errors from existing `generate()` calls should bubble when they already describe the failing condition precisely.

## Rejected Choices

- Expose `parity` override in `generateStructuredAppend()`: rejected for the first high-level API because it can make symbols inconsistent. Use low-level `structuredAppend` when custom parity is required.
- Fold `generateSegmentsStructuredAppend()` into `generateStructuredAppend()`: rejected because manual segments have caller-visible mode boundaries and split-unit semantics. The separate API is documented in `structured-append-segments-v2.md`.
- Add `errorCorrection` / `mask` aliases: rejected to keep the API aligned with `generate()` options.
- Allow ECI / FNC1 / GS1 combinations immediately: rejected for the first implementation. These combinations need separate ordering and scanner-behavior tests.
- Return normal single-symbol QR when the input fits one symbol: rejected because the function name promises Structured Append semantics.
- Allow per-symbol Version selection by default: rejected to keep symbols visually consistent and diagnostics simple.

## Implementation Coverage

The implementation includes tests for:

- root export and `QRCode.generateStructuredAppend()` static method.
- string input split into 2+ symbols.
- binary input split into 2+ symbols, including `0x00` and `0xff`.
- UTF-8 string parity from original bytes.
- `ArrayBufferView` offset / length parity.
- fixed Version split success.
- fixed Version single-symbol rejection.
- `version: "auto"` chooses the smallest common Version that yields `2..maxSymbols`.
- exact `maxSymbols` case and `DataTooLongError` beyond it.
- invalid `maxSymbols`, incompatible control options, and invalid output options.
- each returned symbol has low-level `structuredAppend` diagnostics with matching `index`, `total`, `parity`, and encoded sequence values.
- output shapes for `svg`, `png`, `matrix`, and `diagnostics: true`.
- golden fixture set for a deterministic multi-symbol payload.
- packed package smoke and TypeScript declaration smoke.
- examples smoke for `examples/structured-append.mjs`.
- playground source coverage for Structured Append mode and multi-symbol preview.

## Release Gate

Implementation should pass:

- `npm test`
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

Decoder validation should not be the only proof for Structured Append. Some decoders expose individual symbols as independent payloads and do not surface the Structured Append set metadata. The release gate must rely on unit tests, golden matrix/codeword fixtures, bit length accounting, and diagnostics consistency.

## Non-Scope

- Public parity helper.
- Decode / merge helper.
- ECI / FNC1 / GS1 combinations.
- Numeric / alphanumeric / kanji mid-segment splitting for the manual segments API.
- Micro QR / rMQR.
- package version change.
- npm publish / GitHub Release / Pages deploy.
- runtime dependency changes.
