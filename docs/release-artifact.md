# Release Artifact Verification

SpecQR 3.0.0-rc.1 では、公開予定 tarball を一度だけ作り、Node、TypeScript、
browser、ZXing Java の package-level gate へ同じ artifact を渡します。

この仕組みは source-level unit test を置き換えるものではありません。公開 package の
contents、metadata、exports、types、runtime contract が、各 lane で別々に pack した
結果へ drift しないようにする release gate です。

## Artifact を作る

出力先は repository 外の空 directory でなければなりません。

```sh
npm run release:artifact -- \
  --output-dir /private/tmp/specqr-3.0.0-rc.1-artifact
```

生成物:

```text
specqr-3.0.0-rc.1.tgz
specqr-release-artifact.json
```

Script は同じ checkout から二回 `npm pack --json` を実行します。公開候補として
残すのは一つ目の tarball だけです。二回目は一時 directory へ作り、gzip/tar
metadata ではなく、展開後の各 file について次を比較してから削除します。

- package-relative path
- byte size
- SHA-256 content hash

全 file list を canonical order へ並べた content manifest 自体にも SHA-256 を付けます。
Tarball 本体の SHA-256 の一致は記録しますが、metadata 差を理由に必須条件とはしません。
展開後 content manifest の一致は必須です。

## Manifest

`specqr-release-artifact.json` は次を記録します。

- package name / version / repository / homepage / bugs
- Node engine、root / node / browser exports
- runtime dependency count
- tarball filename、size、SHA-256
- file count、unpacked size、content-manifest SHA-256
- 全 file の path、size、content SHA-256
- repeated pack の expanded-content 一致
- package allow/deny policy 結果
- branch、HEAD、origin/main、dirty 状態、Node/npm/platform provenance

Manifest 自体は npm tarball に含めません。

既存 artifact を再検証する command:

```sh
SPECQR_RELEASE_ARTIFACT_DIR=/private/tmp/specqr-3.0.0-rc.1-artifact \
  SPECQR_EXPECTED_VERSION=3.0.0-rc.1 \
  npm run verify:release:artifact
```

## Package contents policy

含める top-level directory:

- `src`
- `docs`
- `examples`
- `fixtures`
- `playground`
- `tools`

含める top-level file:

- `README.md`
- `CHANGELOG.md`
- `SECURITY.md`
- `CONTRIBUTING.md`
- `LICENSE`
- `package.json`

含めないもの:

- `e2e/`、`tests/`、`.github/`
- `node_modules/`、`dist/`、`tmp/`、cache
- Playwright/JDK/Maven cache、compiled classes
- generated report、PNG、JAR、log、tarball
- screenshots、test-results、temporary install

`package.json` の `files` に既存 docs/tools が含まれていることを理由に、
個別文書を恣意的に除外しません。Allowlist 内の全 file を manifest へ記録し、
required path と deny policy を別々に検証します。

## 同じ artifact を使う local gate

Artifact directory を指定すると、各 consumer は再 pack しません。

```sh
export SPECQR_RELEASE_ARTIFACT_DIR=/private/tmp/specqr-3.0.0-rc.1-artifact
export SPECQR_EXPECTED_VERSION=3.0.0-rc.1

npm run verify:release:artifact
npm run verify:pack
npm run verify:browser:e2e
npm run verify:structured-append:zxing-java
```

`verify:pack` は tarball から隔離 install し、次を確認します。

- exact package version / metadata / export manifest
- root / `specqr/node` / `specqr/browser` runtime
- v3 standard/full Structured Append diagnostics
- NodeNext（DOM なし）/ Bundler（DOM あり）types
- packaged examples の代表実行

Browser lane は installed package の root/browser entries だけを native ESM で配信します。
ZXing lane の fixture 生成も installed package の public API だけを使います。Artifact
指定が壊れている場合は self-pack へ fallback せず failure になります。

Artifact 指定を省略した既存 local command は、従来どおり一時 tarball を self-pack して
単独実行できます。

## CI data flow

GitHub Actions `CI` は次の構造です。

1. `package-artifact` が Node 22 で tarball と manifest を生成・upload する。
2. Node 18 / 20 / 22 / 24 engine matrix が同じ artifact を download して install する。
3. `artifact-verification` が contents、runtime、types、examples を確認する。
4. Browser E2E と ZXing Java が同じ artifact を download する。
5. macOS release gates も manifest を確認し、`verify:writing` と source-level gates、
   同じ canonical tarball を指定した `npm publish --dry-run --tag next` を実行する。

各 consumer job には `SPECQR_RELEASE_ARTIFACT_DIR` を設定します。Download 漏れや
manifest/tarball mismatch は failure であり、再 pack や source direct import へ
fallback しません。

Workflow の job dependency、artifact name/path、Node matrix、post-publish input は
次で静的確認できます。

```sh
npm run verify:release:workflow
```

## npm publish dry-run

RC publish 前:

```sh
npm publish \
  /private/tmp/specqr-3.0.0-rc.1-artifact/specqr-3.0.0-rc.1.tgz \
  --dry-run --tag next \
  --cache /private/tmp/specqr-npm-cache
```

Checkout directory を再 pack せず、manifest で検証済みの canonical tarball を package
spec として渡します。実 publish はこの release integration では行いません。

## 公開後の registry 検証

3.0.0-rc.1 を人間が `next` へ公開した後:

```sh
node tools/verify-published-package.js \
  --expected-version 3.0.0-rc.1 \
  specqr@3.0.0-rc.1 specqr@next
```

Verifier は両 spec が exact version へ解決すること、metadata、exports、Node/browser
helpers、v3 contract、NodeNext/Bundler types を確認します。

公開前に package-level 部分だけを同等検証する場合:

```sh
node tools/verify-published-package.js \
  --expected-version 3.0.0-rc.1 \
  /private/tmp/specqr-3.0.0-rc.1-artifact/specqr-3.0.0-rc.1.tgz
```

これは registry や dist-tag を確認したとは主張しません。Registry resolution は
publish 後の manual workflow または上記 exact command でだけ確認します。

## Non-claims

- Tarball SHA-256 は source tree の署名や provenance attestation ではありません。
- GitHub artifact upload は npm registry publish を行いません。
- `npm publish --dry-run` は実際の registry visibility や dist-tag を保証しません。
- Conformance Lab は公開済み 2.4.0 を対象としており、未公開 RC tarball の証拠では
  ありません。
- Package artifact gate は scanner 全般、mobile device、CDN/network behavior を
  保証しません。
