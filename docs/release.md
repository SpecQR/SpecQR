# Release Checklist

この文書は SpecQR の stable / prerelease 公開前後 checklist です。現在の main branch は `2.1.0` stable release package を準備できる状態にします。npm publish、GitHub Release 作成、GitHub Pages deploy は人間の最終判断後にだけ実行します。

v2 以降の release notes、CHANGELOG、commit messages、PR-style summaries は [Project Language Policy](./project-language.md) に従い、日本語メインで作成します。ただし package metadata、API names、install commands、README 冒頭の短い English summary は英語導線として維持します。

## Release Channels

- `latest`: 安定版利用者向け。stable release はこの tag で行います。
- `next`: RC / prerelease 利用者向け。stable 公開直後は `latest` と同じ version に揃えても構いません。次の prerelease を出すときに、あらためて `next` を RC に向けます。

通常 install:

```sh
npm install specqr
```

prerelease channel を明示して試す場合:

```sh
npm install specqr@next
```

通常利用者向けの install guide は `npm install specqr` を主導線にします。`next` が `latest` と同じ stable version を指している期間は、README / docs で「通常利用は `specqr`」と説明し、`next` を prerelease 専用の必須導線として扱わないようにします。

## Stable / Patch 公開条件

- `package.json` と `package-lock.json` の version が公開予定 version で一致している。
- `npm test` が green。
- `npm run verify:types` が green。
- `npm run examples:smoke` が green。
- `npm run pages:build` が green。
- `npm run verify:decode` が macOS release machine で green。
- `npm run verify:decode:jsqr` が green。
- `npm run verify:reference:nayuki` が green。
- `npm run verify:pack` が green。
- `npm run verify:structured-append:zxing-java` が、ZXing Java 環境なしなら明示 skip、環境ありなら metadata validation green。
- `npm ls --omit=dev` が runtime dependency なしを示す。
- `npm pack --dry-run --cache /private/tmp/specqr-npm-cache` が green。
- `npm publish --dry-run --tag latest --cache /private/tmp/specqr-npm-cache` が green。
- GitHub Actions `CI` の Node 18 / 20 / 22 / 24 engine matrix が green。
- representative Node 20 release gates が green。macOS Vision decode、Pages build、jsQR decode、Nayuki reference comparison、Structured Append ZXing Java optional lane、pack dry-run をここで確認する。
- README、[Conformance Matrix](./conformance.md)、[External Reference Comparison](./reference-comparison.md)、[Specification Scope](./spec-scope.md)、[Supported GS1 AIs](./gs1-supported-ai.md) が現在の実装範囲と矛盾していない。
- [Security Policy](../SECURITY.md) と [Contributing](../CONTRIBUTING.md) が release / validation 方針と矛盾していない。
- Micro QR、rMQR、Structured Append public parity helper / QR decoder / scanner integration、logo overlay、styled modules、GS1 full AI catalog、GS1 Digital Link resolver / compression / full canonicalizer が docs に非スコープとして明記されている。

release tag は、上記 verification が green の main commit にだけ付けます。stable preparation commit ではまだ tag を作らず、publish 直前の最終承認後に作るのが安全です。

## Main / Tag / npm / Pages Consistency Check

release hygiene patch では、コード変更がなくても公開物の整合を確認します。

```sh
git status --short
git rev-parse HEAD
git rev-parse origin/main
git rev-parse vX.Y.Z # tag 作成後
npm view specqr version dist-tags repository homepage bugs --json
```

確認すること:

- working tree が clean、または release hygiene commit に含める変更だけが残っている。
- `origin/main` が local main と同期している。
- 直近 stable tag が意図した stable commit を指している。
- npm `latest` が直近 stable を指している。
- npm `next` が docs の説明と矛盾していない。stable 公開後に `next` を stable へ揃えた場合は、その状態を README / release notes で「通常利用は `specqr`」と説明する。
- npm package metadata の repository / homepage / bugs が `https://github.com/SpecQR/SpecQR` に揃っている。
- GitHub Release の tag / title / notes が npm package version と矛盾していない。
- GitHub Pages playground が `https://specqr.github.io/SpecQR/playground/` で表示され、現在の source / docs と同期した artifact になっている。
- `README.md` / `CHANGELOG.md` / docs に古い RC 中心の案内が残っていない。
- npm package contents に `tmp`、`dist`、`node_modules`、tarball、local cache、logs、screenshots が含まれていない。

## Pre-Publish Commands

```sh
npm test
npm run verify:types
npm run examples:smoke
npm run pages:build
npm run verify:decode
npm run verify:decode:jsqr
npm run verify:reference:nayuki
npm run verify:pack
npm run verify:structured-append:zxing-java
npm ls --omit=dev
npm pack --dry-run --cache /private/tmp/specqr-npm-cache
npm publish --dry-run --tag latest --cache /private/tmp/specqr-npm-cache
```

## Local Pack Smoke

local pack install smoke は npm 公開前の配布物確認として実行します。

```sh
npm run verify:pack
```

この script は `npm pack` した tarball を一時 install し、root export と TypeScript declarations が source とずれていないことを確認します。GS1 raw parser、GS1 Digital Link、FNC1 second、Structured Append API、`specqr/node`、`specqr/browser`、非公開 validator が public export されないことも確認します。

TypeScript declarations は compiler-based consumer check でも確認します。

```sh
npm run verify:types
```

## Published Package Smoke

stable を publish した後は、npm registry から install できることを確認します。

```sh
node tools/verify-published-package.js specqr@2.1.0 specqr@latest
```

`next` tag の状態も同時に確認したい場合:

```sh
node tools/verify-published-package.js specqr@2.1.0 specqr@latest specqr@next
```

`npm run verify:published` は既定で `specqr` と `specqr@next` を確認します。npm registry に依存するため通常 push CI には含めず、`Published Package Smoke` workflow で手動実行できるようにしています。未公開の 2.1.0 を確認する段階では `npm run verify:pack` と `npm publish --dry-run` を使い、registry smoke と local pack smoke を混同しないでください。

## Node Engine Matrix

`package.json` は Node.js `>=18` を support claim として宣言します。stable release 前の `CI` workflow は Node 18 / 20 / 22 / 24 の matrix で次の軽量 gate を実行します。

- `npm ci`
- `npm test`
- `npm run verify:types`
- `npm run examples:smoke`
- `npm run verify:pack`
- `npm ls --omit=dev`

macOS Vision、ImageMagick、Swift、外部参照比較、Pages artifact、pack dry-run などの重い / 環境依存 gate は代表 Node 20 の `Release gates on Node 20` job に集約します。Node 20 は v1 / v2 の既存 release lane と同じで、runtime support matrix とは別に release artifact の比較軸を安定させるために使います。Node 18 matrix が失敗する場合は原因を調査し、修正困難な場合だけ `engines.node` を `>=20` に上げる案を人間判断として扱います。

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

## GitHub Stable Release

stable version を npm `latest` で publish し、published package smoke が成功した後に GitHub Release を作成します。

- Tag: `vX.Y.Z`
- Title: `SpecQR X.Y.Z`
- npm install:
  ```sh
  npm install specqr
  ```
- 主な対応範囲: QR Code Model 2 Version 1-40、L/M/Q/H、Numeric / Alphanumeric / Byte / Kanji、ECI、GS1/FNC1 first position、GS1 raw element string parser、GS1 validation / supported AI introspection API、GS1 Digital Link create/parse helper、FNC1 second position、Structured Append low-level header / high-level automatic splitting / manual segment splitting / decoded parts merge helper、SVG/PNG/canvas/Node/browser helpers。
- 検証: Node 18 / 20 / 22 / 24 matrix、golden conformance、jsQR decoder validation、macOS Vision validation、Nayuki reference comparison、local pack smoke、npm publish dry-run。
- 非対応: Micro QR、rMQR、Structured Append public parity helper / QR decoder / scanner integration、logo overlay、styled modules、GS1 full AI catalog、`normalizeGs1DigitalLink()`、GS1 Digital Link resolver / compression / full canonicalizer。
- Structured Append の読み取り後 merge helper は metadata-returning decoder が `{ index, total, parity, data }` を返せる場合だけ扱います。decoder 候補と optional validation 方針は `docs/structured-append-decoder-validation-v2.md` に整理済み。
- Links: README、playground、conformance matrix、reference comparison、test plan。

## npm Publish

Stable dry-run:

```sh
npm publish --dry-run --tag latest --cache /private/tmp/specqr-npm-cache
```

Stable 実 publish:

```sh
npm publish --tag latest
```

公開後確認:

```sh
npm view specqr version
npm view specqr dist-tags versions --json
node tools/verify-published-package.js specqr@X.Y.Z specqr@latest
```

stable が publish され、install smoke が成功した後、対応する RC を deprecate するか判断します。deprecate する場合:

```sh
npm deprecate specqr@X.Y.Z-rc.N "SpecQR X.Y.Z is available. Please use specqr@latest."
```

`next` tag は stable publish 後に `latest` と同じ stable version へ揃えても構いません。次の RC を出すときに `next` を prerelease version へ向け直します。docs では、`next` が stable を指している期間でも通常利用は `npm install specqr` を主導線にします。

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

SpecQR の runtime dependency は 0 を維持します。`jsqr`、`nayuki-qr-code-generator`、TypeScript は devDependency であり、library runtime には含めません。
