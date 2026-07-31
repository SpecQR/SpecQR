# Browser E2E

SpecQR の実ブラウザ gate は、npm tarball と GitHub Pages artifact を利用者に近い形で実行し、Node 上の unit test や source inspection だけでは確認できない browser contract を固定します。

## 構成

Harness は `e2e/browser/` に分離しています。root package の Node.js `>=18` と runtime dependency 0 を維持するため、専用 `package.json` / lockfile は Node.js `>=22` と `@playwright/test` だけを持ちます。root dependencies、package exports、公開 API には追加しません。

Playwright `1.62.0` の次の 3 projects を retry 0 で実行します。

- Chromium
- Firefox
- WebKit

Playwright WebKit は branded Safari そのものではありません。実 Safari、実端末、mobile browser、scanner、network/CDN、visual fidelity の適合性はこの gate の claim に含めません。

## ローカル実行

最初に harness と browser binaries を準備します。

```sh
npm ci --prefix e2e/browser
npm --prefix e2e/browser run install:browsers
```

3 engines を実行します。

```sh
npm run verify:browser:e2e
```

特定 engine だけを再実行する場合:

```sh
npm --prefix e2e/browser run verify -- --project=chromium
```

Browser binaries がない場合、gate は skip せず、上記 install command を含む error で失敗します。

## Packed package fixture

CI / release 検証では、`package-artifact` job が作った canonical tarball を
`SPECQR_RELEASE_ARTIFACT_DIR` から読み、再 pack せず OS の一時 directory へ
install します。Artifact 指定なしの local command は従来どおり current checkout を
self-pack して単独実行できます。Artifact path や manifest が不正な場合、source や
self-pack へ fallback せず failure になります。

Installed `package.json` の `exports` から root と `./browser` の import entry を
解決し、生成した import map で `"specqr"` と `"specqr/browser"` を native ESM
import します。Entry path を test へ二重記述しません。

Local server が公開する package path は installed tarball の内容だけです。Checkout の `src/` を直接配信しません。次を 3 engines で確認します。

- `generate()` の matrix / SVG / PNG、PNG signature / dimensions、determinism
- 実 `HTMLCanvasElement` / 2D context の dimensions、代表 pixel、return contract
- `toBlob()` / `toBlobFromSegments()` の MIME、size、PNG bytes
- `toObjectURL()` / segment 版の fetch、bytes、revoke
- `toImageData()` / segment 版の dimensions、RGBA length、代表 pixel
- transparent background、offset 付き `ArrayBufferView`
- geometry budget 超過時の `InvalidInputError` class / code / message
- Kanji mode 対応時の生成、または非対応時の明示的 fallback / reject
- v3 candidate の manual Structured Append standard/full、
  `symbolResults` output/diagnostics、named/static consistency
- `Object.hasOwn()`、`Object.keys()`、`JSON.stringify()`、
  `structuredClone()`、full array mutability と fresh-call isolation

## Built Playground fixture

Harness は毎回 `npm run pages:build` を実行し、`dist/pages` だけを配信します。Source playground を直接開く経路はありません。読み込まれた JavaScript resource が `/pages/` 配下だけであることも test します。

次の利用経路を role / label 中心で操作し、結果値まで確認します。

- Single QR: preview、Planning、diagnostics、PNG download
- Fixed Version overflow: `data-too-long`、error、preview / download 無効化
- GS1 QR: human-readable input、FNC1 first position
- GS1 Digital Link: validation、normalization、unknown query preserve / reject
- Structured Append: 複数 symbol、summary、warning、symbol PNG link、
  manual split detail の default standard / full 切替

`console.error`、page error、unhandled rejection、外部 HTTP(S) request、failed local request、local HTTP 4xx/5xx は test failure です。外部 URL にはアクセスしません。

## CI と failure artifacts

GitHub Actions の `Browser E2E on canonical tarball` job が Ubuntu /
Node.js 22 で release artifact を download し、3 engines を一度だけ実行します。
Node engine matrix へ重複させません。Browser E2E failure 時は Playwright trace、
screenshot、JSON / HTML report を `browser-e2e-failure-artifacts` として
保存します。

Visual snapshot は合否基準にしません。Web-first assertion と deterministic local fixture を使い、retry、固定 sleep、conditional skip で failure を隠しません。

## Package hygiene

`e2e/browser/`、Playwright report、test results、browser binaries、temporary tarball / install directory は npm package に含めません。`npm run verify:pack` と Browser E2E runner 自身が tarball 内に `e2e/` がないことを検査します。
