# 仕様対応範囲

## Target

SpecQR は、実務で使う通常の QR Code Model 2 generation を対象にします。SpecQR `2.0.0` は、GS1 strict parser、GS1 Digital Link、FNC1 second position、Structured Append generation / manual segments / merge helper まで含む v2.0.0 stable scope です。別系統の QR family や装飾機能は core に混ぜません。

対応状況の表は [Conformance Matrix](./conformance.md) に、外部参照実装との比較範囲は [External Reference Comparison](./reference-comparison.md) に分けています。

v2.0.0 の release scope は [SpecQR v2.0.0 Roadmap](./v2-roadmap.md) にまとめています。v2.0.0 は Micro QR や rMQR のような別 symbol family ではなく、GS1 syntax layer、GS1 Digital Link、FNC1 second position、Structured Append、control segment model、検証体系の強化を中心にします。FNC1 second position、Structured Append low-level header encoding、Structured Append high-level splitting、manual segments splitting、`mergeStructuredAppendParts()` は実装済みです。Structured Append の string / binary 分割方針は [Structured Append v2 API Design](./structured-append-v2.md) に、manual segments 版は [Structured Append Manual Segments v2 API Design](./structured-append-segments-v2.md) に、読み取り側 workflow と merge helper の境界は [Structured Append Scanning Workflow](./structured-append-scanning-v2.md) に、metadata-returning decoder 候補は [Structured Append Decoder Metadata Validation](./structured-append-decoder-validation-v2.md) に分けています。GS1 Digital Link helper の設計は [GS1 Digital Link v2 Design](./gs1-digital-link-v2.md) に分けています。

v2.1.0 は GS1 validation release として、supported AI catalog の段階的拡張、AI metadata introspection、non-throwing validation result、GS1 detail error code、GS1 QR Code / GS1 Digital Link の誤用防止を扱う予定です。現時点では [GS1 Validation v2.1 Design](./gs1-validation-v2.1.md) に docs-only proposal として固定しており、runtime behavior、public API、package version は変更していません。

## 実装済み範囲

- QR Code Model 2 のみ
- Version 1 から 40
- Error correction levels L, M, Q, H
- JavaScript string input
- byte array、`Uint8Array`、`ArrayBuffer`、`ArrayBufferView` binary input
- Numeric mode
- Alphanumeric mode
- UTF-8 byte mode
- QR Kanji ranges で表現できる文字向けの Shift_JIS-based QR Kanji mode
- `structured-append`, `fnc1`, `fnc1-second`, `numeric`, `alphanumeric`, `byte`, `kanji`, `eci` の manual segment API
- Automatic mixed-segment optimization
- UTF-8 と explicit assignment number 向けの optional ECI metadata
- GS1 QR Code / FNC1 first position mode
- FNC1 second position mode
- Structured Append low-level header mode
- Structured Append high-level automatic splitting API
- Structured Append manual segments high-level splitting API
- 代表的な fixed-length / variable-length AI 向けの GS1 element string helper、human-readable parser、Digital Link URI builder
- GTIN / SSCC check digit helper と、AI `00`/`01`/`02` の check digit validation
- 選択 Version を増やさない optional error correction boosting
- Automatic version selection
- Automatic mask selection
- Matrix output
- SVG output
- SVG Data URL output
- PNG output
- PNG Data URL output
- Browser canvas drawing
- Node PNG buffer/file helpers
- Browser Blob/ImageData/Object URL helpers
- 実利用向け examples。Node PNG、GS1 QR、GS1 Digital Link、Structured Append SVG/PNG symbol output を含みます。
- 小さな browser playground。通常 QR / GS1 / Structured Append mode、複数 symbol preview、diagnostics / warnings を確認できます。
- quiet zone、contrast、capacity、mask/version selection、scan risk、print DPI の diagnostics / warnings

## Compatibility Notes

Kanji mode は、platform の `TextDecoder("shift_jis")` 実装を使って Unicode character を QR-compatible Shift_JIS double-byte value に対応付けます。runtime が Shift_JIS `TextDecoder` を持たない場合、explicit Kanji mode は input を reject し、auto mode は byte mode に fallback します。

`eci: true` は byte-mode text が UTF-8 であることを明示するための option です。そのため、ECI が有効な場合、auto segmentation は non-ASCII text を byte mode に保ちます。explicit manual Kanji segment は引き続き利用できます。

`gs1: true` は FNC1 first position を先頭に挿入し、input が raw GS1 element string であることを期待します。この generation path は raw payload を internal validator に通し、unsupported AI、invalid length、invalid charset、invalid GTIN / SSCC check digit、missing separator などを `InvalidGs1Error` として reject します。`parseGs1HumanReadable()` は対応 AI の parentheses notation を `{ ai, value }[]` に変換し、`createGs1ElementString()` は値を検証して、必要な位置に ASCII GS (`"\x1D"`) separator を挿入します。GTIN / SSCC check digit helper と AI `00`/`01`/`02` の check digit validation は実装済みです。全 GS1 AI catalog validation と業界別 AI rule はこの phase には含めません。ECI と GS1/FNC1 first position は control-mode ordering が曖昧になるため併用を reject します。

`fnc1Second` は FNC1 second position を先頭に挿入します。これは GS1 QR Code ではなく、AIM International と合意済みの業界・アプリケーション仕様を示す control mode です。Application Indicator は 2 桁数字または 1 文字 Latin alphabetic character に限定し、invalid value は `InvalidModeError` として reject します。SpecQR では FNC1 first / GS1 と FNC1 second の同時利用を reject し、ECI との併用も安全側で reject します。

`structuredAppend` は Structured Append mode indicator `0011`、4-bit 0-based index、4-bit 0-based total count、8-bit parity data を先頭に挿入します。public API では `index` を 1-based とし、`total` は `2..16`、`index` は `1..total`、`parity` は `0..255` integer です。`generateStructuredAppend()` は string / binary input を deterministic greedy largest-fitting で最大 16 symbols に分割し、元 payload bytes の XOR parity を各 symbol の low-level header に設定します。`generateSegmentsStructuredAppend()` は manual data segments を segment boundary first で分割し、byte segment だけを byte / Unicode code point boundary で safe chunking します。numeric / alphanumeric / kanji segment の途中分割は行いません。`mergeStructuredAppendParts()` は decoder が返した `{ index, total, parity, data }` parts だけを対象に、欠落、重複、metadata mismatch、payload byte parity を検証して結合します。public parity helper、QR decoder、scanner integration は提供しません。scanner が自動 merge することや Structured Append metadata を露出することも保証しません。読み取り workflow は [Structured Append Scanning Workflow](./structured-append-scanning-v2.md) に、metadata-returning decoder 候補と optional validation 方針は [Structured Append Decoder Metadata Validation](./structured-append-decoder-validation-v2.md) に整理しています。ECI / FNC1 first / FNC1 second / `gs1: true` との併用は安全側で reject します。

GS1 human-readable 表記は、`(01)04912345678904(10)ABC123` のような入力補助形式です。QR に encode する payload は parentheses を含まない raw GS1 element string です。可変長 AI の後に別の AI が続く場合は ASCII GS separator を挿入します。GS1 Digital Link は URL を使う別表現として扱います。`createGs1DigitalLink()` は supported AI から Digital Link URI を作り、`parseGs1DigitalLink()` は URI を `{ elements, primary, pathElements, queryElements, unknownQuery }` に戻します。Digital Link URI は通常 URL QR として `QRCode.generate(uri)` で生成し、`gs1: true` は指定しません。

GS1 AI metadata は、現時点では SpecQR が対応する代表 AI だけを小さな internal dictionary として手書き管理しています。これは supported AI の length、numeric/text constraint、GTIN / SSCC check digit rule、separator behavior、Digital Link role (`primary-key` / `key-qualifier` / `data-attribute`) を validation から参照しやすくするための内部構造であり、full GS1 AI catalog の取り込みではありません。現在の supported AI は [Supported GS1 AIs](./gs1-supported-ai.md) にまとめています。Digital Link の default path/query placement と path placement validation もこの metadata を使います。将来 GS1 Barcode Syntax Dictionary などの外部資料を参照して catalog を広げる場合は、出典、license / usage terms、NOTICE の要否を確認し、仕様本文や大きな表を repository に無断コピーしない方針です。

raw GS1 element string は `parseGs1ElementString(input)` で `{ elements, hasSeparators }` に読み戻せます。この parser は parentheses を含まない payload を対象にし、fixed-length AI は dictionary の exact length で読み、variable-length AI は ASCII GS separator があれば次 element へ進み、separator なしなら final element として扱います。variable-length AI の後に別 AI が続く場合は separator が必要です。raw element string は括弧がないため、final variable-length value の末尾が supported fixed-length AI に見える曖昧ケースは、推測で分割せず missing separator として reject します。同じ validator は `generate(input, { gs1: true })` と diagnostics にも内部統合しています。`validateGs1ElementString()` は public API ではまだ提供しません。

package は ESM-first です。`specqr`, `specqr/node`, `specqr/browser` の separate export を持ちます。CommonJS と minified browser build は build pipeline を導入するまで生成しません。source package は dependency-free runtime を保ちます。

Node.js runtime は `package.json` の `engines.node` で `>=18` を宣言します。v2 系 stable / patch release では Node 18 / 20 / 22 / 24 で `npm test`、TypeScript consumer check、examples smoke、local pack install smoke、runtime dependency check を通すことを release gate にします。macOS Vision decode、Pages build、jsQR decode、Nayuki reference comparison、Structured Append metadata optional lane、pack dry-run は代表 Node 20 に集約します。

## ISO/IEC 18004:2024 について

SpecQR は通常 QR Code Model 2 generation の実装・検証を進めていますが、ISO/IEC 18004:2024 の全項目について「完全準拠」とは表現しません。Version 1-40、mode encoding、format / version information、Reed-Solomon、masking、remainder bits など、core generation に必要な領域を tests と golden fixtures で固定しています。

2015 版と 2024 版の差分、Micro QR、rMQR などは、今後の監査・別 module の対象です。ISO 本文や仕様表のコピーは repository に含めません。

## 意図的に対象外とするもの

次の機能は core Model 2 package には実装していません。

- Full GS1 AI catalog validation
- Industry-specific GS1 AI rules
- Public GS1 validation result API。v2.1.0 の proposal は [GS1 Validation v2.1 Design](./gs1-validation-v2.1.md) に固定済みですが、現在の runtime にはまだありません。
- GS1 Digital Link non-throwing validator / full canonicalizer
- Structured Append public parity helper
- QR decoder / scanner integration
- Micro QR
- rMQR
- Frame QR
- SQRC
- Logo overlay
- Styled modules

## v2.0.0 後の Backlog

v2.0.0 の詳細な方針は [SpecQR v2.0.0 Roadmap](./v2-roadmap.md) に固定します。v2.0.0 stable では、通常 QR Code Model 2 core を維持したまま GS1 / control segment / Structured Append の実用 layer を揃えています。正式 release 後は次を優先します。

- GS1 syntax layer: full AI catalog に近い parser / validator、strict element string handling、check digit validation の拡張。
- GS1 validation API: `getSupportedGs1Ais()`、`getGs1AiInfo(ai)`、`validateGs1Elements()`、`validateGs1ElementString()` の v2.1.0 proposal を起点に、throwing API と non-throwing API の責務を分ける。
- GS1 Digital Link helper: `createGs1DigitalLink()` / `parseGs1DigitalLink()` の round-trip を起点に、次に full AI catalog metadata、canonicalization、resolver 周辺を検討する。URL-based Digital Link と FNC1 first の GS1 element string QR は API と docs で分ける。
- Control segment model: ECI、FNC1 first、FNC1 second、Structured Append low-level header の ordering / capacity / diagnostics は実装済み。
- FNC1 second position: application indicator validation、encoding、diagnostics、golden fixtures は実装済み。今後は decoder 表示差や ECI 併用方針の再評価を行う。
- Structured Append: low-level header encoding、string / binary high-level automatic splitting API、manual segments high-level splitting API、decoded parts 向け `mergeStructuredAppendParts()` は実装済み。manual segments の分割方針は [Structured Append Manual Segments v2 API Design](./structured-append-segments-v2.md) に、読み取り側 helper の前提は [Structured Append Scanning Workflow](./structured-append-scanning-v2.md) に固定済み。public parity helper と QR decoder / scanner integration は未対応。
- v2 validation expansion: golden / bitstream / matrix / decoder / reference comparison の範囲整理。

通常 QR Code Model 2 以外の symbol family や visual customization は、v2.0.0 には混ぜず、将来の別 module として扱う方針です。

- `@specqr/micro`: Micro QR implementation
- `@specqr/rmqr`: rectangular QR implementation
- `@specqr/styled`: logo / module styling helpers と scan-risk diagnostics

`@specqr/gs1` や `@specqr/structured-append` のような分割 package は、v2.0.0 の実装が大きくなりすぎる場合の将来候補です。v2.0.0 の最初の方針は、既存 `specqr` package の Model 2 scope 内で GS1 / Structured Append を安全に扱えるかを検証することです。

## Design Principle

core generator は optional platform helper から独立させます。Matrix generation、Reed-Solomon error correction、data placement、mode encoding、mask selection は、browser や Node file system API なしで test できる状態を保ちます。
