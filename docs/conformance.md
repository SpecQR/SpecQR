# Conformance Matrix

この文書は現在の SpecQR main branch の対応範囲を、外から確認しやすい形で整理したものです。v2.0.0 release finalization 前のため package version はまだ `1.0.0` のままですが、matrix は現在実装済みの GS1 strict parser、GS1 Digital Link、FNC1 second position、Structured Append API まで含めます。SpecQR は通常 QR Code Model 2 generation を対象にしていますが、ISO/IEC 18004:2024 の全文に対する完全準拠をここでは断言しません。ISO 本文や仕様表の無断転載は行わず、実装・テスト・外部比較で確認している範囲を明記します。

Status は次の意味で使います。

- `Tested`: 実装済みで、unit / golden / decoder / external reference のいずれかで継続検証しています。
- `Supported`: 実装済みですが、検証は隣接テストまたは限定的な smoke に留まります。
- `Partial`: 意図的に範囲を絞って対応しています。
- `Not supported`: 現在の core package の対象外です。

v2.0.0 の release scope は [SpecQR v2.0.0 Roadmap](./v2-roadmap.md) に分けています。この matrix では現在の実装状態を主に示し、正式 release 後に残す領域は各 section の notes で明示します。

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
| GS1 helper | Partial | 代表 AI の human-readable parser / raw element string parser / element string builder / Digital Link URI builder/parser / separator insertion / GTIN・SSCC check digit helper / Digital Link role metadata を確認しています。Supported AI metadata は current supported AI に限定し、全 AI catalog と業界別 rule は対象外です。 |
| GS1 raw element string parser | Tested | `parseGs1ElementString()` の fixed-length sequence、variable final AI、separator handling、builder round-trip、human-readable round-trip、invalid input rejection を確認しています。 |
| GS1 Digital Link | Partial | `createGs1DigitalLink()` で supported AI から通常 URL QR 用の Digital Link URI を生成し、`parseGs1DigitalLink()` で URI を element data に戻せます。現在の output は deterministic builder であり、default path/query placement と invalid path placement rejection は dictionary role metadata で確認しています。resolver、compression、full canonicalizer は未実装です。 |
| Structured Append low-level header | Tested | mode indicator `0011`、1-based public index / total / parity validation、0-based sequence encoding、option / manual segment、diagnostics、golden fixture、invalid combination rejection を確認しています。 |
| Structured Append high-level splitting | Tested | `generateStructuredAppend()` / `QRCode.generateStructuredAppend()`、string / binary input、original payload byte parity、deterministic greedy split、fixed / auto Version selection、maxSymbols、symbol diagnostics、packed package smoke、examples smoke、playground source、fixed version / ECC / mask golden fixture を確認しています。 |
| Structured Append manual segment splitting | Tested | `generateSegmentsStructuredAppend()` / `QRCode.generateSegmentsStructuredAppend()`、segment-boundary split、byte segment safe chunking、numeric / alphanumeric / kanji atomic behavior、control segment rejection、canonical parity、per-symbol diagnostics、packed package smoke、fixed version / ECC / mask golden fixture を確認しています。Public parity helper は未対応です。 |
| Structured Append decoded parts merge | Tested | `mergeStructuredAppendParts()` / `QRCode.mergeStructuredAppendParts()` は、decoder が返した `{ index, total, parity, data }` parts だけを対象に、missing、duplicate、total mismatch、parity mismatch、string/binary 混在、payload byte parity を検証して結合します。scanner adapter example では ZXing Java style metadata mapping、string / binary merge、metadata-less decoder の制限を確認しています。SpecQR は decoder や scanner integration は提供しません。読み取り workflow と metadata-returning decoder 候補は [Structured Append Scanning Workflow](./structured-append-scanning-v2.md) と [Structured Append Decoder Metadata Validation](./structured-append-decoder-validation-v2.md) に整理しています。 |

## Rendering / Runtime Helpers

| 項目 | Status | 現在の確認範囲 |
| --- | --- | --- |
| Matrix output | Tested | boolean matrix shape、rows hash、diagnostics shape を unit / golden tests で確認しています。 |
| SVG output | Tested | dimensions、quiet zone、colors、decoder validation fixtures を確認しています。 |
| PNG output | Tested | PNG signature、dimensions、decoder validation fixtures を確認しています。 |
| Canvas drawing | Tested | canvas target validation、dimensions、module drawing を unit tests で確認しています。 |
| Node helper | Tested | `toPngBuffer()`、`writePngFile()`、examples smoke を確認しています。 |
| Browser helper | Tested | Blob / ImageData / Object URL helper と browser example source を確認しています。 |
| Transparent background | Tested | renderer color parsing、PNG/canvas behavior、warnings を確認しています。 |
| Diagnostics / warnings | Tested | capacity、quiet zone、contrast、scan risk、print DPI、mask/version selection reason を確認しています。 |

## Validation

| 項目 | Status | 現在の確認範囲 |
| --- | --- | --- |
| Unit tests | Tested | core encoding、matrix、renderer、helpers、errors、GS1 を `npm test` で確認します。 |
| Golden fixtures | Tested | fixed version / ECC / mask の matrix、codewords、diagnostics、format/version bits、remainder bits を固定します。 |
| Decoder validation | Tested | macOS Vision script、jsQR release-gate、optional zbar / ZXing CLI discovery を用意しています。Structured Append metadata は ZXing Java 向けの optional prototype `npm run verify:structured-append:zxing-java` を追加済みで、string / binary / manual segment split / byte chunking / fixed deterministic cases を対象にします。ただし ZXing Java classpath / Java runtime / javac がある環境だけで実行し、required CI gate にはしていません。 |
| External reference comparison | Partial | Nayuki QR Code generator と fixed-condition matrix を比較します。auto segmentation、Kanji、GS1 semantics、renderer output は比較対象外です。 |

## ISO/IEC 18004:2024 Notes

SpecQR の現在の対象は通常 QR Code Model 2 です。Version、mode、format / version information、masking、Reed-Solomon、remainder bits など、通常 QR Code Model 2 generation に必要な主要領域はテストで固定しています。

ただし、ISO/IEC 18004:2024 の全項目を網羅監査したものではありません。2015 版との差分、Micro QR、rMQR、その他 domain-specific usage は今後の確認範囲として扱います。

## v2.0.0 Readiness Notes

v2.0.0 は、通常 QR Code Model 2 core を維持したまま、GS1 syntax layer、GS1 Digital Link、Structured Append、control segment model、検証体系を強化する release として準備しています。FNC1 second position、Structured Append low-level header、Structured Append high-level splitting、manual segments splitting、decoded parts merge helper の基本実装は完了済みです。release gate は [SpecQR v2.0.0 Roadmap](./v2-roadmap.md) と [Test Plan](./test-plan.md) を参照してください。

| 項目 | v2.0.0 での扱い | 理由 |
| --- | --- | --- |
| Full GS1 AI catalog / strict validation | Remaining | 現在は代表 AI に限定した strict parser / validator です。Metadata expansion は AI group ごとに validation と tests を揃えて v2 後 backlog として進めます。 |
| GS1 Digital Link helper | Partial / tested | `createGs1DigitalLink()` と `parseGs1DigitalLink()` は minimal create/parse + role metadata として実装済みです。resolver、compression、full canonicalizer は [GS1 Digital Link v2 Design](./gs1-digital-link-v2.md) に deferred として残しています。 |
| Control segment model | Partial / tested | ECI、FNC1 first、FNC1 second、Structured Append low-level header の ordering / capacity / diagnostics は実装済みです。 |
| FNC1 second position | Tested | 通常 QR Code Model 2 の optional FNC1 coverage として実装済みです。Decoder による symbology identifier の露出差は unit / golden diagnostics で補います。 |
| Structured Append high-level | Tested | Model 2 の multi-symbol generation を自動分割、parity calculation、symbol diagnostics まで扱います。API shape と release gate は [Structured Append v2 API Design](./structured-append-v2.md) に固定済みです。 |
| Structured Append manual segments | Tested | `generateSegmentsStructuredAppend()` は [Structured Append Manual Segments v2 API Design](./structured-append-segments-v2.md) に従い、segment boundary split と byte segment safe chunking で実装済みです。 |
| Structured Append scanner workflow | Partial / tested | scanner metadata の有無による workflow、metadata が取れた場合の `mergeStructuredAppendParts()`、missing / duplicate / parity mismatch handling を [Structured Append Scanning Workflow](./structured-append-scanning-v2.md) に整理しました。metadata-returning decoder fixture の候補と ZXing Java optional validation prototype は [Structured Append Decoder Metadata Validation](./structured-append-decoder-validation-v2.md) に整理しています。QR decoder / scanner integration は未対応です。 |
| v2 validation expansion | Tested / ongoing | 新しい control feature は decoder 表示が揺れやすいため、golden / bitstream / matrix / diagnostics / packed smoke を組み合わせて確認します。ZXing Java metadata validation は optional lane のままです。 |

## v2.0.0 Outside Scope

次の項目は現在未対応であり、v2.0.0 の中心 scope にも含めません。別 symbol family や visual customization を同時に進めると、v2 の GS1 / control segment / Structured Append の検証範囲が広がりすぎるためです。

- Micro QR
- rMQR
- Frame QR
- SQRC
- Logo overlay
- Styled modules
- Other visual customization helpers
- CJS build
- Minified browser build
