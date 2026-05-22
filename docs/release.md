# Release Checklist

この文書は SpecQR `1.0.0` 正式版の公開前後 checklist と、その後の RC 運用方針です。実際の npm publish、GitHub Release 作成、GitHub Pages deploy は、手動確認後に実行します。

## Release Channels

- `latest`: 安定版利用者向け。`1.0.0` 正式版を公開したら `latest` は `1.0.0` を指します。
- `next`: RC / prerelease 利用者向け。次の prerelease を検証するときに使います。正式版公開後も、次の RC を出すまでは `next` を直ちに動かす必要はありません。

通常 install:

```sh
npm install specqr
```

RC / prerelease channel を明示して試す場合:

```sh
npm install specqr@next
```

正式版では `specqr` が stable channel、`specqr@next` が prerelease channel という扱いに揃えます。

## 1.0.0 公開条件

- `npm test` が green。
- `npm run examples:smoke` が green。
- `npm run pages:build` が green。
- `npm run verify:decode:jsqr` が green。
- `npm run verify:reference:nayuki` が green。
- macOS release machine で `npm run verify:decode` が green。
- `npm pack --dry-run` が clean な npm cache / CI 上で green。
- 公開前は `npm run verify:published` が現行公開版に対して green。公開後は `specqr@1.0.0` に対して green。
- GitHub Actions `CI` が green。
- README、[Conformance Matrix](./conformance.md)、[External Reference Comparison](./reference-comparison.md)、[Specification Scope](./spec-scope.md) が現在の実装範囲と矛盾していない。
- v1 で未対応の Micro QR、rMQR、Structured Append、FNC1 second position、logo overlay、styled modules、GS1 full AI catalog、GS1 Digital Link が docs に明記されている。

## Pre-Publish Commands

```sh
npm test
npm run examples:smoke
npm run pages:build
npm run verify:decode:jsqr
npm run verify:reference:nayuki
npm run verify:decode
npm pack --dry-run
npm publish --dry-run --tag latest
```

ローカルの npm cache 権限に問題がある場合は、release verification として一時 cache を指定して確認します。

```sh
npm pack --dry-run --cache /private/tmp/specqr-npm-cache
npm publish --dry-run --tag latest --cache /private/tmp/specqr-npm-cache
```

## Published Package Smoke

公開済み package が npm install 後に利用できることを確認します。

```sh
npm run verify:published
```

この script は一時ディレクトリを作り、`npm install specqr` と `npm install specqr@next` をそれぞれ実行します。その後、root export、`specqr/node`、`specqr/browser`、GS1 helper を import / 実行します。

特定の version や tag を確認したい場合:

```sh
node tools/verify-published-package.js specqr@1.0.0 specqr@next
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

Release draft に含める内容:

- Tag: `v1.0.0`
- Title: `SpecQR 1.0.0`
- npm install:
  ```sh
  npm install specqr
  ```
- 主な対応範囲: QR Code Model 2 Version 1-40、L/M/Q/H、Numeric / Alphanumeric / Byte / Kanji、ECI、GS1/FNC1 first position、SVG/PNG/canvas/Node/browser helpers。
- 検証: golden conformance、jsQR decoder validation、macOS Vision validation、Nayuki reference comparison。
- 非対応: Micro QR、rMQR、Structured Append、FNC1 second position、logo overlay、styled modules、GS1 full AI catalog、GS1 Digital Link。
- Links: README、playground、conformance matrix、reference comparison、test plan。

## npm Publish

Dry-run:

```sh
npm publish --dry-run --tag latest
```

実 publish:

```sh
npm publish --tag latest
```

公開後確認:

```sh
npm view specqr version
npm view specqr dist-tags versions --json
npm run verify:published
```

RC を deprecate する場合:

```sh
npm deprecate specqr@1.0.0-rc.2 "SpecQR 1.0.0 is available. Please use specqr@latest."
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
