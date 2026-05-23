# Release Checklist

この文書は SpecQR の公開前後 checklist と RC 運用方針です。現在の main branch は `2.0.0-rc.1` release candidate scope を含みます。実際の npm publish、GitHub Release 作成、GitHub Pages deploy は、手動確認後に実行します。

v2 以降の release notes、CHANGELOG、commit messages、PR-style summaries は [Project Language Policy](./project-language.md) に従い、日本語メインで作成します。ただし package metadata、API names、install commands、README 冒頭の短い English summary は英語導線として維持します。

## Release Channels

- `latest`: 安定版利用者向け。正式版を公開したら該当 stable version を指します。
- `next`: RC / prerelease 利用者向け。次の prerelease を検証するときに使います。正式版公開後も、次の RC を出すまでは `next` を直ちに動かす必要はありません。

通常 install:

```sh
npm install specqr
```

v2.0.0-rc.1 / prerelease channel を明示して試す場合:

```sh
npm install specqr@next
```

`specqr` は stable channel、`specqr@next` は prerelease channel として扱います。v2.0.0-rc.1 の npm publish は `next` tag で行います。

## v2.0.0-rc.1 公開条件

- `npm test` が green。
- `npm run examples:smoke` が green。
- `npm run pages:build` が green。
- `npm run verify:decode` が macOS release machine で green。
- `npm run verify:decode:jsqr` が green。
- `npm run verify:reference:nayuki` が green。
- `npm run verify:pack` が green。
- `npm run verify:structured-append:zxing-java` が、ZXing Java 環境なしなら明示 skip、環境ありなら metadata validation green。
- `npm pack --dry-run` が clean な npm cache / CI 上で green。
- 公開前は `npm run verify:published` が現行公開版に対して green。公開後は `specqr@2.0.0` に対して green。
- GitHub Actions `CI` が green。
- README、[Conformance Matrix](./conformance.md)、[External Reference Comparison](./reference-comparison.md)、[Specification Scope](./spec-scope.md) が現在の実装範囲と矛盾していない。
- Micro QR、rMQR、Structured Append public parity helper / QR decoder / scanner integration、logo overlay、styled modules、GS1 full AI catalog、GS1 Digital Link resolver / compression / full canonicalizer が docs に非スコープとして明記されている。
- `package.json` と `package-lock.json` の version が `2.0.0-rc.1` で一致している。
- `npm publish --dry-run --tag next --cache /private/tmp/specqr-npm-cache` が green。
- tag `v2.0.0-rc.1` は、上記 verification が green の main commit にだけ付ける。

## Pre-Publish Commands

```sh
npm test
npm run examples:smoke
npm run pages:build
npm run verify:decode
npm run verify:decode:jsqr
npm run verify:reference:nayuki
npm run verify:pack
npm run verify:structured-append:zxing-java
npm pack --dry-run
npm publish --dry-run --tag next
```

ローカルの npm cache 権限に問題がある場合は、release verification として一時 cache を指定して確認します。

```sh
npm pack --dry-run --cache /private/tmp/specqr-npm-cache
npm publish --dry-run --tag next --cache /private/tmp/specqr-npm-cache
```

## Published Package Smoke

local pack install smoke は npm 公開前の配布物確認として実行します。

```sh
npm run verify:pack
```

この script は `npm pack` した tarball を一時 install し、root export と TypeScript declarations が source とずれていないことを確認します。特に GS1 raw parser の `parseGs1ElementString()`、`QRCode.parseGs1ElementString()`、非公開のままにする `validateGs1ElementString()` を検査します。

公開済み package が npm install 後に利用できることを確認します。

```sh
npm run verify:published
```

この script は一時ディレクトリを作り、`npm install specqr` と `npm install specqr@next` をそれぞれ実行します。その後、root export、`specqr/node`、`specqr/browser`、GS1 helper を import / 実行します。

特定の version や tag を確認したい場合:

```sh
node tools/verify-published-package.js specqr@2.0.0-rc.1 specqr@next
```

GitHub Actions の `Published Package Smoke` workflow は手動実行用です。通常の push CI には含めず、npm registry の一時的な障害で開発 CI が落ちないようにしています。

## GitHub Pages Playground

Playground は source modules を同じ Pages artifact に含める設計です。npm CDN や bundler は使いません。これにより、Pages の playground は repository の該当 commit の `src/` と同期します。

Build:

```sh
npm run pages:build
```

出力先:

```text
dist/pages/
```

Manual deploy:

1. GitHub repository settings で Pages source を `GitHub Actions` にする。
2. Actions から `Deploy Playground` workflow を手動実行する。
3. 公開 URL `https://specqr.github.io/SpecQR/playground/` を確認する。

この workflow は `workflow_dispatch` のみで起動します。push だけでは deploy しません。

## GitHub Release

v2.0.0-rc.1 では、npm publish と install smoke が終わるまで GitHub Release は作成しません。作成する場合の release draft に含める内容:

- Tag: `v2.0.0-rc.1`
- Title: `SpecQR 2.0.0-rc.1`
- npm install:
  ```sh
  npm install specqr@next
  ```
- 主な対応範囲: QR Code Model 2 Version 1-40、L/M/Q/H、Numeric / Alphanumeric / Byte / Kanji、ECI、GS1/FNC1 first position、GS1 raw element string parser、GS1 Digital Link create/parse helper、FNC1 second position、Structured Append low-level header / high-level automatic splitting / manual segment splitting / decoded parts merge helper、SVG/PNG/canvas/Node/browser helpers。
- 検証: golden conformance、jsQR decoder validation、macOS Vision validation、Nayuki reference comparison。
- 非対応: Micro QR、rMQR、Structured Append public parity helper / QR decoder / scanner integration、logo overlay、styled modules、GS1 full AI catalog、GS1 Digital Link resolver / compression / full canonicalizer。
- Structured Append の読み取り後 merge helper は metadata-returning decoder が `{ index, total, parity, data }` を返せる場合だけ扱います。decoder 候補と optional validation 方針は `docs/structured-append-decoder-validation-v2.md` に整理済み。
- Links: README、playground、conformance matrix、reference comparison、test plan。

## npm Publish

RC dry-run:

```sh
npm publish --dry-run --tag next
```

RC 実 publish:

```sh
npm publish --tag next
```

公開後確認:

```sh
npm view specqr version
npm view specqr dist-tags versions --json
node tools/verify-published-package.js specqr@2.0.0-rc.1 specqr@next
```

v2.0.0 正式版 publish 時の dry-run / publish は `latest` tag で行います。古い prerelease を deprecate する場合:

```sh
npm deprecate specqr@2.0.0-rc.1 "SpecQR 2.0.0 is available. Please use specqr@latest."
```

deprecate は正式版 publish と install smoke が成功してから行います。

## Package Contents Policy

npm package に含めるもの:

- `src`: runtime source と type declarations。
- `docs`: npm から見ても対応範囲・検証範囲を確認できるようにする。
- `examples`: install 後に実用例を参照できるようにする。
- `playground`: static playground source を配布物にも含める。
- `fixtures`: conformance / decode coverage の透明性のために含める。
- `tools`: package artifact からも検証方法を追えるように含める。ただし一部 tool は devDependency や platform tool を必要とします。
- `README.md`, `CHANGELOG.md`, `LICENSE`

npm package に含めないもの:

- `node_modules`
- `tmp`
- `dist`
- `.github`
- local cache / logs / screenshots / tarballs

SpecQR の runtime dependency は 0 を維持します。`jsqr` と `nayuki-qr-code-generator` は devDependency であり、library runtime には含めません。
