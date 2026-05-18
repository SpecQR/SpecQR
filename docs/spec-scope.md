# 仕様対応範囲

## Target

SpecQR `1.0.0-rc.2` は、実務で使う通常の QR Code Model 2 generation を対象にします。v1 RC では「通常 QR Code を安定して生成する」ことを優先し、別系統の QR family や装飾機能は core に混ぜません。

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
- `fnc1`, `numeric`, `alphanumeric`, `byte`, `kanji`, `eci` の manual segment API
- Automatic mixed-segment optimization
- UTF-8 と explicit assignment number 向けの optional ECI metadata
- GS1 QR Code / FNC1 first position mode
- 代表的な fixed-length / variable-length AI 向けの GS1 element string helper と human-readable parser
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
- quiet zone、contrast、capacity、mask/version selection、scan risk、print DPI の diagnostics / warnings

## Compatibility Notes

Kanji mode は、platform の `TextDecoder("shift_jis")` 実装を使って Unicode character を QR-compatible Shift_JIS double-byte value に対応付けます。runtime が Shift_JIS `TextDecoder` を持たない場合、explicit Kanji mode は input を reject し、auto mode は byte mode に fallback します。

`eci: true` は byte-mode text が UTF-8 であることを明示するための option です。そのため、ECI が有効な場合、auto segmentation は non-ASCII text を byte mode に保ちます。explicit manual Kanji segment は引き続き利用できます。

`gs1: true` は FNC1 first position を先頭に挿入し、input が raw GS1 element string であることを期待します。`parseGs1HumanReadable()` は対応 AI の parentheses notation を `{ ai, value }[]` に変換し、`createGs1ElementString()` は値を検証して、必要な位置に ASCII GS (`"\x1D"`) separator を挿入します。全 GS1 AI catalog validation、業界別 AI rule、check digit validation、FNC1 second position はこの phase には含めません。ECI と GS1/FNC1 first position は control-mode ordering が曖昧になるため併用を reject します。

package は ESM-first です。`specqr`, `specqr/node`, `specqr/browser` の separate export を持ちます。CommonJS と minified browser build は build pipeline を導入するまで生成しません。source package は dependency-free runtime を保ちます。

## v1 RC で意図的に対象外とするもの

次の機能は core Model 2 package には実装していません。

- FNC1 second position
- Full GS1 AI catalog validation
- Industry-specific GS1 AI rules
- GS1 check digit validation
- Structured Append
- Micro QR
- rMQR
- Frame QR
- SQRC
- Logo overlay
- Styled modules
- Browser playground

## v1 後の Roadmap

通常 QR Code Model 2 以外の symbol family や domain extension は、core に直接混ぜず、別 module として扱う方針です。

- `@specqr/gs1`: full GS1 AI validation、check-digit helpers、追加の GS1 domain helpers
- `@specqr/structured-append`: multi-symbol splitting
- `@specqr/micro`: Micro QR implementation
- `@specqr/rmqr`: rectangular QR implementation
- `@specqr/styled`: logo / module styling helpers と scan-risk diagnostics

## Design Principle

core generator は optional platform helper から独立させます。Matrix generation、Reed-Solomon error correction、data placement、mode encoding、mask selection は、browser や Node file system API なしで test できる状態を保ちます。
