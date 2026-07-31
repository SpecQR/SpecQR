# Structured Append ZXing Java Verification

この文書は、SpecQR の Structured Append symbols を ZXing Java で実際に
decode し、sequence / parity metadata を公開 diagnostics と照合する required
verification lane を定義します。

この lane は ZXing Java 1実装との継続互換性を確認するものです。全 scanner 互換、
ISO/IEC 18004全要件への適合、branded 端末 scanner の挙動を保証するものでは
ありません。

## Required Command

```sh
npm run verify:structured-append:zxing-java
```

`ZXING_CLASSPATH` は不要です。JDK 21 がない、Maven/ZXing を取得できない、
metadata が欠落する、fixture の一部しか decode できない場合は skip せず失敗します。

ローカルでは `JAVA_HOME` を JDK 21 へ向けます。canonical CI 環境は
Eclipse Temurin `21.0.11+10` です。

```sh
export JAVA_HOME=/path/to/jdk-21
npm run verify:structured-append:zxing-java
```

`ZXING_CLASSPATH` は既存のローカル override として認識しますが、required contract
は ZXing `3.5.4` です。override 側の実ロード版が異なる場合、version assertion で
失敗します。

## Architecture

1. CI / release では `package-artifact` job の canonical tarball を download する。
   Artifact 指定なしの local command だけは repository を `npm pack --json` する。
2. 選択した tarball を OS temporary directory の隔離 consumer へ install する。
3. consumer 内へ test driver をコピーし、`import ... from "specqr"` だけで fixture を
   生成する。checkout の `src/` は直接 import しない。
4. public `generateStructuredAppend()` /
   `generateSegmentsStructuredAppend()` で PNG と expected diagnostics を作る。
5. Maven Wrapper で Java helper を compile し、各 PNG を ZXing Java で decode する。
6. `STRUCTURED_APPEND_SEQUENCE` / `STRUCTURED_APPEND_PARITY` の型と値を
   diagnostics へ照合する。
7. string payload を信頼できる case では、実 decoded parts を
   `mergeStructuredAppendParts()` へ scan 順のまま渡し、元 payload まで復元する。

成功・失敗の両方で machine-readable `report.json` を OS temporary directory へ
出力し、path を console へ表示します。repository 内へ report、PNG、class、JAR、
cache を生成しないため、成功後の working tree は dirty になりません。

`SPECQR_RELEASE_ARTIFACT_DIR` または `SPECQR_TARBALL` を指定した場合、tarball /
manifest mismatch は failure になり、self-pack や checkout source へ fallback しません。

## Pinned Toolchain

| Component | Pinned version | Source |
| --- | --- | --- |
| Canonical CI JDK | Eclipse Temurin `21.0.11+10` | `actions/setup-java` |
| Java language level | `21` | `maven.compiler.release` |
| Maven Wrapper | `3.3.4` only-script | Maven Central |
| Apache Maven | `3.9.16` | wrapper `distributionUrl` |
| ZXing core | `3.5.4` | Maven Central |
| ZXing javase | `3.5.4` | Maven Central |

Maven distribution は
`distributionSha256Sum=5af3b743dd8b876b5c45da33b676251e5f1687712644abb4ee519ca56e1d89ce`
で検証します。ZXing の実ロード版は JAR 内 `pom.properties` から report へ記録し、
pin と一致しなければ失敗します。

Maven Wrapper / Maven / ZXing は Apache License 2.0 です。取得元と配布境界は
`e2e/zxing-java/NOTICE.md` に記録します。これらは test-only であり、root
`dependencies` や npm tarball には含めません。

## Fixture Contract

現在の bounded set は 10 fixtures、44 symbols です。

| Fixture | Symbols | Input / condition | Payload assertion |
| --- | ---: | --- | --- |
| `raw-string-2-symbol` | 2 | raw alphanumeric string | text merge |
| `raw-string-3-symbol-shuffled` | 3 | shuffled scan order | text merge |
| `raw-string-16-symbol` | 16 | maximum symbol count | text merge |
| `utf8-astral-text` | 6 | UTF-8 / astral code point | text merge |
| `raw-binary` | 3 | `0x00` / `0xff` を含む bytes | metadata only |
| `raw-binary-offset-view` | 3 | offset 付き `Uint8Array` | metadata only |
| `manual-mixed-segments` | 3 | alphanumeric / numeric / byte | text merge |
| `manual-byte-text-chunk` | 3 | text byte segment chunk | text merge |
| `manual-byte-binary-boundary` | 3 | offset 付き binary byte segment | metadata only |
| `fixed-version-ecc-mask` | 2 | Version 2 / Q / mask 3 | text merge |

binary 3 cases を payload assertion から除外するのは skip ではありません。ZXing
`Result.getText()` は任意 bytes を charset-decoded string へ変換するため、
`0x00` / `0xff` を含む元 bytes の同一性を表現できません。これらも全 symbol の
decode、metadata 型、index/total/parity、欠落・重複を必須 assert し、report では
`metadata-only` / `status: "passed"` と理由を残します。

## Metadata Mapping

ZXing:

- `STRUCTURED_APPEND_SEQUENCE`: `java.lang.Integer`
- `STRUCTURED_APPEND_PARITY`: `java.lang.Integer`

sequence 値を `s` とすると、照合規則は次のとおりです。

```text
index             = (s >> 4) + 1
total             = (s & 0x0f) + 1
sequenceIndex     = index - 1
sequenceTotal     = total - 1
sequenceIndicator = s
parity            = STRUCTURED_APPEND_PARITY
```

各 symbol について上記 6 field を SpecQR diagnostics と比較します。set 単位では
index が一意、`1..total` が欠落なし、全 symbol の total/parity が同一であることも
assert します。metadata が null、型が Integer 以外、sequence semantics が変化した
場合は failure です。

## Report

`report.json` は少なくとも次を含みます。

- schema version、status、開始/完了時刻
- Node/JDK/Maven/Maven Wrapper/ZXing の実 version と pin
- packed package name/version/integrity/exports
- fixture ID、symbol 数、Version/ECC/mask、scan order
- expected diagnostics と raw decoder metadata
- decoded text、raw bytes evidence、PNG SHA-256
- metadata assertion 結果
- payload assertion の `text-merge` / `metadata-only` 分類と理由
- 実行 command 一覧と failure 情報

Java helper の NDJSON、fixture manifest、PNG、各 command log、verification detail も
同じ artifact directory へ置きます。metadata の欠落や型変更時も可能な範囲の raw
result を残します。

## CI

GitHub Actions の独立 job
`Structured Append metadata from canonical tarball` が
`package-artifact` を依存先とし、同じ tarball を download して Ubuntu、Node 22、
Temurin `21.0.11+10` でこの lane を1回だけ実行します。engine matrix や macOS
Vision job では重複実行しません。

Maven cache は利用しますが、clean environment でも wrapper が Maven と ZXing を取得
して成功する構成です。failure 時は temporary report、fixture PNG、Node/Java/
Maven logs、compiled target を artifact として upload します。CI job に skip path は
ありません。

## Upgrade Procedure

ZXing / Maven / Wrapper / canonical JDK を更新するときは、同じ変更で次を行います。

1. official upstream と license を確認する。
2. `pom.xml`、wrapper properties、`.java-version`、CI pin、NOTICE、docs を同期する。
3. Maven archive の SHA-256 を official artifact から再計算して固定する。
4. clean cache で required command を実行する。
5. 全 fixture の metadata mapping、payload 分類、report version を review する。
6. `npm pack --dry-run` で JAR/cache/target/report が入らないことを確認する。

metadata key、Java 型、sequence semantics の変化は silent adaptation せず、raw report
を確認して意図的に更新します。

## Non-Claims

- ZXing Java 以外の scanner/decoder との完全互換
- branded Safari、Android/iOS camera、実端末 scanner
- Structured Append set の scanner 側自動 merge
- arbitrary binary payload の ZXing string round-trip
- damaged/rotated/blurred/printed symbols の readability
- ISO/IEC 18004全要件への独立認証
- network/CDN service や外部 decode API

この lane は generator の header/metadata interoperability を強化する追加証拠です。
golden matrix/codeword、Nayuki comparison、jsQR/Vision、unit tests の代替では
ありません。
