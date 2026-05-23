# External Reference Comparison

この文書は、SpecQR の conformance tests と decoder validation に加えて、外部参照実装との比較で何を確認しているかを説明します。

## Reference Implementation

現在の release-gate reference comparison は、devDependency の `nayuki-qr-code-generator@1.8.0` を使います。

- Upstream: Nayuki QR Code generator library
- npm package: `nayuki-qr-code-generator`
- License: MIT
- Dependency type: devDependency only
- Runtime impact: none

Nayuki 実装は fixed version、fixed error correction level、fixed mask を指定できるため、SpecQR の fixed-condition matrix と比較しやすい参照実装として採用しています。

## Command

```sh
npm run verify:reference:nayuki
```

CI でもこの script を実行します。

## 比較しているもの

各 case で、SpecQR と Nayuki に同じ条件を渡し、次を比較します。

- `version`
- `size`
- `maskPattern`
- full matrix rows
- matrix SHA-256 hash

現在の比較 case は次の通りです。

| Case | Payload / Segments | Version | ECC | Mask | 比較内容 |
| --- | --- | --- | --- | --- | --- |
| `numeric-v1-l-mask0` | Numeric `"01234567"` | 1 | L | 0 | matrix exact match |
| `alphanumeric-v1-m-mask1` | Alphanumeric `"HELLO WORLD"` | 1 | M | 1 | matrix exact match |
| `byte-v2-q-mask2` | Byte `"https://example.com"` | 2 | Q | 2 | matrix exact match |
| `manual-mixed-v3-q-mask5` | Alphanumeric + numeric + byte | 3 | Q | 5 | matrix exact match |
| `eci-utf8-byte-v2-q-mask6` | ECI 26 + UTF-8 byte `"こんにちは"` | 2 | Q | 6 | matrix exact match |
| `binary-v1-q-mask7` | Byte data with `0x00` and `0xff` | 1 | Q | 7 | matrix exact match |

## 比較していないもの

参照実装との完全一致を過剰に主張しないため、次は comparison scope から外しています。

- Auto segmentation: 合法な segment selection の差が出るため。
- Auto mask selection: penalty tie-break や implementation detail の差が出るため。
- Kanji mode: npm package の public helper が Kanji segment construction を直接提供していないため。SpecQR 側では golden / unit / decoder tests で検証します。
- GS1 / FNC1 semantics: decoder や参照実装によって symbology identifier や FNC1 の扱いが異なるため。SpecQR 側では bit length、control segment、diagnostics、helper validation を unit / golden tests で検証します。
- SVG / PNG / canvas rendering: 参照実装は matrix generator として使い、renderer comparison には使いません。
- Diagnostics shape: SpecQR 固有の API surface なので external reference の対象外です。

## Decoder Validation との違い

Decoder validation は「生成した SVG / PNG を実 decoder が読めるか」を確認します。これは実利用互換性を見るための検証です。

Reference comparison は「固定条件で構築された matrix が独立実装と一致するか」を確認します。これは QR construction の regression を検出するための検証です。

両者は役割が違います。Decoder が読めることは matrix の全 bit が参照実装と一致することを保証しません。一方で、参照実装と matrix が一致しても、renderer の quiet zone、色、scale、実 scanner 互換性までは保証しません。

## Other Candidates

次の実装・tool は追加候補として扱いますが、v1 系では必須 dependency にしません。

- Segno: Python package。固定条件比較に向きますが、Node-only CI では追加 runtime が増えます。
- Zint: CLI / native dependency。ローカル環境にある場合の optional validation 向きです。
- libqrencode / `qrencode`: CLI / native dependency。matrix 出力の parsing が必要で、環境差もあります。
- bwip-js: JavaScript package。barcode coverage は広い一方、fixed mask / diagnostics 比較に必要な低レベル制御を確認してから採用します。

これらは、環境に存在しない場合でも core release gate を壊さない optional validation として追加する方針です。

## v2.0.0 Planning Notes

v2.0.0 の計画範囲は [SpecQR v2.0.0 Roadmap](./v2-roadmap.md) にまとめています。v2 で強化する GS1 strict validation、GS1 Digital Link、FNC1 second position、Structured Append は、Nayuki matrix comparison だけでは十分に検証できません。FNC1 second position と Structured Append low-level header の基本実装は golden / unit tests で固定済みです。

- GS1 semantics: FNC1、AI validation、separator handling、Digital Link conversion は domain-level behavior なので、unit / golden tests と docs で確認します。`createGs1DigitalLink()` と `parseGs1DigitalLink()` は unit / packed package smoke で確認します。
- FNC1 second position: decoder や参照実装によって application indicator の露出方法が異なるため、bit length、control segment placement、diagnostics、negative tests を優先します。
- Structured Append: low-level sequence、total count、parity、diagnostics は SpecQR API と golden fixtures で固定します。High-level chunking policy は未実装のため今後の専用 tests で扱います。
- Digital Link: URL QR として生成できる一方、GS1 element string とは別表現なので、reference matrix comparison ではなく conversion tests を中心にします。

参照実装比較は今後も fixed-condition QR construction regression のために使い、v2 feature の semantics は専用 tests と conformance docs で補完します。

## Current Result

`npm run verify:reference:nayuki` は、現在 6/6 case で SpecQR と Nayuki の full matrix rows が一致することを確認します。現時点で既知の差分はありません。
