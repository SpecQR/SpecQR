# Structured Append Decoder Metadata Validation

この文書は、Structured Append の読み取り検証を payload readability と metadata
interoperability へ分け、各 decoder lane の責務を整理します。SpecQR は QR decoder
や scanner integration を public runtime へ追加しません。

## Current Lanes

| Lane | Status | Purpose |
| --- | --- | --- |
| jsQR | Required | 通常 fixture の portable payload decode |
| macOS Vision | Required on macOS release job | Apple platform での payload decode |
| ZXing Java 3.5.4 | Required dedicated CI job | Structured Append sequence/parity metadata |
| zbar / ZXing-style CLI discovery | Optional | 利用可能な local decoder で payload を補助確認 |
| ZXing-C++ | Not integrated | 将来の第二 metadata 実装候補 |

required ZXing Java lane の構成、pin、fixture、mapping、report、non-claims は
[Structured Append ZXing Java Verification](./structured-append-zxing-java.md)
に固定します。

## Why Metadata Needs a Separate Gate

Structured Append symbol の payload が読めるだけでは、次を検証できません。

- sequence index
- expected total
- parity
- missing symbol
- duplicate index
- scan order から独立した merge

ZXing Java は `Result.getResultMetadata()` の
`STRUCTURED_APPEND_SEQUENCE` / `STRUCTURED_APPEND_PARITY` を露出します。
SpecQR は packed package で生成した PNG を同実装で decode し、public diagnostics の
`index`、`total`、`sequenceIndex`、`sequenceTotal`、`sequenceIndicator`、
`parity` へ照合します。

## Required ZXing Java Lane

```sh
npm run verify:structured-append:zxing-java
```

この command は `ZXING_CLASSPATH` 未設定でも固定版 Maven harness を使います。
JDK/dependency 取得不能、decode failure、metadata 欠落、型/sequence semantics の
変化、部分実行は failure です。

fixture には 2/3/16-symbol raw string、UTF-8/astral、raw binary、offset view、
manual mixed、manual byte chunk/boundary、fixed Version/ECC/mask、shuffled scan
order を含めます。string として信頼できる decoded parts は public
`mergeStructuredAppendParts()` で元 payload まで確認します。任意 binary は ZXing
string API の限界により metadata-only とし、理由を machine report へ残します。

## Other Decoders

### jsQR

`jsQR` は pure JavaScript の required independent decoder です。ただし documented
result shape に Structured Append index/total/parity はないため、metadata lane の
代替にはしません。

### macOS Vision

Vision は実 platform decode の証拠ですが、Structured Append metadata を安定した
cross-runtime contract として使いません。

### zbar / CLI Discovery

`npm run verify:decode:optional` は、local に存在する decoder だけを補助実行します。
全 scanner metadata を保証する lane ではなく、required ZXing Java job とは分離
します。

### ZXing-C++

`sequenceSize()` / `sequenceIndex()` / `sequenceId()` を持つため第二実装候補
ですが、現在は binary/toolchain を固定していません。ZXing Java 1実装の成功を
全 ZXing family や全 scanner へ一般化しません。

## Evidence Boundaries

required metadata lane が証明する範囲:

- packed SpecQR package が生成した fixture PNG を ZXing Java 3.5.4 が decode できる。
- sequence/parity metadata が SpecQR diagnostics と一致する。
- set の index が一意かつ欠落なしで、total/parity が共通である。
- 文字列 case の実 decoded parts を scan order と無関係に merge できる。

証明しない範囲:

- damaged/printed/mobile camera symbol の readability。
- arbitrary binary の ZXing text round-trip。
- ZXing Java 以外の metadata semantics。
- scanner による自動 collection/merge。
- 全 QR reader conformance。

したがって、Structured Append conformance は引き続き unit/golden bitstream、
matrix/codeword、diagnostics、Nayuki/reference 可能範囲、resource gates、
packed smoke と組み合わせます。外部 decoder 1実装だけを唯一の根拠にはしません。

## References

- ZXing repository: https://github.com/zxing/zxing
- ZXing `ResultMetadataType`: https://zxing.github.io/zxing/apidocs/com/google/zxing/ResultMetadataType.html
- ZXing `Result`: https://zxing.github.io/zxing/apidocs/com/google/zxing/Result.html
- ZXing-C++ repository: https://github.com/zxing-cpp/zxing-cpp
