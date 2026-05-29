# SpecQR Examples

これらの examples は、実際の利用アプリと同じように package entrypoints から SpecQR を import します。

## Node PNG file

```sh
npm run examples:node
```

デフォルトでは OS の一時ディレクトリに PNG を書き出します。出力先を指定したい場合は path を渡します。

```sh
node examples/node-save-png.mjs ./tmp/example-node.png
```

## GS1 QR

```sh
npm run examples:gs1
```

Human-readable parser、GTIN check digit helper、FNC1 first position を使って GS1 QR SVG を作ります。

## GS1 Digital Link QR

```sh
npm run examples:gs1-digital-link
```

GS1 Digital Link URI から通常 URL QR SVG を作ります。`parseGs1DigitalLink()`、`validateGs1DigitalLink()`、`normalizeGs1DigitalLink()` を実行し、unknown query の default preserve と strict reject の違いも summary に出します。Digital Link は FNC1 first position ではないため、意図的に `gs1: true` は使いません。

## Planning API

```sh
npm run examples:planning
```

`estimate()` で入力の Version / capacity / remaining bits / warnings を確認し、`getCapacity()` で Version / ECC / mode の容量を参照します。`analyzeSegments()` の manual segments planning と、容量超過が throw ではなく `{ ok: false, reason: "data-too-long" }` で返る例も含みます。

## Structured Append

```sh
npm run examples:structured-append
```

string / binary input の Structured Append set を SVG/PNG symbols として書き出し、`total`、`parity`、per-symbol chunk offsets、diagnostics を含む summary JSON も保存します。

## Structured Append merge

```sh
npm run examples:structured-append-merge
```

Structured Append metadata を持つ decoder output を、`mergeStructuredAppendParts()` に渡せる `{ index, total, parity, data }` parts へ変換する adapter 例です。string parts、binary parts、shuffled scan order、missing / duplicate / parity errors、ZXing Java style metadata mapping を覆います。

## Browser Blob / Object URL

repository を serve して `examples/browser-blob-object-url.html` を開きます。

```sh
npm run playground
```

その後 `http://127.0.0.1:4173/examples/browser-blob-object-url.html` を開きます。

## TypeScript

`examples/typescript-usage.ts` は typed imports、diagnostic results、GS1 helpers、Node helper の利用例です。
