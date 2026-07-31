# SpecQR v3 Migration Guide

SpecQR 3.0.0-rc.1 changes only the diagnostics contract of
`generateSegmentsStructuredAppend()`. QR matrices, rendered bytes, split
strategy, parity, errors, warnings, package exports, and the remaining public
APIs keep their v2 behavior.

この文書は SpecQR 2.4.0 から 3.0.0-rc.1 へ移行する際の変更点をまとめます。
RC 1 で breaking になるのは、manual segments 版 Structured Append の
`diagnostics.splitUnits` だけです。

RC 1 は release freeze 状態です。unknown-option rejection、GS1 metadata readonly、
新しい inspection API、その他の runtime / type / export 変更はこの候補へ追加しません。

## 変更されない利用

`splitUnits` を読んでいない場合は、呼出しを変更する必要はありません。

```js
const result = generateSegmentsStructuredAppend(segments, {
  output: "png"
});

console.log(result.total);
console.log(result.diagnostics.splitUnitCount);
```

Standard diagnostics は次を返します。

```js
{
  splitUnitsDetail: "summary",
  splitUnitCount: 123,
  // splitUnits own propertyは存在しない
}
```

`splitUnits` は `undefined` や空配列ではなく、property 自体が存在しません。

```js
Object.hasOwn(result.diagnostics, "splitUnits"); // false
"splitUnits" in result.diagnostics;              // false
JSON.stringify(result.diagnostics);              // splitUnits keyなし
```

## Full split-unit detail

v2 と同じ full detail を使う consumer は、明示的に opt-in します。

```js
// SpecQR 2.x
const v2 = generateSegmentsStructuredAppend(segments, {
  diagnostics: true
});
console.log(v2.diagnostics.splitUnits);

// SpecQR 3.x
const v3 = generateSegmentsStructuredAppend(segments, {
  diagnostics: { splitUnits: "full" }
});
console.log(v3.diagnostics.splitUnits);
```

Full summary には次が含まれます。

```js
{
  splitUnitsDetail: "full",
  splitUnitCount: 123,
  splitUnits: [/* v2と同じplain mutable entries */]
}
```

`splitUnits` の entry field、順序、offset 単位、JSON property order、
plain-object mutability は v2 と同じです。Summary 全体には v3 の
`splitUnitsDetail` と `splitUnitCount` が加わるため、summary 全体の JSON は
v2 と byte-for-byte 同一ではありません。

## Symbol result selection

Diagnostics object では、各 symbol に requested output を返すか、diagnostic result を
返すかを明示できます。

```js
const pngSet = generateSegmentsStructuredAppend(segments, {
  output: "png",
  diagnostics: {
    splitUnits: "full",
    symbolResults: "output"
  }
});

pngSet.symbols[0]; // Uint8Array
```

```js
const diagnosticSet = generateSegmentsStructuredAppend(segments, {
  output: "png",
  diagnostics: {
    splitUnits: "summary",
    symbolResults: "diagnostics"
  }
});

diagnosticSet.symbols[0].matrix;
diagnosticSet.symbols[0].diagnostics;
```

Object form の default は次です。

```js
{
  splitUnits: "summary",
  symbolResults: "diagnostics"
}
```

したがって `diagnostics: {}` と `diagnostics: true` は、standard detail と
diagnostic symbol results を返します。

## TypeScript narrowing

Literal options では return type が narrow されます。

```ts
const standard = generateSegmentsStructuredAppend(segments, {
  diagnostics: true
});
standard.diagnostics.splitUnitsDetail; // "summary"

const full = generateSegmentsStructuredAppend(segments, {
  diagnostics: { splitUnits: "full" }
});
full.diagnostics.splitUnits; // QRStructuredAppendSplitUnitDiagnostics[]

const fullPng = generateSegmentsStructuredAppend(segments, {
  output: "png",
  diagnostics: {
    splitUnits: "full",
    symbolResults: "output"
  }
});
fullPng.symbols[0]; // Uint8Array
```

Dynamic options は standard/full の安全な union になります。

```ts
declare const options: QRStructuredAppendSegmentsGenerateOptions;
const result = generateSegmentsStructuredAppend(segments, options);

if (result.diagnostics.splitUnitsDetail === "full") {
  console.log(result.diagnostics.splitUnits);
}
```

Standard 型には `splitUnits` field を定義していません。`in` operator または
`splitUnitsDetail` discriminant で narrow してください。

## Serialization

| Operation | Standard | Full |
| --- | --- | --- |
| `Object.hasOwn(..., "splitUnits")` | `false` | `true` |
| `JSON.stringify()` | compact、`splitUnits` key なし | full array を列挙 |
| `structuredClone()` | compact plain data | full array を複製 |
| Mutation | full array なし | v2 と同じ plain mutable array |

Lazy getter、Proxy、iterator は導入していません。JSON、clone、inspection 時に
暗黙の full materialization が起きないよう、full detail は明示的な eager
opt-in だけです。

## Raw Structured Append

`generateStructuredAppend()` は manual split-unit detail を持たず、従来どおり
`diagnostics?: boolean` だけを受け付けます。

```js
generateStructuredAppend(input, {
  diagnostics: true
});
```

Object form を渡すと `InvalidInputError` になります。Object form は
`generateSegmentsStructuredAppend()` 専用です。

## Rollback 条件

3.0.0 stable へ進む前に、次のいずれかが満たせない場合は RC からこの変更を外し、
v2 の eager contract へ戻します。

- Full `splitUnits` が v2 fixtures と一致する。
- Standard path の materialization が0回である。
- Node 18 / 20 / 22 / 24、NodeNext / Bundler、3 browser engines、
  ZXing Java package-level gate が同一 tarball で成功する。
- Matrix、SVG/PNG bytes、split 位置、parity、warning 順序が変化しない。

Stable 公開後に standard へ `splitUnits` を黙って戻すことは、property presence と
serialization contract を再変更するため patch rollback として扱いません。

## RC 1 に含めない変更

- Top-level unknown option rejection
- GS1 metadata readonly / runtime freeze
- Structured Append inspection API
- GS1 catalog 拡張
- Micro QR / rMQR / styled output / logo overlay

これらは RC 1 の評価結果と分離して設計・実装します。
