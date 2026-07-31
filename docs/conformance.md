# Conformance Matrix

この文書は現在の SpecQR main branch、package version `3.0.0-rc.1`
candidate の対応範囲を、外から確認しやすい形で整理したものです。RC は未公開です。
v2 系の stable API を維持し、RC 1 では manual Structured Append diagnostics
contract だけを major 変更として扱います。SpecQR は通常 QR Code Model 2
generation を対象にしていますが、ISO/IEC 18004:2024 の全文に対する完全準拠を
ここでは断言しません。ISO 本文や仕様表の無断転載は行わず、実装・テスト・
外部比較で確認している範囲を明記します。

Status は次の意味で使います。

- `Tested`: 実装済みで、unit / golden / decoder / external reference のいずれかで継続検証しています。
- `Supported`: 実装済みですが、検証は隣接テストまたは限定的な smoke に留まります。
- `Partial`: 意図的に範囲を絞って対応しています。
- `Planned`: docs-only proposal として設計済みですが、runtime API はまだ実装していません。
- `RC candidate / tested`: prerelease metadata へ統合済みで in-repo gate は
  ありますが、npm publish 前で stable support claim ではありません。
- `Not supported`: 現在の core package の対象外です。

v2 系の release scope は [SpecQR v2 Roadmap](./v2-roadmap.md) に分けています。この matrix では現在の実装状態を主に示し、正式 release 後に残す領域は各 section の notes で明示します。

## External Conformance Lab

この in-repo matrix は、SpecQR core repository がサポートする範囲と、その範囲をどの種類の test / fixture / reference comparison で確認しているかを説明します。公開済み npm package を外部から検証する report は [SpecQR Conformance Lab](https://specqr.github.io/SpecQR-Conformance-Lab/) に分けています。

Conformance Lab は現在、公開済み stable `specqr@2.4.0` を対象にしています。
3.0.0-rc.1 は未公開なので、Lab の badge/report を RC 検証済みの証拠として
扱いません。Lab は published package の jsQR decode readability、Nayuki
fixed-condition matrix comparison、GS1 / Digital Link helper、Structured
Append helper、Planning / Diagnostics API の結果を外部 report として記録します。
Micro QR、rMQR、full GS1 catalog、full QR reader、logo / styled QR は Lab の
現在の検証範囲にも含めません。

## Core QR Code Model 2

| 項目 | Status | 現在の確認範囲 |
| --- | --- | --- |
| QR Code Model 2 | Tested | Version 1-40 の通常 QR Code Model 2 を対象にし、別系統の Micro QR / rMQR は含めません。 |
| Version 1-40 | Tested | capacity selection、matrix size、version 7+ information、Version 10 / 27 境界を unit / golden tests で確認しています。 |
| Error correction L/M/Q/H | Tested | Reed-Solomon codeword generation、block interleaving、boosting behavior を unit / golden tests で確認しています。 |
| Numeric mode | Tested | auto / fixed mode / manual segment / Version 10・27 境界 / Nayuki reference comparison を確認しています。 |
| Alphanumeric mode | Tested | auto / fixed mode / manual segment / Version 10・27 境界 / Nayuki reference comparison を確認しています。 |
| Byte mode | Tested | UTF-8 text、binary input、0x00 / 0xff payload、ArrayBufferView offset、Nayuki reference comparison を確認しています。 |
| Kanji mode | Tested | Shift_JIS-compatible QR Kanji ranges、auto segmentation、manual Kanji segment、fallback / reject behavior を確認しています。 |
| ECI | Tested | UTF-8 assignment number 26、manual ECI segment、mixed capacity edge、Nayuki reference comparison を確認しています。 |
| Character count indicator | Tested | 1-9 / 10-26 / 27-40 の mode-specific bit width を unit tests で確認しています。 |
| Capacity calculation | Tested | exact-fit / max+1 `DataTooLongError`、diagnostics の `dataBitLength` / `capacityBits` / `remainingBits` を確認しています。 |
| Reed-Solomon | Tested | GF arithmetic、ECC bytes、interleaved codeword stream を unit / golden tests で確認しています。 |
| Format information | Tested | fixed ECC / mask の format bits を golden tests で独立計算と比較しています。 |
| Version information | Tested | Version 7+ の version bits と placement を golden tests で確認しています。 |
| Mask patterns 0-7 | Tested | fixed mask、auto mask、all-mask diagnostics、Nayuki reference comparison を確認しています。 |
| Mask penalty | Tested | N1 / N2 / N3 / N4 rule 単体と実生成時の selected mask / penalty consistency を確認しています。 |
| Data placement | Tested | matrix rows、function pattern、data module count、remainder bits を golden tests で固定しています。 |
| Remainder bits | Tested | Version ごとの data module count と total codewords から golden tests で確認しています。 |
| Quiet zone | Tested | SVG / PNG / canvas / diagnostics warnings で margin handling を確認しています。 |

## Input / API / GS1

| 項目 | Status | 現在の確認範囲 |
| --- | --- | --- |
| JavaScript string input | Tested | UTF-8 byte mode、auto segmentation、Kanji segmentation を確認しています。 |
| Binary input | Tested | `Uint8Array`、`ArrayBuffer`、`ArrayBufferView`、byte array、0x00 / 0xff payload を確認しています。 |
| Manual segments | Tested | `numeric` / `alphanumeric` / `byte` / `kanji` / `eci` / `fnc1` / `fnc1-second` / `structured-append` を確認しています。 |
| FNC1 first position | Tested | mode indicator `0101`、`gs1: true`、manual `{ mode: "fnc1" }`、diagnostics を確認しています。 |
| FNC1 second position | Tested | mode indicator `1001`、8-bit Application Indicator、`fnc1Second` option、manual `{ mode: "fnc1-second" }`、diagnostics、golden fixture、invalid combination rejection を確認しています。 |
| GS1 helper | Partial | 代表 AI の human-readable parser / raw element string parser / element string builder / Digital Link URI builder/parser / separator insertion / GTIN・SSCC check digit helper / Digital Link role metadata を確認しています。Supported AI metadata は [Supported GS1 AIs](./gs1-supported-ai.md) にまとめた current supported AI に限定し、全 AI catalog と業界別 rule は対象外です。 |
| GS1 raw element string parser | Tested | `parseGs1ElementString()` の fixed-length sequence、variable final AI、separator handling、builder round-trip、human-readable round-trip、invalid input rejection を確認しています。 |
| GS1 validation API | Tested | `getSupportedGs1Ais()`、`getGs1AiInfo(ai)`、`validateGs1Elements()`、`validateGs1ElementString()`、`validateGs1DigitalLink()`、GS1 detail error code、packed package smoke、TypeScript surface を確認しています。Metadata は detached deep-frozen copy で、mutation が後続 introspection / validation へ伝播しないことも確認します。Type の readonly 化は互換性上の v3 decision です。Digital Link validation / normalization の境界は [GS1 Digital Link Validation v2.2 Design](./gs1-digital-link-validation-v2.2.md) に固定しています。 |
| GS1 Digital Link | Partial / tested | `createGs1DigitalLink()` で supported AI から通常 URL QR 用の Digital Link URI を生成し、`parseGs1DigitalLink()` で URI を element data に戻せます。`validateGs1DigitalLink()` は URI を non-throwing result として検証し、`normalizeGs1DigitalLink()` は SpecQR deterministic policy で URI string を再出力します。Percent-encoded AI value、unknown query preserve / reject、repeated query key、path/query mixed placement、http warning、fragment / duplicate / invalid placement / invalid check digit rejection、idempotency、packed package smoke、examples smoke、playground の Digital Link validation / normalization 表示を確認しています。現在の output は deterministic builder / normalizer であり、resolver、compression、full canonicalizer は未実装です。 |
| Structured Append low-level header | Tested | mode indicator `0011`、1-based public index / total / parity validation、0-based sequence encoding、option / manual segment、diagnostics、golden fixture、invalid combination rejection を確認しています。 |
| Structured Append high-level splitting | Tested | `generateStructuredAppend()` / `QRCode.generateStructuredAppend()`、string / binary input、original payload byte parity、deterministic greedy split、fixed / auto Version selection、maxSymbols、symbol diagnostics、packed package smoke、examples smoke、playground source、fixed version / ECC / mask golden fixture を確認しています。さらに total-capacity preflight、binary view、sparse text index、150,000-unit low-heap reject、16-symbol boundary を [Structured Append Memory Hardening](./structured-append-memory.md) と専用 gate で固定します。 |
| Structured Append manual segment splitting | Tested | `generateSegmentsStructuredAppend()` / `QRCode.generateSegmentsStructuredAppend()`、segment-boundary split、byte segment safe chunking、numeric / alphanumeric / kanji atomic behavior、control segment rejection、canonical parity、per-symbol diagnostics、packed package smoke、fixed version / ECC / mask golden fixture を確認しています。Internal source は segment descriptor を使い、canonical bytes / split units の全量事前生成を行いません。v3 candidate の standard summary は split-unit object を生成せず、full opt-in だけが成功後に一度生成します。Manual segments 専用 parity helper `calculateStructuredAppendSegmentsParity()` も同じ canonical logical bytes policy を確認しています。 |
| v3 compact Structured Append diagnostics | RC candidate / tested | Standard/full `splitUnits` contract、nested option、discriminated type、migration を [v3 Structured Append Diagnostics Contract](./v3-structured-append-diagnostics.md) どおり `3.0.0-rc.1` metadata へ統合しています。Unit、golden projection、bounded/extended fuzz、canonical tarball の packed runtime/types、Chromium/Firefox/WebKit serialization、Version 40-L / 16-symbol memory gate を確認します。未公開 RC であり、stable support claim ではありません。 |
| Structured Append decoded parts merge | Tested | `mergeStructuredAppendParts()` / `QRCode.mergeStructuredAppendParts()` は、decoder が返した `{ index, total, parity, data }` parts だけを対象に、missing、duplicate、total mismatch、parity mismatch、string/binary 混在、payload byte parity を検証して結合します。scanner adapter example では ZXing Java style metadata mapping、string / binary merge、metadata-less decoder の制限を確認しています。SpecQR は decoder や scanner integration は提供しません。読み取り workflow と metadata-returning decoder 候補は [Structured Append Scanning Workflow](./structured-append-scanning-v2.md) と [Structured Append Decoder Metadata Validation](./structured-append-decoder-validation-v2.md) に整理しています。 |
| Structured Append parity helper | Tested | `calculateStructuredAppendParity(input)` / `QRCode.calculateStructuredAppendParity(input)` は、UTF-8 string、`Uint8Array`、`ArrayBuffer`、`ArrayBufferView` offset / length、`number[]`、empty input、invalid input、`generateStructuredAppend()` / `mergeStructuredAppendParts()` parity consistency、TypeScript surface、packed package smoke を確認しています。Manual segments 専用 `calculateStructuredAppendSegmentsParity(segments)` / `QRCode.calculateStructuredAppendSegmentsParity(segments)` は、numeric / alphanumeric ASCII、byte string UTF-8、byte binary raw bytes、ArrayBufferView offset / length、Kanji UTF-8、control segment rejection、`generateSegmentsStructuredAppend()` parity consistency、150,000-byte streaming parity、TypeScript surface、packed package smoke を確認しています。詳細は [Structured Append Parity Helper v2.3](./structured-append-parity-v2.3.md)、[Structured Append Manual Segments Parity Helper v2.3](./structured-append-segments-parity-v2.3.md)、[Resource Safety](./resource-safety.md) に整理しています。 |
| Planning / diagnostics API | Tested | `estimate()` / `QRCode.estimate()`、`analyzeSegments()` / `QRCode.analyzeSegments()`、`getCapacity()` / `QRCode.getCapacity()` を実装済みです。String / binary input、Kanji、GS1、FNC1 second、low-level Structured Append、manual control segments、capacity overflow の non-throwing result、既存 diagnostics との planning field 一致、capacity table surface、TypeScript surface、examples smoke、playground source、packed package smoke を確認しています。詳細は [Planning / Diagnostics API v2.4](./planning-diagnostics-v2.4.md) に整理しています。 |

## Rendering / Runtime Helpers

| 項目 | Status | 現在の確認範囲 |
| --- | --- | --- |
| Matrix output | Tested | boolean matrix shape、rows hash、diagnostics shape を unit / golden tests で確認しています。 |
| SVG output | Tested | dimensions、quiet zone、colors、decoder validation fixtures を確認しています。 |
| PNG output | Tested | PNG signature、dimensions、decoder validation fixtures を確認しています。 |
| Canvas drawing | Tested | canvas target validation、dimensions、module drawing を unit tests で確認しています。TypeScript gate は DOM なし custom mock と DOM あり実 `HTMLCanvasElement` / `CanvasRenderingContext2D` の structural compatibility を確認します。Playwright gate は実 `HTMLCanvasElement` / 2D context の dimensions、代表 pixel、return contract を 3 engines で確認します。 |
| Node helper | Tested | `toPngBuffer()`、`writePngFile()`、examples smoke を確認しています。 |
| Browser helper | Tested | Node 上の helper test、DOM/Bundler 型解決、packed browser subpath import に加え、installed tarball を native ESM import した Chromium / Firefox / WebKit で Blob、segment Blob、ImageData、Object URL fetch/revoke、transparent RGBA、download、resource error を確認します。 |
| Transparent background | Tested | renderer color parsing、PNG/canvas behavior、warnings を確認しています。 |
| Diagnostics / warnings | Tested | capacity、quiet zone、contrast、scan risk、print DPI、mask/version selection reason を確認しています。 |
| Resource safety | Tested | 全 renderer/helper の checked geometry、raster/vector/Data URL budgets、matrix-only 非制限、20,000-character low-heap reject、150,000-byte parity、Structured Append single-pass/compact split source/150,000-unit early reject、overflow warning semantics を `npm test`、`verify:resource-safety`、`verify:structured-append:memory` で確認します。 |

## Validation

| 項目 | Status | 現在の確認範囲 |
| --- | --- | --- |
| Unit tests | Tested | core encoding、matrix、renderer、helpers、errors、GS1 を `npm test` で確認します。 |
| Golden fixtures | Tested | fixed version / ECC / mask の matrix、codewords、diagnostics、format/version bits、remainder bits を固定します。 |
| Decoder validation | Tested | macOS Vision、jsQR required gate、optional zbar / ZXing CLI discovery に加え、Structured Append metadata を固定版 ZXing Java 3.5.4 で読む required 専用 job を用意しています。`npm run verify:structured-append:zxing-java` は packed package から 10 fixtures / 44 symbols を生成し、sequence/parity metadata を diagnostics へ照合します。JDK/dependency 取得不能や metadata 欠落は skip せず failure です。 |
| External reference comparison | Partial / tested | Nayuki QR Code generator と Version 1-40 × ECC L/M/Q/H × mask 0-7 の全 1280 fixed-condition matrix を比較します。numeric / alphanumeric / byte / binary / manual mixed / ECI を全 Version range に分散します。auto segmentation、Kanji、GS1 semantics、renderer output は比較対象外です。 |
| Deterministic conformance / fuzzing | Tested | 固定 seed の bounded suite で 1280 differential cases と 8 property × 32 cases を継続検証します。auto Version / mask、Planning、manual equivalence、GS1 / Digital Link、Structured Append contract を含み、case ID による単独再実行と extended mode を提供します。詳細は [Deterministic Conformance / Fuzzing](./conformance-fuzzing.md) を参照してください。 |
| Resource-safety gate | Tested | 32 MiB V8 old-space child process と deterministic preflight assertions で oversized single-symbol input、large parity、renderer allocation failure、高レベル Structured Append の oversized raw/manual reject と 16-symbol success を確認します。時間/RSS threshold は gate に使いません。 |
| Architecture characterization | Tested | Public export/static surface、matrix/SVG/PNG/Data URL bytes、diagnostics/Planning、GS1/Digital Link、Structured Append、errors を専用 test で固定します。Static module graph の cycle と facade 責務も検査します。詳細は [Internal Architecture](./internal-architecture.md) を参照してください。 |
| Public API / TypeScript contract | Tested | Literal/dynamic generate overload、DOM 有無の canvas consumer、legacy option policy、GS1 metadata mutation boundary を source type/runtime tests で固定します。詳細は [Public API / TypeScript Contract](./public-api-contract.md) を参照してください。 |
| Canonical release artifact | RC candidate / tested | 一回目の `npm pack` で tarball SHA-256 と全 file content manifest を生成し、二回目の pack との expanded-content 一致、allow/deny policy を確認します。同じ artifact を Node 18 / 20 / 22 / 24、packed/type、browser、ZXing へ渡します。詳細は [Release Artifact Verification](./release-artifact.md) を参照してください。 |
| Packed subpath/type gate | Tested | canonical tarball を隔離 install し、root/node/browser の exact runtime exports と代表呼出し、installed declarations に対する NodeNext/Bundler compile、packaged examples を確認します。Source direct import には依存しません。Artifact 指定なしの local command だけは self-pack します。 |
| Real browser E2E | Tested | 独立 Playwright harness が canonical packed `specqr` / `specqr/browser` と build 済み `dist/pages` だけを local server から実行し、Chromium / Firefox / WebKit で各10件、合計 30 tests を確認します。Branded Safari、実端末/mobile、scanner、network/CDN、visual fidelity は non-claims です。詳細は [Browser E2E](./browser-e2e.md) を参照してください。 |
| Writing / release metadata | RC candidate / tested | `verify:writing` が Markdown prose、workflow display text、package discovery metadata の明確な spacing、unit、正式名称を確認します。code、URL、path などは除外し、人による editorial review と併用します。詳細は [Project Language and Writing Style](./project-language.md) を参照してください。 |

## ISO/IEC 18004:2024 Notes

SpecQR の現在の対象は通常 QR Code Model 2 です。Version、mode、format / version information、masking、Reed-Solomon、remainder bits など、通常 QR Code Model 2 generation に必要な主要領域はテストで固定しています。

ただし、ISO/IEC 18004:2024 の全項目を網羅監査したものではありません。2015 版との差分、Micro QR、rMQR、その他 domain-specific usage は今後の確認範囲として扱います。

## v2 Readiness Notes

v2 系は、通常 QR Code Model 2 core を維持したまま、GS1 syntax layer、GS1 Digital Link、Structured Append、control segment model、検証体系を強化する stable release line として扱います。FNC1 second position、Structured Append low-level header、Structured Append high-level splitting、manual segments splitting、decoded parts merge helper、GS1 validation result API の基本実装は完了済みです。release gate は [SpecQR v2 Roadmap](./v2-roadmap.md) と [Test Plan](./test-plan.md) を参照してください。

| 項目 | v2 系での扱い | 理由 |
| --- | --- | --- |
| Full GS1 AI catalog / strict validation | Remaining | 現在は代表 AI に限定した strict parser / validator です。Metadata expansion は AI group ごとに validation と tests を揃えて v2 後 backlog として進めます。 |
| GS1 validation result API | Tested | 既存 throwing API を維持しながら UI / form validation 向けの non-throwing result API と supported AI introspection API を追加しています。詳細 error code と catalog expansion policy は [GS1 Validation v2.1 Design](./gs1-validation-v2.1.md) に固定しています。 |
| GS1 Digital Link helper | Partial / tested | `createGs1DigitalLink()` と `parseGs1DigitalLink()` は minimal create/parse + role metadata として実装済みです。2.2.0 stable では `validateGs1DigitalLink()` を non-throwing validation API、`normalizeGs1DigitalLink()` を throwing deterministic normalization API として公開します。Resolver、compression、full canonicalizer は [GS1 Digital Link Validation v2.2 Design](./gs1-digital-link-validation-v2.2.md) に non-scope として残しています。 |
| Control segment model | Partial / tested | ECI、FNC1 first、FNC1 second、Structured Append low-level header の ordering / capacity / diagnostics は実装済みです。 |
| FNC1 second position | Tested | 通常 QR Code Model 2 の optional FNC1 coverage として実装済みです。Decoder による symbology identifier の露出差は unit / golden diagnostics で補います。 |
| Structured Append high-level | Tested | Model 2 の multi-symbol generation を自動分割、parity calculation、symbol diagnostics まで扱います。API shape は [Structured Append v2 API Design](./structured-append-v2.md)、capacity/memory invariant は [Structured Append Memory Hardening](./structured-append-memory.md) に固定済みです。 |
| Structured Append manual segments | Tested | `generateSegmentsStructuredAppend()` は [Structured Append Manual Segments v2 API Design](./structured-append-segments-v2.md) に従い、segment boundary split と byte segment safe chunking で実装済みです。Internal 探索は descriptor/range based です。v3 candidate では standard diagnostics は compact、full opt-in は v2 array 互換です。 |
| v3 compact `splitUnits` | RC candidate / tested | [v3 Structured Append Diagnostics Contract](./v3-structured-append-diagnostics.md) の major migration を `3.0.0-rc.1` metadata へ統合済みです。npm publish 前なので、published v2 系の contract とは区別します。 |
| Structured Append scanner workflow | Partial / tested | scanner metadata の有無による workflow、metadata が取れた場合の `mergeStructuredAppendParts()`、missing / duplicate / parity mismatch handling を [Structured Append Scanning Workflow](./structured-append-scanning-v2.md) に整理しました。ZXing Java required fixture は [Structured Append ZXing Java Verification](./structured-append-zxing-java.md) に固定しています。QR decoder / scanner integration と全 scanner 互換は未対応です。 |
| Structured Append parity helper | Tested | low-level `structuredAppend` 利用者向けの `calculateStructuredAppendParity(input)` と、manual segments 向けの `calculateStructuredAppendSegmentsParity(segments)` は実装済みです。string は UTF-8、binary input は original bytes、`ArrayBufferView` は offset / length を尊重します。manual segments helper は `generateSegmentsStructuredAppend()` と同じ canonical logical bytes を使い、control segments を reject します。 |
| v2 validation expansion | Tested / ongoing | 新しい control feature は decoder 表示が揺れやすいため、golden / bitstream / matrix / diagnostics / packed smoke を組み合わせます。Structured Append sequence/parity は ZXing Java 3.5.4 required lane でも確認しますが、1 decoder の結果を全 scanner 互換とは主張しません。 |

## v2 Outside Scope

次の項目は現在未対応であり、v2 系の中心 scope にも含めません。別 symbol family や visual customization を同時に進めると、v2 の GS1 / control segment / Structured Append の検証範囲が広がりすぎるためです。

- Micro QR
- rMQR
- Frame QR
- SQRC
- Logo overlay
- Styled modules
- Other visual customization helpers
- CJS build
- Minified browser build
