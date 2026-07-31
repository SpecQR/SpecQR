# Internal Architecture

SpecQR の public surface を保ったまま内部実装を変更するための責務境界です。この文書に記載する `src/internal/*` は package tarball には含まれますが、`package.json` の export map からは公開しません。内部 artifact や helper を semver contract として扱わないでください。

## Refactor Baseline

2026-07-30、`18da5bc1e2ca1cb7d4249b0c886fb0b88f643ee9` を基点とする current working tree で測定しました。

| 項目 | Refactor 前 | Refactor 後 |
| --- | ---: | ---: |
| `src/index.js` | 1,814 lines / top-level function declarations 70 | 208 lines / `QRCode` forwarding methods 30 |
| Root named exports | 42 | 42 |
| Package subpaths | root / `browser` / `node` | 変更なし |
| Runtime dependencies | 0 | 0 |

Refactor 前の `src/index.js` は public facade、Version 探索、capacity preflight、segment planning、codeword/ECC/matrix build、renderer dispatch、diagnostics adapter、Structured Append split と summary を同時に所有していました。Refactor 後は public binding と `QRCode` compatibility facade だけを置きます。

## Module Responsibilities

| Module | Responsibility | Must not own |
| --- | --- | --- |
| `src/index.js` | Public named exports、error exports、thin `QRCode` static facade | planning、matrix build、render branch、Structured Append split |
| `src/internal/generation.js` | Single-symbol public orchestration、options normalization、manual segment normalization、canvas entrypoint、raw GS1 parser adapter | Version search math、ECC/matrix internals |
| `src/internal/planning.js` | Capacity query、safe oversized-input preflight、Version/ECC selection、segment planning、planning metadata helpers | Rendering、matrix construction、public facade |
| `src/internal/build.js` | Immutable plan から data codewords、ECC/interleave、matrix/mask を一度だけ構築 | Options normalization、output dispatch |
| `src/internal/diagnostics-adapter.js` | Planning/build artifact を既存 diagnostics / estimate result shape へ変換 | Core encoding、warning rule の複製 |
| `src/internal/render-result.js` | Build artifact から matrix/SVG/PNG/Data URL と既存 return shape を作る | Planning、Structured Append split |
| `src/internal/structured-append.js` | Raw/manual capacity preflight、compact/virtual split source、parity policy、range-only split search、per-symbol single-build、summary diagnostics | Low-level QR core の複製、public exports |
| `src/internal/bytes.js` | UTF-8 canonical byte length/parity と code point count | QR mode selection |
| `src/options.js` | Public options normalization の唯一の source of truth | Output allocation |
| `src/render/geometry.js` | Renderer 共通 checked geometry と deterministic budget | QR planning |
| `src/diagnostics.js` | Warning rule と diagnostics field assembly の唯一の source of truth | Planning/build orchestration |

## Dependency Direction

```text
src/index.js
  -> public GS1 / error / parity modules
  -> internal/generation.js
       -> internal/planning.js
       -> internal/render-result.js
            -> internal/build.js
            -> internal/diagnostics-adapter.js
                 -> internal/planning.js
  -> internal/structured-append.js
       -> internal/planning.js
       -> internal/build.js
       -> internal/diagnostics-adapter.js
       -> internal/render-result.js

planning / build / render
  -> encoding / core / diagnostics / renderer low-level modules
```

Low-level modules は `src/index.js` や public facade を import しません。`tests/internal-architecture.test.js` は `src` の static import/export graph を走査し、循環 import を継続検出します。

## Data Flow

### Single Symbol

```text
generate(input, options)
  -> normalizeOptions
  -> selectPlanForInput
  -> buildResultArtifact
  -> renderResultArtifact
  -> public output
```

Planning API は build/render を実行しません。

```text
estimate(input, options)
  -> normalizeOptions
  -> selectPlanForInput
  -> diagnostics adapter
  -> QREstimateResult
```

### Manual Segments

`generateSegments()` / `analyzeSegments()` は manual segments を一度 normalize し、同じ `selectPlanForManualSegments()` と byte-count policy を共有します。ECI、FNC1、Structured Append control segment の prepend/validation は planning layer の既存順序を維持します。

### Structured Append

```text
input preparation
  -> safe total-capacity lower-bound preflight
  -> compact raw source / manual segment descriptors
  -> deterministic split selection
       range probes only; failed candidates are not materialized
  -> for each final chunk:
       materialize the selected range
       plan once
       build artifact once
       derive summary diagnostics
       render requested output from the same artifact
  -> top-level summary
```

Split feasibility probe は plan だけを行います。最終 symbol の encoding、ECC、matrix build は1回です。`diagnostics: false` の matrix/PNG path で不要な SVG を構築しません。

Raw binary は view/range、raw string は 64 code points ごとの sparse index、manual
input は source segment ごとの descriptor を使います。v3 candidate の manual
standard summary は virtual source の `splitUnitCount` だけを読み、
`materializeSplitUnits()` を呼びません。Full opt-in だけが成功後に一度
public `diagnostics.splitUnits` を materialize します。Preflight と memory complexity は
[Structured Append Memory Hardening](./structured-append-memory.md) を参照してください。

## Internal Artifact Boundary

`buildResultArtifact(plan, options)` の結果は現在、次の内部情報を束ねます。

- shallow freeze された planning result と segment collection
- data capacity bits
- interleaved data/ECC codeword metadata
- matrix、selected mask、mask penalties

この object は renderer と diagnostics adapter が共有します。public return value には直接露出せず、root/node/browser export や TypeScript declarations にも追加しません。field 追加・再編は、characterization、golden、Nayuki、conformance gates を通す限り内部変更として扱えます。

## Behavior Invariants

内部変更では次を維持します。

- Public named export と `QRCode` static method の集合
- `package.json` の root/node/browser export map
- Matrix rows、mask tie-break、codewords、SVG/PNG/Data URL bytes
- Diagnostics field、warning order、Planning result
- Error class、code、message
- GS1 / Digital Link result shape
- Structured Append split position、parity、symbol order、summary
- Renderer budget、single-symbol/high-level Structured Append oversized-input
  preflight、streaming parity、compact split source、single-build
- Runtime dependency 0、ESM-first、Node.js `>=18`

`tests/architecture-characterization.test.js` は代表 public result の SHA-256 と contract shape を固定します。既存 golden fixture は matrix/core conformance、同テストは public orchestration compatibility を担当します。

## Benchmark

性能値は SLA や CI threshold ではありません。同一 process、1回 warm-up 後の5回中央値です。Input は 20,000 ASCII bytes、Version 25-L、auto mask、16 symbols、matrix output です。Manual case は単一 20,000-byte segment を使います。

| Case | Refactor 前 median | Refactor 後 median |
| --- | ---: | ---: |
| Raw、diagnostics off | 231.58 ms | 124.54 ms |
| Raw、diagnostics on | 234.28 ms | 132.73 ms |
| Manual segments、diagnostics off | 406.48 ms | 125.58 ms |

CPU load、JIT、GC により値は変動します。Correctness gate は時間/RSS ではなく、single-build call count、byte-level characterization、golden、Nayuki、deterministic properties を使います。

## Future Changes

次の API/type precision work では、runtime implementation を再び facade へ戻さず、公開 overload/declaration だけを上記 internal contract へ合わせます。とくに監査 finding AUD-06〜10 は、個別の characterization を追加してから修正し、architecture refactor と挙動変更を混ぜません。
