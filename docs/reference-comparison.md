# External Reference Comparison

この文書は、SpecQR の conformance tests と decoder validation に加えて、外部参照実装との比較で何を確認しているかを説明します。

## Reference Implementation

release-gate comparison は devDependency の `nayuki-qr-code-generator@1.8.0` を使います。

- Upstream: Nayuki QR Code generator library
- npm package: `nayuki-qr-code-generator`
- License: MIT
- Dependency type: devDependency only
- Runtime impact: none

Nayuki 実装は fixed Version、fixed error correction level、fixed mask、manual segments を指定できるため、SpecQR の fixed-condition matrix と比較する test-only reference として採用しています。

## Commands

reference lane だけを実行:

```sh
npm run verify:reference:nayuki
```

metamorphic property と reference lane をまとめた release gate:

```sh
npm run verify:conformance:fuzz
```

両 script は `tools/lib/nayuki-differential.js` の同じ 1280-case engine を使います。GitHub Actions の代表 Node 20 release job は `verify:conformance:fuzz` を一回実行し、同じ comparison を二重実行しません。`verify:reference:nayuki` はローカルで reference failure だけを調査する entry point です。

## Combination Coverage

次の直積を一回ずつ比較します。

| Dimension | Coverage |
| --- | --- |
| Version | 1..40 |
| ECC | L / M / Q / H |
| mask | 0..7 |
| Total | 1280 fixed-condition cases |

case taxonomy:

- numeric
- alphanumeric
- UTF-8 byte text
- raw binary byte data（`0x00` / `0xff` と offset view を含む）
- manual alphanumeric / numeric / byte mixed segments
- ECI assignment 26 + byte segment

taxonomy は Version 1-9、10-26、27-40 の全 range に分散します。割り当ては固定 seed から deterministic に決まり、各 range に全 taxonomy が存在することを script 自身が確認します。

## Compared Fields

各 case で次を比較します。

- full matrix の全 module
- Version
- matrix size
- fixed mask
- ECC
- segment data bit length
- data capacity / remaining bits
- data codeword count
- ECC codeword count
- total codeword count

比較は一件ずつ行い、全 1280 matrix を memory に保持しません。

## Reproduction

既定 seed:

```sh
npm run verify:reference:nayuki -- --seed 0x5eedc0de
```

一件だけ再実行する例:

```sh
npm run verify:reference:nayuki -- \
  --seed 0x5eedc0de \
  --case nayuki:v10:q:m3:alphanumeric
```

failure message は実際の case ID、input / segments、options、exact replay command を出します。case ID は seed による taxonomy 割り当てを含むため、手で推測せず failure output の値を使います。

## Not Compared

参照実装との完全一致を過剰に主張しないため、次は differential scope から外します。

- Auto segmentation: 合法な segment selection policy が異なり得るため。
- Auto mask selection: SpecQR の 8 fixed candidates と diagnostics の整合を metamorphic property で確認します。
- Kanji mode: 現在利用している npm reference surface では同じ Kanji segment を直接構築しないため。
- GS1 / FNC1 semantics: AI validation、separator、symbology metadata は matrix reference だけで判断しないため。
- GS1 Digital Link: URI construction / normalization は SpecQR 固有の public contract であるため。
- Structured Append high-level splitting / merge: chunk policy と decoder metadata handling は reference matrix の責務外であるため。
- SVG / PNG / canvas / browser rendering。
- scanner / camera / print compatibility。
- SpecQR 固有 diagnostics の wording や warning policy。ただし data/capacity/codeword metadata は数値比較します。

これらは unit、golden、decoder、metamorphic property、packed package smoke に分けます。詳細は [Deterministic Conformance / Fuzzing](./conformance-fuzzing.md) と [Test Plan](./test-plan.md) を参照してください。

## Decoder Validation との違い

Decoder validation は生成した SVG / PNG を実 decoder が読めるか確認します。reference comparison は fixed condition の matrix が独立実装と一致するか確認します。

Decoder が読めることは全 bit の一致を保証しません。一方、matrix が一致しても renderer の quiet zone、色、scale、実 scanner 互換性までは保証しません。両者は別の release evidence です。

## Conformance Lab との関係

repository 内の gate は local source tree の regression を検出します。[SpecQR Conformance Lab](https://specqr.github.io/SpecQR-Conformance-Lab/) は公開済み npm package と外部 vector set の report を別 repository で記録します。core 側の変更は Conformance Lab の責務や report artifact を変更しません。

## Current Result

既定 seed `0x5eedc0de` では 1280/1280 fixed-condition cases が SpecQR と Nayuki で一致しています。これは上記 comparison scope 内の結果であり、ISO/IEC 18004 全文への認証済み完全準拠や全 scanner 互換性を意味しません。
