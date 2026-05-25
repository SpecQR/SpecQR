# Contributing

SpecQR への contribution は、通常 QR Code Model 2 の仕様端でも壊れにくい生成器を保つことを最優先にします。新機能よりも、検証できる小さな変更、docs と tests の整合、dependency-free runtime の維持を重視します。

## 開発方針

- public API を増やす前に、docs で API shape、error behavior、non-scope を固定します。
- QR core / encoding / renderer の変更は、unit tests、golden fixtures、decoder validation、外部参照比較のどれで守るかを明確にします。
- runtime dependency は追加しません。検証用 dependency は devDependency に限定します。
- 仕様本文や大きな表は repository に無断コピーしません。必要な場合は出典、license / usage terms、NOTICE の要否を確認します。

## 日本語メイン運用

README、docs、CHANGELOG、release notes、commit message、設計メモは日本語メインで構いません。npm / GitHub での発見性のため、次は英語のまま維持します。

- package.json `description` / `keywords`
- API 名、型名、error class 名
- script 名、install command
- README 冒頭の短い English summary

詳しくは [Project Language Policy](docs/project-language.md) を参照してください。

## Tests / Verification

通常の変更では、少なくとも次を実行します。

```sh
npm test
npm run verify:types
npm run examples:smoke
npm run verify:pack
```

release hygiene や QR core に関わる変更では、次も確認します。

```sh
npm run pages:build
npm run verify:decode
npm run verify:decode:jsqr
npm run verify:reference:nayuki
npm run verify:structured-append:zxing-java
npm pack --dry-run --cache /private/tmp/specqr-npm-cache
npm publish --dry-run --tag latest --cache /private/tmp/specqr-npm-cache
npm ls --omit=dev
git diff --check
```

`npm run verify:structured-append:zxing-java` は Java / ZXing classpath がない環境では明示 skip します。skip は失敗ではありませんが、release 前に metadata-returning decoder 環境で確認できるとより強い検証になります。

## Golden Fixtures

固定 Version / ECC / mask の matrix、codewords、diagnostics、format bits、version bits、remainder bits は golden fixtures で固定します。

QR 構築ロジックの意図した変更だけを受け入れる場合に限り、次で fixtures を更新します。

```sh
npm run fixtures:golden
npm test
```

golden update を含む変更では、何が変わったのかを commit / PR summary に書いてください。単に snapshot を更新して test を通すだけでは不十分です。

## GS1 / Structured Append Docs

GS1 AI の対応範囲は [Supported GS1 AIs](docs/gs1-supported-ai.md) に集約します。AI を追加する場合は、length、character set、separator behavior、check digit validation、Digital Link role、positive / negative tests を揃えてください。

Structured Append は scanner が metadata を露出するかどうかで実利用 workflow が変わります。API 変更時は [Structured Append Scanning Workflow](docs/structured-append-scanning-v2.md) と [Structured Append Decoder Metadata Validation](docs/structured-append-decoder-validation-v2.md) も確認してください。

## Release Checklist

release 前後の main / tag / npm / GitHub Release / Pages の整合確認は [Release Checklist](docs/release.md) に集約します。公開後に npm dist-tag や docs が現状とずれた場合は、patch release hygiene として小さく直します。
