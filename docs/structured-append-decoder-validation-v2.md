# Structured Append Decoder Metadata Validation v2

この文書は、Structured Append の生成 API が揃った後に、読み取り側で `index` / `total` / `parity` metadata を継続検証するための decoder 候補と validation lane を整理する docs-only research note です。

この文書は runtime behavior、public API、package version、package exports、runtime dependency を変更しません。`mergeStructuredAppendParts()` や QR decoder もまだ実装しません。

## Goal

SpecQR は Structured Append symbols を生成できますが、読み取り後に安全に merge できるかどうかは decoder が返す metadata に依存します。単に payload が読めるだけでは、欠落、重複、順序、parity mismatch を検証できません。

この文書では次を固定します。

- Structured Append metadata を返せる decoder / CLI / library 候補。
- `index` / `total` / `parity` を露出するか。
- CI や optional validation に載せやすいか。
- 既存の jsQR / Vision / zbar / ZXing-style optional validation の役割。
- `mergeStructuredAppendParts()` 実装前に必要な fixture と decoder output の条件。

## Summary

現時点の結論は、metadata-returning fixture の第一候補は **ZXing Java**、第二候補は **ZXing-C++ library / CLI** です。

`jsQR`、`zbarimg`、macOS Vision は引き続き decode readability の確認には有用ですが、Structured Append merge helper の release gate には不足します。Scandit は Structured Append metadata を明確に扱う商用 SDK として参考になりますが、SpecQR の OSS CI dependency にはしません。

## Decoder Candidates

| 候補 | Structured Append metadata | index / total / parity | CI / optional validation の向き | 判断 |
| --- | --- | --- | --- | --- |
| ZXing Java | 公式 Javadoc に `STRUCTURED_APPEND_SEQUENCE` と `STRUCTURED_APPEND_PARITY` があり、`Result.getResultMetadata()` で metadata map を取得できる。 | sequence と parity は取得候補。QR の total は metadata key としては明示されないため、実 fixture で sequence value の意味と total の扱いを確認する。 | JVM が必要。test-only fixture helper としては現実的。runtime dependency にはしない。 | metadata fixture の第一候補。 |
| ZXing-C++ | `Barcode` API に `sequenceSize()`, `sequenceIndex()`, `sequenceId()` があり、QR Code の `sequenceId()` は parity integer string とされる。example CLI は `Structured Append: symbol X of N (parity/id: ...)` を出力できる。 | index と total は API / CLI で取得候補。parity は QR では `sequenceId()` として取得候補。 | C++ binary / package install が必要。ローカル optional lane に向く。必須 CI にする前に install path と CLI output を固定する。 | 第二候補。CLI 実測後に optional metadata lane に追加する。 |
| zbar / zbarimg | manpage 上は decoded data、raw output、XML output が中心。Structured Append sequence metadata は確認できない。 | 標準 CLI からは未確認。 | OS package 依存。既存 optional decoder として payload readability には有用。 | metadata fixture には使わない。 |
| jsQR | `binaryData`, `data`, `chunks`, `version`, `location` を返す pure JS decoder。Structured Append index / total / parity は documented return shape にない。 | 未確認。 | devDependency 済みで CI 安定。 | required independent decoder として維持。metadata merge validation には使わない。 |
| macOS Vision | macOS release machine の decode baseline として有用。Apple の public docs では payload / descriptor 系 API は確認できるが、Structured Append sequence metadata はこの調査では確認できない。 | 未確認。 | macOS / Vision 依存。local release check 向き。 | payload decode baseline として維持。metadata fixture には使わない。 |
| Scandit SDK | 公式 docs で structured append sequence id、segment index、segment count、segment data API が示されている。 | index と total は明確。QR の parity 相当は sequence id として扱える可能性があるが、商用 SDK 前提。 | proprietary / commercial SDK。OSS CI dependency には不向き。 | workflow の参考情報に留める。 |

## Current Local Observation

この環境では、次の CLI は install されていませんでした。

- `zbarimg`
- `ZXingReader`
- `zxing`
- `zxing-cpp`
- `zxingscan`

そのため、今回の docs-only sweep では実 CLI output の fixture 化は行っていません。ZXing-C++ については公式 source で API と example output を確認した段階に留め、実 binary を導入するかどうかは次の optional validation 実装で判断します。

## Recommended Validation Lanes

### Required payload decoder lane

現状維持です。

```sh
npm run verify:decode:jsqr
```

目的:

- dependency-free generator output が、少なくとも 1 つの independent pure JS decoder で読めることを確認する。
- Structured Append metadata ではなく、通常 payload readability の release gate として扱う。

### Optional payload decoder lane

現状の optional multi-decoder script は維持します。

```sh
npm run verify:decode:optional
```

目的:

- `jsQR`、`zbarimg`、ZXing-style CLI が存在すれば decode mismatch を検出する。
- 存在しない decoder は skip にする。
- FNC1 や Structured Append の semantics をこの lane だけで保証しない。

### Future optional metadata lane

将来追加する場合の候補名:

```sh
npm run verify:decode:structured-append
```

または metadata 目的をより明確にする場合:

```sh
npm run verify:decode:structured-append:metadata
```

初期実装の推奨:

1. ZXing Java の小さな test-only helper を prototype する。
2. SpecQR が生成した 2-symbol / 3-symbol Structured Append PNG fixtures を読む。
3. decoded per-symbol payload と `STRUCTURED_APPEND_SEQUENCE` / `STRUCTURED_APPEND_PARITY` を JSON に落とす。
4. total count が取得できない場合は、その decoder を `mergeStructuredAppendParts()` の完全 fixture には使わず、metadata partial lane として扱う。
5. ZXing-C++ CLI がローカルで使える環境では、`sequenceIndex()` / `sequenceSize()` / `sequenceId()` 相当の CLI output も optional に検証する。

この lane は、metadata が安定して取れることを確認するまで required CI gate にしません。

## Merge Helper Preconditions

`mergeStructuredAppendParts()` を public API として実装する前に、少なくとも次を満たす fixture が必要です。

- decoder が merged payload ではなく per-symbol data を返すこと。
- 各 symbol について `index` が取得できること。
- 各 symbol について `total` が取得できること。
- 各 symbol について QR Structured Append parity と同等の id が取得できること。
- missing symbol を作った fixture で欠落を検出できること。
- duplicate symbol fixture で重複を検出できること。
- total mismatch fixture で不一致を検出できること。
- parity mismatch fixture で不一致を検出できること。
- string data と binary data の扱いが decoder output 上で区別できる、または helper 側で明確に制限できること。
- decoder が自動 merge した結果と per-symbol data を混同しないこと。
- CI / local release machine に載せる install 手順と license 方針が明確であること。

この条件が揃うまでは、SpecQR の conformance は生成側の header / parity / matrix / diagnostics / golden fixtures を主根拠にし、読み取り後 merge helper は docs-only proposal に留めます。

## Fixture Plan

metadata lane を実装するときの最小 fixture set:

- 2-symbol ASCII text split。
- 3-symbol binary split。
- manual segments split で byte segment chunking を含む case。
- fixed Version / ECC / mask の deterministic case。
- missing index case。
- duplicate index case。
- parity mismatch case。
- total mismatch case。

decoder が total count を返さない場合は、missing / duplicate / total mismatch を SpecQR 側で完全検証できません。その場合は `mergeStructuredAppendParts()` の前提を満たさないため、fixture は metadata partial として扱います。

## Documentation Policy

Structured Append の docs では、次を必ず分けて説明します。

- generator conformance: SpecQR が QR symbols を正しく構成できること。
- decoder readability: ある decoder が payload を読めること。
- decoder metadata: merge helper に必要な `index` / `total` / `parity` が取れること。
- application merge: caller が scanner output を集めて logical message に戻すこと。

これらを混ぜると、「読めたから安全に merge できる」という誤解が生まれるため、release notes / README / API docs でも同じ分類を維持します。

## References

- ZXing Java `ResultMetadataType`: https://zxing.github.io/zxing/apidocs/com/google/zxing/ResultMetadataType.html
- ZXing Java `Result`: https://zxing.github.io/zxing/apidocs/com/google/zxing/Result.html
- ZXing-C++ repository: https://github.com/zxing-cpp/zxing-cpp
- ZXing-C++ `Barcode.h`: https://raw.githubusercontent.com/zxing-cpp/zxing-cpp/master/core/src/Barcode.h
- ZXing-C++ `ZXingReader.cpp`: https://raw.githubusercontent.com/zxing-cpp/zxing-cpp/master/example/ZXingReader.cpp
- zbarimg manpage: https://manpages.debian.org/bookworm/zbar-tools/zbarimg.1.en.html
- jsQR README: https://github.com/cozmo/jsQR
- Apple Vision `VNBarcodeObservation`: https://developer.apple.com/documentation/vision/vnbarcodeobservation
- Scandit structured append codes: https://docs.scandit.com/next/sdks/linux/barcode-capture/structured-append-codes/
