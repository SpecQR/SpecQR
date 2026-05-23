# SpecQR Examples

These examples import SpecQR through the package entrypoints, the same way an installed app would.

## Node PNG file

```sh
npm run examples:node
```

By default this writes a PNG file into the operating system temporary directory. Pass a path to choose the output location.

```sh
node examples/node-save-png.mjs ./tmp/example-node.png
```

## GS1 QR

```sh
npm run examples:gs1
```

This creates a GS1 QR SVG using the human-readable parser, GTIN check digit helper, and FNC1 first position.

## GS1 Digital Link QR

```sh
npm run examples:gs1-digital-link
```

This creates a normal URL QR SVG from a GS1 Digital Link URI. It intentionally does not use `gs1: true`.

## Structured Append

```sh
npm run examples:structured-append
```

This writes string and binary Structured Append sets as SVG/PNG symbols, plus a summary JSON file with total, parity, per-symbol chunk offsets, and diagnostics.

## Structured Append merge

```sh
npm run examples:structured-append-merge
```

This shows how to adapt decoder output with Structured Append metadata into `{ index, total, parity, data }` parts for `mergeStructuredAppendParts()`. The example covers string parts, binary parts, shuffled scan order, expected missing/duplicate/parity errors, and a ZXing Java style metadata mapping.

## Browser Blob / Object URL

Serve the repository and open `examples/browser-blob-object-url.html`.

```sh
npm run playground
```

Then open `http://127.0.0.1:4173/examples/browser-blob-object-url.html`.

## TypeScript

`examples/typescript-usage.ts` shows typed imports, diagnostic results, GS1 helpers, and Node helper usage.
