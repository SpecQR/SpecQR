# Conformance Matrix

この文書は SpecQR `1.0.0-rc.2` 時点の対応範囲を、外から確認しやすい形で整理したものです。SpecQR は通常 QR Code Model 2 generation を対象にしていますが、ISO/IEC 18004:2024 の全文に対する完全準拠をここでは断言しません。ISO 本文や仕様表の無断転載は行わず、実装・テスト・外部比較で確認している範囲を明記します。

Status は次の意味で使います。

- `Tested`: 実装済みで、unit / golden / decoder / external reference のいずれかで継続検証しています。
- `Supported`: 実装済みですが、検証は隣接テストまたは限定的な smoke に留まります。
- `Partial`: 意図的に範囲を絞って対応しています。
- `Not supported`: v1 系の対象外です。

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
| Manual segments | Tested | `numeric` / `alphanumeric` / `byte` / `kanji` / `eci` / `fnc1` を確認しています。 |
| FNC1 first position | Tested | mode indicator `0101`、`gs1: true`、manual `{ mode: "fnc1" }`、diagnostics を確認しています。 |
| GS1 helper | Partial | 代表 AI の parser / element string builder / separator insertion / GTIN・SSCC check digit helper を確認しています。全 AI catalog と業界別 rule は対象外です。 |
| GS1 Digital Link | Not supported | 通常 URL として QR 化できますが、GS1 Digital Link 専用 helper / validation は未実装です。 |
| FNC1 second position | Not supported | v1 系では対象外です。 |
| Structured Append | Not supported | v1 系では対象外です。 |

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
| Decoder validation | Tested | macOS Vision script、jsQR release-gate、optional zbar / ZXing CLI discovery を用意しています。 |
| External reference comparison | Partial | Nayuki QR Code generator と fixed-condition matrix を比較します。auto segmentation、Kanji、GS1 semantics、renderer output は比較対象外です。 |

## ISO/IEC 18004:2024 Notes

SpecQR の現在の対象は通常 QR Code Model 2 です。Version、mode、format / version information、masking、Reed-Solomon、remainder bits など、通常 QR Code Model 2 generation に必要な主要領域はテストで固定しています。

ただし、ISO/IEC 18004:2024 の全項目を網羅監査したものではありません。2015 版との差分、Structured Append、Micro QR、rMQR、FNC1 second position、その他 domain-specific usage は今後の確認範囲として扱います。

## v1 系で対象外のもの

- Micro QR
- rMQR
- Structured Append
- FNC1 second position
- Full GS1 AI catalog validation
- GS1 Digital Link helper
- Logo overlay
- Styled modules
- CJS build
- Minified browser build
