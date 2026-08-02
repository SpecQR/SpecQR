# Release Checklist

この文書は SpecQR の stable / prerelease 公開前後 checklist です。現在の checkout
は、runtime を変更しない `3.0.0-rc.2` release-correction candidate です。公開済み
stable は 2.4.0、npm `next` と GitHub prerelease は 3.0.0-rc.1 です。RC 2 の npm
publish、tag、GitHub Release、GitHub Pages deploy は未実施です。

v2 以降の release notes、CHANGELOG、commit messages、PR-style summaries は
[Project Language and Writing Style](./project-language.md) に従い、日本語を
中心に作成します。ただし package metadata、API names、install commands、
README 冒頭の短い English summary は英語導線として維持します。

## Release Channels

- `latest`: 安定版利用者向け。現在の公開済み stable 2.4.0 を維持します。
- `next`: RC / prerelease 利用者向け。現在は公開済み 3.0.0-rc.1 を指します。
  RC 2 を公開する場合も canonical tarball に `npm publish --tag next` を使い、
  公開検証が終わるまで手動で dist-tag を上書きしません。

通常 install:

```sh
npm install specqr
```

prerelease channel を明示して試す場合:

```sh
npm install specqr@next
```

通常利用者向けの install guide は `npm install specqr` を主導線にします。
`specqr@next` の RC 導線は publish 後に exact version を検証してから案内します。

## 3.0.0-rc.2 Release Correction Freeze

`3.0.0-rc.2` は RC 1 の runtime、public API、TypeScript contract、package
exports、resource budget、runtime dependency、QR / renderer output bytes を
byte-for-byte で維持します。RC line の唯一の API shape breaking change は、manual
segments 版 Structured Append の diagnostics contract です。

2.4.0 との observable correctness change として、`ok: false` かつ
`remainingBits < 0` の Planning overflow result では `CAPACITY_NEAR_LIMIT` を
返しません。成功した near-limit result では warning を維持します。RC 2 はこの
AUD-05 behavior を変更せず、RC 1 の release documentation だけを訂正します。

次は RC 2 に含めません。

- Top-level unknown option rejection
- GS1 metadata readonly / runtime freeze
- 新しい Structured Append inspection API
- その他の runtime / type / export 変更

freeze 後に `src/**/*.js`、`src/**/*.d.ts`、exports、error / warning message、
diagnostics JSON shape、resource budget の変更が必要になった場合は、RC 2 の
release correction として扱いません。変更内容を再評価し、新しい prerelease version
を使います。

この freeze 後に残る作業は、commit / push、hosted CI、Lab expected-delta policy の
審査、明示承認後の canonical tarball `next` publish、post-publish verification です。

## Release Gate

- `package.json` と `package-lock.json` の version が公開予定 version で一致している。
- `npm run release:artifact` が repository 外へ canonical tarball と manifest を生成し、
  repeated pack の expanded content が一致する。
- `npm run verify:release:artifact` が tarball SHA-256、全 file manifest、
  allow/deny policy、version/repository/exports/runtime dependency 0 を確認する。
- `npm test` が green。
- `npm run verify:types` が既存 compatibility、DOM なし NodeNext、DOM あり Bundler consumer の全 fixture で green。
- `npm run examples:smoke` が green。
- `npm run pages:build` が green。
- `npm run verify:decode` が macOS release machine で green。
- `npm run verify:decode:jsqr` が green。
- `npm run verify:conformance:fuzz` が既定 seed の bounded suite で green。
- `npm run verify:resource-safety` と
  `npm run verify:structured-append:memory` が 32 MiB low-heap case を含め green。
- `npm run verify:reference:nayuki` が green。
- `npm run verify:writing` が公開 prose、workflow display text、package discovery
  metadata の明確な表記規則について green。
- `npm run verify:pack` が canonical tarball-installed root/node/browser runtime、
  exact export manifest、TypeScript resolution、v3 contract、packaged examples で green。
- `npm run verify:browser:e2e` が同じ canonical tarball / built Pages について
  Chromium、Firefox、WebKit の全 project で green。
- `npm run verify:structured-append:zxing-java` が同じ canonical tarball、
  JDK 21、固定版 ZXing Java 3.5.4 で 10 fixtures / 44 symbols を実 decode し、
  metadata/payload 分類 report を出して green。JDK/dependency/metadata が利用不能な
  場合は skip せず failure。
- `npm ls --omit=dev` が runtime dependency なしを示す。
- `npm pack --dry-run --cache /private/tmp/specqr-npm-cache` が green。
- RC では canonical tarball を package spec にした
  `npm publish <tarball> --dry-run --tag next` が green。Stable では `latest` へ
  切り替える。
- GitHub Actions `CI` の Node 18 / 20 / 22 / 24 engine matrix が green。
- GitHub Actions `Canonical tarball の browser E2E` が green で、失敗時 artifact upload の構成が維持されている。
- GitHub Actions `Canonical tarball の Structured Append metadata` が Ubuntu / Node 22 / Temurin `21.0.11+10` で green で、failure artifact upload の構成が維持されている。
- representative Node 20 release gates が green。macOS Vision decode、Pages build、jsQR decode、deterministic conformance / fuzzing（内部の全 1,280 Nayuki comparison を含む）、resource safety、Structured Append memory、writing / link checks、pack dry-run をここで確認し、ZXing Java は専用 job で一度だけ確認する。
- README、[Conformance Matrix](./conformance.md)、[External Reference Comparison](./reference-comparison.md)、[Specification Scope](./spec-scope.md)、[Supported GS1 AIs](./gs1-supported-ai.md)、[Public API / TypeScript Contract](./public-api-contract.md) が現在の実装範囲と矛盾していない。
- [Security Policy](../SECURITY.md) と [Contributing](../CONTRIBUTING.md) が release / validation 方針と矛盾していない。
- Micro QR、rMQR、QR decoder / scanner integration、logo overlay、styled modules、GS1 full AI catalog、GS1 Digital Link resolver / compression / full canonicalizer が docs に非スコープとして明記されている。Structured Append raw input parity helper は [Structured Append Parity Helper v2.3](./structured-append-parity-v2.3.md) に、manual segments parity helper は [Structured Append Manual Segments Parity Helper v2.3](./structured-append-segments-parity-v2.3.md) に、Planning API は [Planning / Diagnostics API v2.4](./planning-diagnostics-v2.4.md) に分ける。

release tag は、上記 verification が green の main commit にだけ付けます。この
準備 goal では RC 2 tag、publish、GitHub Release、Pages deploy を行いません。

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
npm run release:artifact -- \
  --output-dir /private/tmp/specqr-3.0.0-rc.2-artifact
SPECQR_RELEASE_ARTIFACT_DIR=/private/tmp/specqr-3.0.0-rc.2-artifact \
  SPECQR_EXPECTED_VERSION=3.0.0-rc.2 \
  npm run verify:release:artifact
npm test
npm run verify:types
npm run examples:smoke
npm run pages:build
npm run verify:decode
npm run verify:decode:jsqr
npm run verify:conformance:fuzz
npm run verify:resource-safety
npm run verify:structured-append:memory
npm run verify:reference:nayuki
SPECQR_RELEASE_ARTIFACT_DIR=/private/tmp/specqr-3.0.0-rc.2-artifact \
  npm run verify:pack
SPECQR_RELEASE_ARTIFACT_DIR=/private/tmp/specqr-3.0.0-rc.2-artifact \
  npm run verify:browser:e2e
SPECQR_RELEASE_ARTIFACT_DIR=/private/tmp/specqr-3.0.0-rc.2-artifact \
npm run verify:structured-append:zxing-java
npm run verify:release:workflow
npm run verify:links
npm run verify:writing
npm ls --omit=dev
npm pack --dry-run --cache /private/tmp/specqr-npm-cache
npm publish \
  /private/tmp/specqr-3.0.0-rc.2-artifact/specqr-3.0.0-rc.2.tgz \
  --dry-run --tag next \
  --cache /private/tmp/specqr-npm-cache
```

Artifact path を指定した package-level gate は再 pack しません。Artifact 生成、manifest、
CI data flow の詳細は [Release Artifact Verification](./release-artifact.md) を
参照してください。

## Local Pack Smoke

local pack install smoke は npm 公開前の配布物確認として実行します。

```sh
npm run verify:pack
```

Artifact path を省略した local command では self-pack します。Release/CI では
`SPECQR_RELEASE_ARTIFACT_DIR` を指定し、canonical tarball を一時 install して
再 pack しません。Source を直接 import せず、root / `specqr/node` /
`specqr/browser` の exact runtime export manifest、representative calls、v3
standard/full contract、packaged examples を確認します。Installed tarball の
declarations だけを使い、NodeNext（DOM なし root/node）と Bundler（DOM あり
root/browser）consumer も compile します。

TypeScript declarations は compiler-based consumer check でも確認します。

```sh
npm run verify:types
```

この compiler gate は既存 consumer compatibility、literal/dynamic generate inference、custom/real DOM canvas、GS1 metadata を含む current contract を確認します。Option policy と将来の breaking 候補は [Public API / TypeScript Contract](./public-api-contract.md) に記録し、release 直前に unknown key rejection 等を混入させません。

## Published Package Smoke

npm registry smoke は公開済み package を確認する gate です。RC 2 publish 前は
`latest` が stable 2.4.0、`next` が RC 1 を指すため、RC 2 contract の確認には
canonical tarball を使います。

```sh
node tools/verify-published-package.js \
  --expected-version 3.0.0-rc.2 \
  /private/tmp/specqr-3.0.0-rc.2-artifact/specqr-3.0.0-rc.2.tgz
```

RC を `next` へ publish した後は、exact version と dist-tag が同じ version へ解決する
ことを確認します。

```sh
node tools/verify-published-package.js \
  --expected-version 3.0.0-rc.2 \
  specqr@3.0.0-rc.2 specqr@next
```

`npm run verify:published` と `Published Package Smoke` manual workflow の default も
`specqr@3.0.0-rc.2` / `specqr@next` / expected
`3.0.0-rc.2` です。RC 2 未公開の現在は実行成功を完了条件にせず、workflow schema と
local tarball equivalent だけを検証します。Local path の成功を registry/dist-tag
成功とは表現しません。

## Node Engine Matrix

`package.json` は Node.js `>=18` を support claim として宣言します。CI の
`package-artifact` job が一度だけ作った canonical tarball を download し、
Node 18 / 20 / 22 / 24 の matrix で次の gate を実行します。

- `npm ci`
- `npm test`
- `npm run verify:types`
- `npm run examples:smoke`
- `npm run verify:release:artifact`
- `npm run verify:pack`（download 済み artifact を使用）
- `npm ls --omit=dev`

macOS Vision、ImageMagick、Swift、deterministic conformance / fuzzing、外部参照比較、Pages artifact、pack dry-run などの重い / 環境依存 gate は代表 Node 20 の `Release gates on Node 20` job に集約します。`verify:conformance:fuzz` が全 1280 Nayuki comparison を内包するため、CI job では `verify:reference:nayuki` を重ねて実行しません。後者はローカルで reference lane だけを調査する entry point として維持します。Node 20 は v1 / v2 の既存 release lane と同じで、runtime support matrix とは別に release artifact の比較軸を安定させるために使います。Node 18 matrix が失敗する場合は原因を調査し、修正困難な場合だけ `engines.node` を `>=20` に上げる案を人間判断として扱います。

実ブラウザ検証は Ubuntu / Node.js 22 の専用 job で Chromium、Firefox、WebKit を一度だけ実行します。Harness の dependency と browser binaries は root package から分離し、root engine matrix へ重複させません。ローカル準備、coverage、failure artifacts、non-claims は [Browser E2E](./browser-e2e.md) に記載します。

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

### v2.4.0 Planning API 確認

Planning API を stable API として出す release では、少なくとも次を確認します。

- `estimate(input, options?)` と `QRCode.estimate(input, options?)` が root / static API として型定義・packed package smoke と一致する。
- `analyzeSegments(segments, options?)` と `QRCode.analyzeSegments(segments, options?)` が `generateSegments()` と同じ manual segment surface を planning 対象にする。
- `getCapacity(options)` と `QRCode.getCapacity(options)` が Version / ECC / optional mode の capacity 情報を public-safe shape で返す。
- `estimate()` / `analyzeSegments()` の成功時 planning fields が `generate(..., { diagnostics: true })` / `generateSegments(..., { diagnostics: true })` の planning fields と一致すると README / API docs から分かる。
- Capacity overflow は throw ではなく `{ ok: false, reason: "data-too-long" }` result であることが README / API docs / examples から分かる。
- Overflow result は `CAPACITY_NEAR_LIMIT` を返さず、成功した near-limit result では
  warning を維持する AUD-05 policy が tests / docs と一致する。
- Invalid option、invalid GS1、invalid ECI、invalid color などの configuration error は既存 error class を投げることを docs に残す。
- `getCapacity()` は QR mode-level capacity を返し、GS1 AI、Digital Link、Structured Append high-level split の semantic capacity は `estimate()` / `analyzeSegments()` に任せると明記する。
- `examples/planning-api.mjs` が examples smoke に含まれ、`estimate()` / `analyzeSegments()` / `getCapacity()` / overflow result の代表ケースを実行する。
- Playground package contents に `playground/index.html` / `playground/playground.js` / `playground/styles.css` が含まれ、Planning panel、`QRCode.estimate()`、`QRCode.getCapacity()` の source smoke が通る。
- 2.4.0 は現在の published stable であり、Planning API の registry baseline として
  Conformance Lab と published smoke が確認する。公開済み 3.0.0-rc.1 と未公開
  3.0.0-rc.2 candidate の evidence は、public baseline report と区別する。

### v2.3.0 Structured Append parity 確認

Structured Append parity helper を stable API として出す release では、少なくとも次を確認します。

- `calculateStructuredAppendParity(input)` と `QRCode.calculateStructuredAppendParity(input)` が root / static API として型定義・packed package smoke と一致する。
- `calculateStructuredAppendSegmentsParity(segments, options?)` と `QRCode.calculateStructuredAppendSegmentsParity(segments, options?)` が root / static API として型定義・packed package smoke と一致する。
- `calculateStructuredAppendParity()` は string / binary input 用、`calculateStructuredAppendSegmentsParity()` は manual segment list 用であることが README / API docs から分かる。
- どちらの helper も QR encoded bitstream、mode indicator、character count indicator、padding、ECC、Structured Append header を XOR するものではなく、logical message bytes の XOR を返すと明記されている。
- `generateStructuredAppend()` の `parity` は raw input helper と一致し、`generateSegmentsStructuredAppend()` の `parity` は manual segments helper と一致する。
- manual segments helper は `generateSegmentsStructuredAppend()` と同じ canonical bytes policy を使う。numeric / alphanumeric は ASCII、byte string は UTF-8、byte binary は raw bytes、Kanji は original JavaScript string の UTF-8 bytes とし、ECI / GS1 / FNC1 / FNC1 second / low-level `structured-append` segment は reject する。
- `docs/structured-append-parity-v2.3.md` と `docs/structured-append-segments-parity-v2.3.md` が 2.3.0 stable package 前提の内容になっている。
- published package smoke は現在 npm registry にある直近 stable を確認するための gate であり、release preparation 中の未公開 version の確認は `npm run verify:pack`、`npm pack --dry-run`、`npm publish --dry-run` で行う。

### v2.2 系 patch の Digital Link 確認

Digital Link docs / playground だけを直す patch でも、少なくとも次を確認します。

- README から `docs/api.md`、`docs/gs1-digital-link-v2.md`、`docs/gs1-digital-link-validation-v2.2.md`、`docs/gs1-supported-ai.md` へ自然に辿れる。
- Playground の `GS1 Digital Link URI` 入力形式で `validateGs1DigitalLink()` と `normalizeGs1DigitalLink()` の結果が見える。
- Unknown query は default `preserve` で warning、`reject` で validation error として表示される。
- Digital Link URI QR は通常 URL QR として扱い、`gs1: true` / FNC1 first position と混同する説明が残っていない。
- `normalizeGs1DigitalLink()` を full canonicalizer と表現していない。

### v3 Structured Append diagnostics candidate

`diagnostics.splitUnits` contract は `3.0.0-rc.1` で prerelease 公開済みです。
`3.0.0-rc.2` は同じ contract を維持します。通常 gate に加えて次を必須とします。

- `diagnostics:false` / omitted / `true` / object form の option/return matrix。
- Standard で `splitUnits` own property 不在、materializer 呼出し0回、
  `splitUnitCount` 正確性。
- Full opt-in で v2 `splitUnits` array/順序/mutability/JSON が一致し、legacy
  summary projection、split 位置、parity、matrix/output hash が一致。
- Named/static、literal/dynamic options の source および packed consumer types。
- Node と Chromium / Firefox / WebKit で `Object.hasOwn()`、JSON、
  `structuredClone()`、mutation isolation。
- Version 40-L / 16-symbol の 5-run standard/full report と 32 MiB standard 成功。
- Bounded/extended conformance、Nayuki 1,280、ZXing Java metadata lane、
  packed/browser gates が green。

Package version、CHANGELOG、migration、single-artifact pipeline は RC candidate へ
統合済みです。RC tag、publish、GitHub Release は人間が canonical tarball と
manifest を review した後だけ行います。Unknown top-level option rejection、
GS1 readonly、新 inspection API は RC 2 へ混ぜません。Release freeze 後は、
これらを同じ version へ追加しません。

## npm RC Publish

RC dry-run:

```sh
npm publish \
  /private/tmp/specqr-3.0.0-rc.2-artifact/specqr-3.0.0-rc.2.tgz \
  --dry-run --tag next \
  --cache /private/tmp/specqr-npm-cache
```

人間の明示承認後にだけ実行する RC publish:

```sh
npm publish \
  /private/tmp/specqr-3.0.0-rc.2-artifact/specqr-3.0.0-rc.2.tgz \
  --tag next \
  --cache /private/tmp/specqr-npm-cache
```

公開後確認:

```sh
npm view specqr@3.0.0-rc.2 version repository homepage bugs --json
npm view specqr dist-tags versions --json
node tools/verify-published-package.js \
  --expected-version 3.0.0-rc.2 \
  specqr@3.0.0-rc.2 specqr@next
```

`latest` は 2.4.0 stable に残し、RC publish で変更しません。上記 registry smoke が
成功するまで tag、GitHub Release、Pages deploy へ進みません。

## Rollback and Stable Promotion

publish 前に gate、artifact manifest、editorial audit のいずれかが失敗した場合は、
RC 2 を公開せず修正します。runtime / type contract の修正が必要なら freeze を解除し、
変更を再評価します。

publish 後に exact version、`next`、metadata、exports、types、v3 contract の検証が
失敗した場合は、同じ version の上書きや即時 unpublish を行いません。原因を記録し、
必要に応じて `next` の移動、RC 2 の deprecate、新しい RC の publish を人間が
判断します。

`3.0.0` stable へ進む条件:

- RC line の唯一の API shape breaking change と AUD-05 warning correction が利用者に理解できる。
- canonical artifact と hosted CI の required jobs が green。
- `specqr@3.0.0-rc.2` と `specqr@next` の post-publish verification が green。
- RC 評価中に追加の runtime / type / export 変更が入っていない。
- [v3 Migration Guide](./v3-migration.md) の rollback 条件を満たす。

## GitHub Stable Release

stable version を npm `latest` で publish し、published package smoke が成功した後に GitHub Release を作成します。

- Tag: `vX.Y.Z`
- Title: `SpecQR X.Y.Z`
- npm install:
  ```sh
  npm install specqr
  ```
- 主な対応範囲: QR Code Model 2 Version 1-40、L/M/Q/H、Numeric / Alphanumeric / Byte / Kanji、ECI、GS1/FNC1 first position、GS1 raw element string parser、GS1 validation / supported AI introspection API、GS1 Digital Link create/parse/validate/normalize helper、FNC1 second position、Structured Append low-level header / high-level automatic splitting / manual segment splitting / decoded parts merge helper、Planning API、SVG/PNG/canvas/Node/browser helpers。
- v2.4.0 release note では、`estimate()`、`analyzeSegments()`、`getCapacity()`、`QRCode` static variants、Planning examples、Playground Planning panel、`data-too-long` が `ok:false` で返る方針を明記する。
- 検証: Node 18 / 20 / 22 / 24 matrix、golden conformance、deterministic conformance / fuzzing、jsQR decoder validation、macOS Vision validation、ZXing Java 3.5.4 Structured Append metadata、全 1280 fixed-condition Nayuki comparison、local pack smoke、npm publish dry-run。
- 非対応: Micro QR、rMQR、QR decoder / scanner integration、logo overlay、styled modules、GS1 full AI catalog、GS1 Digital Link resolver / compression / full canonicalizer。Structured Append raw input parity helper と manual segments parity helper は実装済み。
- Structured Append の読み取り後 merge helper は metadata-returning decoder が `{ index, total, parity, data }` を返せる場合だけ扱います。required ZXing Java lane の証拠と non-claims は `docs/structured-append-zxing-java.md` に整理済みです。
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
- `e2e`
- `tests`
- `.github`
- local cache / logs / screenshots / tarballs
- Playwright report / test-results
- ZXing fixture PNG / JAR / compiled class / Maven cache / generated report

SpecQR の runtime dependency は 0 を維持します。`jsqr`、`nayuki-qr-code-generator`、TypeScript は devDependency であり、library runtime には含めません。

Canonical tarball の allow/deny 判定、file-level content manifest、repack 比較は
[Release Artifact Verification](./release-artifact.md) を source of truth とします。
