# Structured Append Decoder Metadata Validation v2

この文書は、Structured Append の生成 API と `mergeStructuredAppendParts()` が揃った後に、読み取り側で `index` / `total` / `parity` metadata を継続検証するための decoder 候補と validation lane を整理する research note です。

この文書自体は runtime behavior、public API、package version、package exports、runtime dependency を変更しません。SpecQR は QR decoder を実装しません。`mergeStructuredAppendParts()` は metadata-returning decoder が返した parts を検証・結合する helper として実装済みです。

## Goal

SpecQR は Structured Append symbols を生成できますが、読み取り後に安全に merge できるかどうかは decoder が返す metadata に依存します。単に payload が読めるだけでは、欠落、重複、順序、parity mismatch を検証できません。

この文書では次を固定します。

- Structured Append metadata を返せる decoder / CLI / library 候補。
- `index` / `total` / `parity` を露出するか。
- CI や optional validation に載せやすいか。
- 既存の jsQR / Vision / zbar / ZXing-style optional validation の役割。
- `mergeStructuredAppendParts()` を外部 decoder metadata と組み合わせて検証するために必要な fixture と decoder output の条件。

## Summary

現時点の結論は、metadata-returning fixture の第一候補は **ZXing Java**、第二候補は **ZXing-C++ library / CLI** です。ZXing Java については optional prototype として `npm run verify:structured-append:zxing-java` を追加済みです。

`jsQR`、`zbarimg`、macOS Vision は引き続き decode readability の確認には有用ですが、Structured Append merge helper の release gate には不足します。Scandit は Structured Append metadata を明確に扱う商用 SDK として参考になりますが、SpecQR の OSS CI dependency にはしません。

## Decoder Candidates

| 候補 | Structured Append metadata | index / total / parity | CI / optional validation の向き | 判断 |
| --- | --- | --- | --- | --- |
| ZXing Java | 公式 Javadoc に `STRUCTURED_APPEND_SEQUENCE` と `STRUCTURED_APPEND_PARITY` があり、`Result.getResultMetadata()` で metadata map を取得できる。 | 8-bit sequence indicator と parity を取得する。SpecQR 側では sequence indicator の上位 4 bit から `index`、下位 4 bit から `total` を復元して diagnostics と照合する。 | JVM と ZXing core jar/classes が必要。任意 script として提供し、runtime dependency や必須 CI gate にはしない。 | optional metadata prototype を実装済み。 |
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

### Optional ZXing Java metadata lane

ZXing Java prototype は独立 script として提供します。

```sh
npm run verify:structured-append:zxing-java
```

この script は `verify:decode:optional` には統合しません。理由は、既存 optional decoder script が payload readability を横断的に見る lane である一方、ZXing Java prototype は Structured Append の metadata semantics を検証する lane だからです。classpath、Java compiler、ZXing API version の前提も違うため、独立 script の方が skip / unsupported の意味を明確にできます。

検出方法:

- `ZXING_CLASSPATH`: 必須。ZXing Java core jar または classes directory を指定する。複数 entry は platform の classpath delimiter で区切る。
- `JAVA`: 任意。未指定なら `java` を使う。
- `JAVAC`: 任意。未指定なら `javac` を使う。

例:

```sh
ZXING_CLASSPATH=/path/to/core-3.5.3.jar npm run verify:structured-append:zxing-java
```

Skip 条件:

- `ZXING_CLASSPATH` が未設定。
- `JAVA` / `java` が実行できない。
- `JAVAC` / `javac` が実行できない。
- classpath に ZXing core classes がない。
- ZXing Java が `STRUCTURED_APPEND_SEQUENCE` / `STRUCTURED_APPEND_PARITY` を持たない。
- decode は成功したが Result metadata に Structured Append sequence / parity がない。

Mismatch 条件:

- decoded payload が SpecQR の per-symbol payload chunk と一致しない。
- decoded sequence indicator が SpecQR diagnostics の `sequenceIndicator` と一致しない。
- sequence indicator から復元した `index` / `total` が SpecQR diagnostics と一致しない。
- decoded parity が SpecQR diagnostics の `parity` と一致しない。

現在の fixture:

- `generateStructuredAppend()` の 2-symbol string case: `"A".repeat(31)`、Version 1-L、alphanumeric。
- `generateStructuredAppend()` の 3-symbol string case: `"B".repeat(43)`、Version 1-L、alphanumeric。
- `generateStructuredAppend()` の binary input case: ASCII byte payload、Version 1-L、byte mode。
- `generateSegmentsStructuredAppend()` の segment boundary split case: alphanumeric / numeric / byte segments を symbol boundary で分割。
- `generateSegmentsStructuredAppend()` の byte segment chunking case: 1 つの byte segment を複数 symbols に chunking。
- fixed Version / ECC / mask deterministic case: Version 2-Q、mask 3、alphanumeric。

script は SpecQR で PNG artifacts を一時生成し、同じ入力から取った diagnostics と ZXing Java の Result metadata を照合します。Java helper は実行時に一時 directory へ生成・compile され、Maven / Gradle project は作りません。ImageIO と ZXing core classes だけを使い、ZXing javase jar は必須にしません。

実 decode が通った場合に確認できること:

- ZXing Java が各 symbol を per-symbol payload として返し、SpecQR の expected payload chunk と一致すること。
- ZXing Java の sequence indicator が SpecQR diagnostics の `structuredAppend.sequenceIndicator` と一致すること。
- sequence indicator の上位 4 bit / 下位 4 bit から復元した `index` / `total` が SpecQR diagnostics と一致すること。
- ZXing Java の parity metadata が SpecQR diagnostics の `structuredAppend.parity` と一致すること。
- `diagnostics.symbols[]` の summary metadata と、各 symbol result の `diagnostics.structuredAppend` が一致していること。

この check は decoder が metadata を返すことの prototype であり、missing / duplicate / parity mismatch / total mismatch の negative merge validation までは保証しません。

### Future metadata expansion

次に広げる場合の候補:

- ZXing-C++ CLI がローカルで使える環境では、`sequenceIndex()` / `sequenceSize()` / `sequenceId()` 相当の CLI output も optional に検証する。
- missing / duplicate / parity mismatch / total mismatch の negative fixture を追加する。

この lane は、metadata が安定して取れることを確認するまで required CI gate にしません。

## External Decoder Preconditions

`mergeStructuredAppendParts()` は public API として実装済みですが、外部 decoder を使って release gate 化するには、少なくとも次を満たす fixture が必要です。

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

この条件が安定するまでは、SpecQR の conformance は生成側の header / parity / matrix / diagnostics / golden fixtures と `mergeStructuredAppendParts()` の unit / packed smoke を主根拠にします。外部 decoder metadata validation は optional lane として扱います。

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
