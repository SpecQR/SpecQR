# Public API / TypeScript Contract

この文書は SpecQR `3.0.0-rc.2` release-correction candidate の public runtime /
TypeScript / option contract を整理します。`3.0.0-rc.1` は npm `next` で公開済みで、
RC 2 は未公開です。型精密化や package
gate の根拠であり、QR encoding、renderer bytes、diagnostics、
error / warning semantics を新たに変更する文書ではありません。2.4.0 から RC 1
までの AUD-05 warning semantics は別途訂正済みです。

RC 2 は release-correction freeze 状態です。実装済みの manual Structured Append
diagnostics contract 以外に、runtime、型、public export の変更は追加しません。
unknown-option rejection、GS1 metadata readonly、新しい inspection API は
future candidate のままです。

## Package Surface

`package.json` が公開する runtime subpath は次の 3 つです。

| Import | Runtime | Types | Runtime exports |
| --- | --- | --- | ---: |
| `specqr` | `src/index.js` | `src/index.d.ts` | 42 |
| `specqr/node` | `src/node.js` | `src/node.d.ts` | 4 |
| `specqr/browser` | `src/browser.js` | `src/browser.d.ts` | 6 |

Root は generation / planning / Structured Append、GS1 / Digital Link、error classes を named export します。`QRCode` は separator constant と error classes を除く operation を 30 static methods で mirror します。Node subpath は PNG buffer / file helper、browser subpath は Blob / Object URL / ImageData helper だけを公開します。CommonJS と内部 module は package export ではありません。

Runtime export manifest は architecture characterization test と、tarball を隔離 install する `npm run verify:pack` の双方で固定します。Type-only surface は `src/index.d.ts`、`src/node.d.ts`、`src/browser.d.ts` が source of truth です。

## Generate Return Inference

`generate()` / `generateSegments()` と対応する `QRCode` static methods は、literal option では output に対応する型を返します。

```ts
import {
  generate,
  type QRCodeOptions,
  type QRGenerateResult,
  type QRMatrix
} from "specqr";

const svg = generate("A"); // string
const matrix = generate("A", { output: "matrix" }); // QRMatrix
const png = generate("A", { output: "png" }); // Uint8Array
const detailed = generate("A", { diagnostics: true }); // QRCodeDiagnosticResult

declare const options: QRCodeOptions;
const dynamic: QRGenerateResult = generate("A", options);
```

Overload は narrow literal overload を先に、`QRCodeOptions -> QRGenerateResult` catch-all を最後に置きます。これにより動的な `output` / `diagnostics` を含む正当な `QRCodeOptions` 変数を拒否しません。引数省略時は runtime default `output: "svg"` と一致して `string` です。

High-level Structured Append も同じ方針です。Literal output は `QRStructuredAppendResult<TSymbol>` / `QRStructuredAppendSegmentsResult<TSymbol>` の symbol 型を絞り、動的 options は既存の default generic result を返します。

今回の変更分類:

- Widening / additive: `QRCodeOptions` と Structured Append options の catch-all overload。
- Runtime との誤記修正: `diagnostics: true` / fixed output overload で options object 自体を optional にしない。引数省略は `string`。
- 適用しない narrowing: 現在コンパイルできる option shape、GS1 metadata mutation、unknown key を型や runtime で新たに拒否しない。

## Canvas Portability

Root declaration は `HTMLCanvasElement`、`CanvasRenderingContext2D`、`Blob`、`ImageData` などの DOM global 名を直接要求しません。従来の `QRCanvasLike` / `QRCanvasContextLike` / `QRCanvasTarget` は互換性のため維持します。

`drawToCanvas()` には非公開の最小 structural overload もあり、DOM lib が有効な consumer では実 `HTMLCanvasElement` と `CanvasRenderingContext2D` を直接渡せます。Context contract は `width` / `height`、`getContext("2d")`、`canvas` dimensions、`fillStyle` setter-compatible value、`fillRect()` だけを要求します。SpecQR の root 型が DOM global を参照することはありません。

継続 gate:

- NodeNext、`lib: ["ES2022"]`、Node types: root / node subpath と custom canvas mock。
- Bundler、`lib: ["ES2022", "DOM"]`: root / browser subpath と実 DOM canvas/context。

## GS1 Metadata Mutation Boundary

`getSupportedGs1Ais()` と `getGs1AiInfo()` の runtime return は内部 dictionary そのものではありません。

- 呼出しごとに detached public metadata を返す。
- Array、metadata object、nested `length`、`digitalLinkPathForPrimary` は freeze 済み。
- Internal `RegExp` や validator object は公開しない。
- Mutation attempt が失敗しても後続の introspection / validation へ伝播しない。

一方、現在の `GS1AiInfo` / `GS1AiInfo[]` declaration は mutable のまま維持します。`readonly` annotation は runtime を正確に表しますが、既存 TypeScript consumer の代入や `push()` を拒否する narrowing です。Minor release で適用せず、v3 では次のいずれかを明示的に選びます。

1. Runtime freeze に合わせて deeply readonly type にする。
2. Mutable defensive copy を返すよう runtime contract を変更する。

現状は runtime safety を優先しつつ、型 tightening を major decision として残す互換方針です。

## Option Policy Matrix

次は推奨入力ではなく、current major の実行時互換挙動です。Known option の正当な値を object で渡す使い方を推奨します。

| API family | Container | Unknown own key | Inherited property | Alias / owned option |
| --- | --- | --- | --- | --- |
| `generate()` / `estimate()` | `undefined`、`null`、array も legacy behavior として default merge | 無視 | spread 対象外なので無視 | `errorCorrection` / `mask` は unknown key として無視 |
| `generateSegments()` / `analyzeSegments()` | Base と同じ | 無視 | 無視 | Segment mode が source of truth。`mode` / `optimizeSegments` は manual segment を書き換えない |
| `getCapacity()` | non-null non-array object が必須 | 無視 | `version` は通常 property lookup、optional fields は own-property policy | `errorCorrection` alias を明示サポート。両名が異なる場合は reject |
| `generateStructuredAppend()` | non-null non-array object が必須 | 無視 | owned-option check と merge の対象外 | own `errorCorrection` / `mask` / `parity` を reject。`structuredAppend` は `false` 以外 reject |
| `generateSegmentsStructuredAppend()` | non-null non-array object が必須 | 無視 | 同上 | 上記に加え own `mode` / `encoding` / `optimizeSegments` を reject |
| `calculateStructuredAppendSegmentsParity()` | non-null non-array object | 許可しない | 対象外 | 現在は空 object のみ |
| `specqr/node` / `specqr/browser` helpers | Base に渡せる legacy container | Base と同じ | spread 対象外 | Helper が `output` と `diagnostics: false` を所有し、caller 値を上書き |

Known option の type/range/conflict は既存 error class/code/message で検査します。
Base generation API の `diagnostics` は引き続き truthy value が diagnostic return を
選ぶ baseline を維持します。v3 candidate では
`generateSegmentsStructuredAppend()` だけが boolean/object schema を所有し、
raw `generateStructuredAppend()` は object form を
`InvalidInputError` で reject します。Base API の `null` / array 受理、unknown key
の無視、`getCapacity()` の inherited `version` は characterization test で記録
していますが、新規利用で依存すべき仕様ではありません。

## v3 Decisions

次は一貫性を上げますが、現 major で適用すると既存 JavaScript / TypeScript consumer を壊し得るため未実装です。

1. 全 options を non-null plain object に統一する。
2. Unknown own key を reject するか、全 API で明示的に無視するかを統一する。
3. `diagnostics` を厳密な boolean として validation する。
4. `errorCorrection` / `mask` alias policy を base、Planning、Structured Append で統一する。
5. Manual segment API が所有する `mode` / `encoding` / `optimizeSegments` の扱いを統一する。
6. Node/browser helper の `output` / `diagnostics` を上書きするか reject するかを明文化して統一する。
7. GS1 metadata の public type を deeply readonly にするか、runtime を mutable copy に変える。

Structured Append manual segments の `diagnostics.splitUnits` を standard/full へ
分ける major contract は
[v3 Structured Append Diagnostics Contract](./v3-structured-append-diagnostics.md)
どおり、`3.0.0-rc.1` で prerelease 公開済みです。現在の未公開
`3.0.0-rc.2` candidate も同じ contract を維持します。これは unknown top-level
option rejection や GS1
readonly とは別 goal です。候補間の依存順は
[SpecQR v3 Roadmap](./v3-roadmap.md) に整理しています。

## Release Gates

`npm run verify:types` は次の 3 consumer を source declarations に対して compile します。

1. 既存の mixed root/node/browser consumer と baseline compatibility fixture。
2. DOM なし NodeNext root/node consumer。
3. DOM あり Bundler root/browser consumer。

`npm run verify:pack` は source を直接 import せず、tarball を隔離 directory へ
install して次を確認します。Artifact path を省略した local 実行は self-pack し、
`SPECQR_RELEASE_ARTIFACT_DIR` または `--artifact-dir` を指定した release lane では
canonical tarball を使って再 pack しません。

- root / node / browser runtime import と exact export manifest。
- Root generation、Node PNG、browser Blob の代表呼出し。
- Installed declarations に対する NodeNext / Bundler TypeScript compile。
- Package contents と declaration surface。

Published registry package の確認は `verify:published` の責務です。未公開 working tree の contract は `verify:pack` を release gate とし、両者を混同しません。

3.0.0-rc.2 candidate では `npm run release:artifact` が tarball と全 file content manifest を
一度生成し、Node 18 / 20 / 22 / 24、packed/type、browser、ZXing Java へ同じ
artifact を渡します。構成と post-publish exact-version check は
[Release Artifact Verification](./release-artifact.md) を参照してください。
