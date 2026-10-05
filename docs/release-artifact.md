# Release Artifact Verification

現在の checkout は公開済み `3.0.0-rc.2` 後の未公開 source corrections を含みます。
Package version が同じでも、current-source test artifact と immutable rc.2 は別物です。
CI は次の二つの必須 lane を分離し、tarball、directory、upload 名を混ぜません。

- `package-artifact`: exact tested commit の非公開 source-test snapshot。
- `frozen-rc2-reproduction`: immutable rc.2 commit の historical package を再現する lane。

Source-test snapshot は publish 用ではありません。Manifest の `purpose.publishable` は
`false` で、CI から npm publish へ渡しません。この印は npm 自体の access control では
ないため、手動でも publish しないでください。将来の runtime release には新しい
prerelease version、release checks、明示承認が必要です。Source CI は registry、tag、
公開済み package、Conformance Lab の stable pin / RC observation policy を変更しません。

## Artifact を作る

Source-test lane は clean な committed checkout を要求します。出力先は repository 外の
空 directory です。

```sh
SPECQR_EXPECTED_SOURCE_COMMIT="$(git rev-parse HEAD)" \
  node .github/scripts/prepare-source-test-artifact.js \
  /private/tmp/specqr-source-test-artifact
```

同じ checkout から二回 `npm pack --json` を実行し、path、size、各 file の SHA-256、
canonical order の content manifest と raw tarball SHA-256 の一致を必須にします。
その後 `gzip -n -9` と OS byte `255` で正規化し、二回の normalization の byte 一致と
展開後 content の不変性を確認します。保管する tarball は一つです。

生成物:

```text
specqr-source-test-<40-character-commit>.tgz
specqr-release-artifact.json
```

Manifest filename は既存 consumer との互換性のため維持します。Package version と
exports は変更せず、filename と purpose / commit で source-test artifact を区別します。
Source commit は pack の前後と正規化後に確認します。Working tree が dirty、commit が
不一致、repeat pack が不一致なら生成は失敗します。

## Manifest

両 lane の manifest は package metadata、exports、runtime dependency count、tarball
size / SHA-256、全 file の path / size / SHA-256、content-manifest hash、package policy、
repeated pack、Git / Node / npm / platform provenance を記録します。Manifest 自体は
npm tarball に含めません。

Source-test manifest はさらに次を要求します。

- `purpose.kind: unreleased-source-test` と `purpose.publishable: false`
- 正確な `provenance.head`、Git tree、clean working tree
- exact commit を含む tarball filename
- 二回 pack の content / tarball hash 一致
- canonical normalization の algorithm、元の hash、正規化後 hash、再現性

```sh
export SPECQR_RELEASE_ARTIFACT_DIR=/private/tmp/specqr-source-test-artifact
export SPECQR_EXPECTED_VERSION=3.0.0-rc.2
export SPECQR_ARTIFACT_KIND=unreleased-source-test
export SPECQR_EXPECTED_SOURCE_COMMIT="$(git rev-parse HEAD)"
npm run verify:release:artifact
```

Commit、purpose、filename、manifest、tarball の mismatch は failure です。Frozen rc.2 を
source-test artifact として渡すことはできません。

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

上記の四つの環境変数を設定して、同じ producer artifact を使用します。

```sh
npm run verify:pack
npm run verify:browser:e2e
npm run verify:structured-append:zxing-java
```

`verify:pack` は隔離 install から exact metadata / exports、root / node / browser
runtime、v3 standard/full diagnostics、NodeNext / Bundler types、packaged examples を
確認します。Browser と ZXing Java も installed package の public API を使用します。

Source-test lane では artifact directory、manifest、tarball の欠落や mismatch があれば
failure にし、repack / source import へ fallback しません。Lane 指定をしない従来の
local standalone command だけは一時 tarball の self-pack を許可します。

## Frozen rc.2 reproduction

`frozen-rc2-reproduction` は source checkout と別の `frozen-rc2/` へ
`15ad15e5c770ea0e39072f8f88b2733018f02ffd` を checkout します。この immutable
checkout 内の producer と canonicalizer を使用し、次の五つの original pin を変更せず
検証します。

- Tarball size: `312544`
- Tarball SHA-256: `c96c324dcd99d72c385d3890156a6ae973ad8db57b840fd5a47f987ddcbb6298`
- File count: `121`
- Unpacked size: `1294971`
- Content SHA-256: `f507de7da842b3bc5fce88eaa6a4d04388ce1d55541c58cbebf36d4b583ae306`

出力 directory / upload 名は `specqr-frozen-rc2-artifact` です。Current-source consumer
はこれを download しません。Manual-only / optional gate にはせず、代表 macOS gate の
必須 dependency にも含めます。

## CI data flow

1. `package-artifact` が macOS / Node 22 で `${{ github.sha }}` の source-test artifact を作る。
2. Node 18 / 20 / 22 / 24 matrix が同じ source-test artifact を download し、unit、types、
   examples、installed package、runtime dependency を確認する。
3. `artifact-verification` が同じ artifact の contents、runtime、types、examples を確認する。
4. Ubuntu / Node 22 の browser gate が Chromium / Firefox / WebKit を実行し、別の
   ZXing Java gate が固定 Temurin `21.0.11+10` で metadata を検証する。
5. macOS / Node 20 の代表 gate が Vision、Pages build、jsQR、fuzz / Nayuki、resource /
   memory、writing / links、workflow verifier、pack dry-run を実行する。
6. 別の必須 frozen lane が immutable rc.2 を再現し、その tarball だけに publish dry-run
   を実行する。

全 current-source consumer に artifact directory、kind、expected version、exact commit を
設定します。Workflow verifier と unit tests は pin drift、artifact mixing、consumer
fallback、provenance の欠落、required gate の削除、actual publish を拒否します。

```sh
npm run verify:release:workflow
node --test tests/source-artifact-workflow.test.js
```

## npm publish dry-run

CI の `npm publish --dry-run --tag next` は frozen rc.2 reproduction のみで実行します。
Current-source test snapshot は渡しません。Dry-run は registry を変更せず、公開可能性や
registry visibility を保証しません。

## 公開後の registry 検証

Published-smoke workflow の defaults は引き続き `specqr@3.0.0-rc.2 specqr@next` と
expected version `3.0.0-rc.2` です。この source-only integration では変更しません。

```sh
node tools/verify-published-package.js \
  --expected-version 3.0.0-rc.2 \
  specqr@3.0.0-rc.2 specqr@next
```

これは registry の exact-version resolution を検証する別の manual command です。
Current-source test artifact の成功を registry publish / dist-tag の evidence として
扱いません。

## Non-claims

- Tarball hash と manifest は署名や provenance attestation ではありません。
- Artifact upload は npm publish ではありません。
- Historical rc.2 と RC 1 の runtime equality は current-source corrections に適用しません。
- Conformance Lab の public stable report と RC observation policy は変更しません。
- Package gates は全 scanner、mobile device、CDN/network behavior を保証しません。
