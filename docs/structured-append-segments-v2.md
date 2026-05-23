# Structured Append Manual Segments v2 API Design

この文書は、SpecQR v2 系で追加を検討する manual segments 版 Structured Append API の設計記録です。現時点では docs-only proposal であり、runtime behavior、public exports、TypeScript declarations、package version は変更しません。

関連する実装済み機能:

- 低レベル Structured Append header: `structuredAppend: { index, total, parity }`
- manual low-level segment: `{ mode: "structured-append", index, total, parity }`
- string / binary input の高レベル自動分割: `generateStructuredAppend(input, options)`

この文書で設計する API は、manual data segments を受け取り、最大 16 個の Structured Append symbols に自動分割する `generateSegmentsStructuredAppend(segments, options)` です。

## Proposed Public API

```ts
function generateSegmentsStructuredAppend(
  segments: QRSegmentInput[],
  options?: QRStructuredAppendSegmentsOptions
): QRStructuredAppendResult;

class QRCode {
  static generateSegmentsStructuredAppend(
    segments: QRSegmentInput[],
    options?: QRStructuredAppendSegmentsOptions
  ): QRStructuredAppendResult;
}
```

Return shape は `generateStructuredAppend()` と揃えます。

```ts
interface QRStructuredAppendResult<TSymbol = QRGenerateResult> {
  symbols: TSymbol[];
  total: number;
  parity: number;
  inputLength: number;
  byteLength: number;
  diagnostics: QRStructuredAppendSegmentsSummaryDiagnostics;
}
```

`symbols` の各要素は、既存 `generateSegments(chunkSegments, options)` と同じ output type です。

- `output: "svg"`: SVG string
- `output: "svg-data-url"`: SVG Data URL string
- `output: "png"`: PNG `Uint8Array`
- `output: "png-data-url"`: PNG Data URL string
- `output: "matrix"`: boolean matrix
- `diagnostics: true`: `QRCodeDiagnosticResult`

`inputLength` は、初期 API では original data segment count とします。これは `generateSegmentsStructuredAppend()` の input が segment array であるためです。Byte-level chunking の詳細は diagnostics の `splitUnits` / `symbols` に出します。`byteLength` は parity calculation に使った canonical payload byte stream の長さです。

## Options

`generateSegmentsStructuredAppend()` は、manual segments の mode choice を尊重する API です。そのため、input segmentation に関係する options は受け付けません。

```ts
interface QRStructuredAppendSegmentsOptions {
  errorCorrectionLevel?: "L" | "M" | "Q" | "H";
  version?: 1..40 | "auto";
  minVersion?: 1..40;
  maxVersion?: 1..40;
  maskPattern?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | "auto";
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

Defaults は `generateStructuredAppend()` と揃えます。

- `maxSymbols`: default `16`; valid range `2..16`
- `version`: default `"auto"`
- `minVersion`: default `1`
- `maxVersion`: default `40`
- `maskPattern`: default `"auto"`; fixed mask applies to every symbol
- `errorCorrectionLevel`: default `"M"`
- `output`: default `"svg"`

Rejected options:

- `mode`: manual segments already choose modes.
- `encoding`: manual byte string data uses the existing UTF-8 behavior.
- `optimizeSegments`: manual segments must not be re-optimized.
- `errorCorrection`: use `errorCorrectionLevel`.
- `mask`: use `maskPattern`.
- `parity`: high-level API computes parity.
- `eci`: rejected in the first implementation.
- `gs1`: rejected in the first implementation.
- `fnc1Second`: rejected in the first implementation.
- `structuredAppend`: high-level API owns the header.
- `boostErrorCorrection`: rejected in the first implementation to keep all symbols on the requested ECC policy.

## Accepted Segment Scope

Initial implementation scope:

- `{ mode: "numeric", data: string }`
- `{ mode: "alphanumeric", data: string }`
- `{ mode: "byte", data: string | Uint8Array | ArrayBuffer | ArrayBufferView | number[] }`
- `{ mode: "kanji", data: string }`

Rejected in the first implementation:

- `{ mode: "eci", ... }`
- `{ mode: "fnc1" }`
- `{ mode: "fnc1-second", ... }`
- `{ mode: "structured-append", ... }`

Control segments are rejected because their ordering relative to automatically inserted Structured Append headers is caller-visible and scanner-dependent. The first manual high-level API should prove ordinary data-segment behavior before allowing ECI / FNC1 combinations.

## Split Policy

The initial splitter should be conservative and easy to audit.

### Segment Boundary First

The primary split unit is the caller-provided data segment. The splitter may place complete segments into different symbols, but it must not merge adjacent segments or change their modes.

Example:

```js
[
  { mode: "alphanumeric", data: "ORDER-" },
  { mode: "numeric", data: "12345678901234567890" },
  { mode: "byte", data: "shipping note" }
]
```

The implementation may split between these three segments. It must preserve the chosen `alphanumeric`, `numeric`, and `byte` modes in every generated symbol.

### Byte Segment Chunking

Byte segments are the only data segments that the initial API may split internally.

Rules:

- Byte segment with binary data: split at byte boundaries.
- Byte segment with string data: split at Unicode code point boundaries, then encode each chunk as UTF-8 byte mode.
- If a byte string chunk must be split more tightly than code point boundaries allow, reject instead of producing invalid UTF-8.
- Each resulting chunk remains a `{ mode: "byte" }` segment.

Rationale:

- Byte mode represents an opaque byte stream, so byte-boundary chunking is a natural Structured Append operation.
- String byte segments still need to preserve valid JavaScript string boundaries.
- This covers large binary payloads without changing numeric / alphanumeric / kanji semantics.

### Numeric / Alphanumeric / Kanji Internal Splitting

Numeric, alphanumeric, and kanji segments are indivisible in the initial implementation.

The API should not split these segments mid-payload at first, even though QR encoding could technically support it. Reasons:

- Manual segment mode choices are caller-visible intent.
- Mid-segment splitting changes character count indicators and grouping boundaries.
- Kanji mode depends on Shift_JIS-compatible character validation.
- Exact parity / diagnostics / golden fixture semantics are easier to audit when non-byte segments remain atomic.

If a single numeric / alphanumeric / kanji segment cannot fit in one symbol with the selected version policy, throw `DataTooLongError`. A future option such as `splitTextSegments: true` could enable this deliberately, with separate tests.

## Chunking Algorithm

Use deterministic greedy largest-fitting, mirroring `generateStructuredAppend()` where possible.

1. Normalize manual segments with the same validation rules as `generateSegments()`.
2. Reject control segments and incompatible options.
3. Convert normalized data segments into split units:
   - one unit per numeric / alphanumeric / kanji segment
   - one or more units for byte segments when byte chunking is needed
4. Compute the canonical payload byte stream and parity before splitting.
5. For each candidate version, greedily choose the largest prefix of split units that fits with a temporary low-level Structured Append header.
6. Preserve at least one split unit for a second symbol.
7. Continue until all units are consumed or `maxSymbols` is exceeded.
8. Select the smallest common version that yields `2..maxSymbols` symbols when `version: "auto"`.

All symbols in the returned set use the same version and error correction level. Per-symbol version selection is deferred.

The splitter may use existing `generateSegments()` capacity checks as the source of truth. It should not duplicate QR capacity math outside the existing planner unless tests prove a need.

## Version / ECC / Mask Policy

If `version` is a number:

- Use that exact version for every symbol.
- Reject with `InvalidInputError` if the whole segment list fits in one symbol with the Structured Append header.
- Throw `DataTooLongError` if the segment list cannot be split into `maxSymbols` or fewer symbols.

If `version` is `"auto"`:

- Scan `minVersion..maxVersion`.
- Select the smallest version that can split the segments into `2..maxSymbols` symbols.
- If every candidate only yields one symbol, reject with `InvalidInputError` and recommend `generateSegments()`.
- If no candidate can split within `maxSymbols`, throw `DataTooLongError`.

`maskPattern` follows `generateStructuredAppend()`:

- fixed mask applies to all symbols
- `"auto"` chooses the best mask independently per symbol

`boostErrorCorrection` is rejected in the first implementation. A future design can reconsider it if the diagnostics can explain a common boosted level across all symbols.

## One-Symbol Inputs

Structured Append total count is `2..16`. The manual high-level API should not return `total: 1`.

If the normalized segments fit in one symbol under the selected version policy:

- reject with `InvalidInputError`
- message should recommend `generateSegments()` or low-level `structuredAppend`

This mirrors `generateStructuredAppend()` and keeps the API semantically honest.

## Parity Policy

The high-level manual API computes parity from a canonical payload byte stream before splitting. It does not expose a public parity override.

Canonical payload byte stream:

- numeric segment: ASCII bytes of `data`
- alphanumeric segment: ASCII bytes of `data`
- byte segment with binary data: original bytes, respecting `ArrayBufferView.byteOffset` and `byteLength`
- byte segment with string data: UTF-8 bytes of the JavaScript string
- kanji segment: UTF-8 bytes of the original JavaScript string

The parity value is the XOR of every byte in that stream.

This policy intentionally matches `generateStructuredAppend(string)` for JavaScript string data: parity is based on the caller-provided text bytes in UTF-8, not on internal QR data bits. If a user needs an external system's different parity convention, they should use the low-level `structuredAppend` header API.

## Diagnostics

Top-level diagnostics should use the same broad shape as `generateStructuredAppend()`, with segment-specific metadata added.

```ts
interface QRStructuredAppendSegmentsSummaryDiagnostics {
  version: number;
  errorCorrectionLevel: "L" | "M" | "Q" | "H";
  versionSelection: "fixed" | "auto-minimum";
  versionSelectionReason: string;
  total: number;
  parity: number;
  byteLength: number;
  inputLength: number;
  segmentCount: number;
  maxSymbols: number;
  splitStrategy: "segment-boundary-byte-chunk";
  splitUnits: QRStructuredAppendSplitUnitDiagnostics[];
  symbols: QRStructuredAppendSegmentsSymbolDiagnostics[];
  warnings: QRWarning[];
}

interface QRStructuredAppendSplitUnitDiagnostics {
  sourceSegmentIndex: number;
  mode: "numeric" | "alphanumeric" | "byte" | "kanji";
  unitStart: number;
  unitLength: number;
  byteStart: number;
  byteLength: number;
}

interface QRStructuredAppendSegmentsSymbolDiagnostics {
  index: number;
  total: number;
  parity: number;
  sequenceIndex: number;
  sequenceTotal: number;
  sequenceIndicator: number;
  sourceSegmentStart: number;
  sourceSegmentEnd: number;
  splitUnitStart: number;
  splitUnitLength: number;
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

`sourceSegmentEnd` is exclusive. `splitUnitStart` and `splitUnitLength` refer to the internal split-unit array, not the caller's original segment array.

When `diagnostics: true`, each returned symbol should still be the normal `QRCodeDiagnosticResult` from `generateSegments()`, including `diagnostics.structuredAppend`.

Warnings:

- `STRUCTURED_APPEND_MAX_SYMBOLS_NEAR_LIMIT`: emitted when `total === maxSymbols`.
- `STRUCTURED_APPEND_DECODER_SUPPORT_VARIES`: optional info warning when diagnostics are enabled.
- `STRUCTURED_APPEND_SEGMENT_BOUNDARY_LIMIT`: optional warning when a non-byte segment forces a less compact split.

## Error Behavior

- `InvalidInputError`
  - `segments` is empty.
  - no non-empty data segment remains after normalization.
  - input fits in one symbol and should use `generateSegments()`.
  - byte string data would need an invalid string split.
- `InvalidModeError`
  - invalid `maxSymbols`.
  - rejected options such as `mode`, `optimizeSegments`, `eci`, `fnc1Second`, `structuredAppend`, `boostErrorCorrection`.
  - rejected manual control segments: `eci`, `fnc1`, `fnc1-second`, `structured-append`.
  - mode-specific validation failures from existing manual segment validation.
- `InvalidGs1Error`
  - `gs1: true` is passed.
  - manual `{ mode: "fnc1" }` is passed.
- `InvalidVersionError`
  - invalid `version`, `minVersion`, or `maxVersion`.
- `InvalidOutputError`
  - invalid `output`.
- `DataTooLongError`
  - a single non-byte data segment cannot fit in a symbol under the selected version policy.
  - the full segment list cannot be split into `maxSymbols` or fewer symbols.

Existing `generateSegments()` errors should bubble when they already describe the failing condition precisely.

## Low-Level Structured Append Difference

The low-level API is for callers who already have chunks and want explicit metadata:

```js
QRCode.generateSegments([
  { mode: "structured-append", index: 2, total: 4, parity: 0x5a },
  { mode: "byte", data: "PART 2" }
]);
```

The proposed high-level manual API is for callers who have one logical manual-segment payload:

```js
const set = QRCode.generateSegmentsStructuredAppend([
  { mode: "alphanumeric", data: "ORDER-" },
  { mode: "numeric", data: "12345678901234567890" },
  { mode: "byte", data: new Uint8Array([0xde, 0xad, 0xbe, 0xef]) }
], {
  version: "auto",
  errorCorrectionLevel: "M",
  output: "svg"
});
```

The high-level API computes `index`, `total`, and `parity`. Therefore it rejects an existing low-level Structured Append segment.

## Golden / Conformance Plan

When implemented, tests should include:

- root export and `QRCode.generateSegmentsStructuredAppend()` static method.
- segment-boundary split with mixed numeric / alphanumeric / byte segments.
- byte segment chunking for binary data, including `0x00` and `0xff`.
- byte string chunking that preserves Unicode code point boundaries.
- fixed version exact split and single-symbol rejection.
- auto version chooses the smallest common version that yields `2..maxSymbols`.
- non-byte segment too large for fixed version throws `DataTooLongError`.
- low-level structured append segment is rejected.
- ECI / FNC1 first / FNC1 second / `gs1: true` are rejected.
- parity equals canonical payload byte stream XOR.
- per-symbol diagnostics have matching `index`, `total`, `parity`, sequence fields, byte offsets, and segment ranges.
- packed package smoke and TypeScript declaration smoke.
- deterministic golden fixture with fixed version / ECC / mask for a mixed manual-segment payload.

Golden fixture suggestions:

- `structured-append-segments-boundary-v1-l-mask0`: multiple small segments split only at segment boundary.
- `structured-append-segments-byte-chunk-v1-l-mask1`: one binary byte segment split into multiple symbols.
- `structured-append-segments-kanji-atomic-v2-m-mask2`: kanji segment remains atomic and diagnostics prove segment range.

Decoder validation should remain secondary. Scanner APIs differ in how they expose Structured Append set metadata, so conformance should rely on header bits, parity, matrix / codeword golden fixtures, and diagnostics.

## Rejected Choices

- Split numeric / alphanumeric / kanji segments in the first implementation: rejected to keep manual segment semantics stable and diagnostics easy to audit.
- Accept ECI / FNC1 / GS1 control modes in the first implementation: rejected until ordering and scanner behavior are tested separately.
- Accept low-level `structuredAppend` segment and rewrite it: rejected because high-level API owns the set metadata.
- Return a normal single-symbol QR for one-symbol input: rejected because the function name promises Structured Append semantics.
- Expose public parity override: rejected for the high-level API. Use low-level `structuredAppend` when external parity control is required.
- Allow per-symbol version selection by default: rejected to keep printed symbols visually predictable and diagnostics simple.

## Release Gate For Implementation

The eventual implementation should pass at least:

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

## Non-Scope

- Runtime implementation in this docs-only phase.
- Public parity helper.
- Decoder merge helper.
- ECI / GS1 / FNC1 combinations.
- Numeric / alphanumeric / kanji mid-segment splitting.
- Per-symbol version selection.
- Micro QR / rMQR.
- package version change.
- npm publish / GitHub Release / Pages deploy.
- runtime dependency changes.
