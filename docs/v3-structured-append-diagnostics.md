# v3 Structured Append Diagnostics Contract

Status: **Integrated as SpecQR 3.0.0-rc.1 candidate / unpublished**  
Target: SpecQR 3.0.0 release line  
対象 checkout: `main` / `18da5bc1e2ca1cb7d4249b0c886fb0b88f643ee9`
と、2026-07-31 時点の dirty working tree 全体

この文書は、manual segments 版
`generateSegmentsStructuredAppend()` が返す
`diagnostics.splitUnits` を、v3 で compact standard diagnostics と明示的な full
detail へ分ける公開 contract を固定します。2026-07-31 時点の dirty working tree では
runtime、TypeScript declarations、unit/packed/browser/fuzz/resource tests へ
この contract を実装済みです。Package metadata は `3.0.0-rc.1` へ統合しましたが、
npm 公開、tag、GitHub Release は行っていないため、registry package や stable
support の claim ではありません。

この contract は RC 1 の唯一の breaking change として release freeze 済みです。
unknown-option rejection、GS1 readonly、新 inspection API、その他の runtime / type
変更は RC 1 に追加しません。

QR encoding、分割位置、Structured Append parity、per-symbol diagnostics、
renderer output はこの設計の対象外です。

## 結論

v3 では次を採用します。

- `diagnostics: true` は**standard diagnostics**を返す。
- standard diagnostics は `splitUnits` property を持たない。
- standard/full の両方に `splitUnitCount` と
  `splitUnitsDetail` discriminant を返す。
- full detail は
  `diagnostics: { splitUnits: "full" }` で明示的に要求する。
- full detail の `splitUnits` は、v2 と同じ plain eager array、field、順序、
  offset、mutability を返す。
- `diagnostics` object では symbol result shape も明示できる。
- lazy getter、Proxy、iterator、別 inspection API は初期 v3 では採用しない。

採用する option shape は次です。

```ts
export type QRStructuredAppendSplitUnitsDetail = "summary" | "full";
export type QRStructuredAppendSymbolResultMode =
  | "output"
  | "diagnostics";

export interface QRStructuredAppendSegmentsDiagnosticsOptions {
  splitUnits?: QRStructuredAppendSplitUnitsDetail;
  symbolResults?: QRStructuredAppendSymbolResultMode;
}
```

`QRStructuredAppendSegmentsGenerateOptions["diagnostics"]` だけを次へ広げます。
Base `generate()`、`generateSegments()`、raw input 版
`generateStructuredAppend()` の `diagnostics?: boolean` はこの設計では変更しません。

```ts
diagnostics?:
  | boolean
  | QRStructuredAppendSegmentsDiagnosticsOptions;
```

## Published v2 baseline contract

### Return shape

Named export と `QRCode` static method は同じ実装と型を使います。

```ts
generateSegmentsStructuredAppend(
  segments,
  options
): {
  symbols;
  total;
  parity;
  inputLength;
  byteLength;
  diagnostics: QRStructuredAppendSegmentsSummaryDiagnostics;
}
```

Top-level `diagnostics` は option に関係なく常に存在します。現行の違いは
`symbols` の要素だけです。

| v2 baseline option | `symbols[i]` | top-level `diagnostics.splitUnits` |
| --- | --- | --- |
| omitted / `false` | requested `output` | 必須 eager array |
| `true` | `QRCodeDiagnosticResult` | 必須 eager array |
| truthy non-boolean runtime value | `QRCodeDiagnosticResult` | 必須 eager array |

Published v2 baseline は `diagnostics` を boolean validation していません。TypeScript では
`boolean` だけを公開しています。これは v3 object option を導入する余地では
ありますが、truthy object の現行挙動を正式な object contract とはみなしません。

Published v2 overload は次を返します。

- literal `diagnostics: true`:
  `QRStructuredAppendSegmentsResult<QRCodeDiagnosticResult>`
- literal `output: "matrix"` / `"png"` / string outputs と
  `diagnostics?: false`: output に対応する symbol type
- `QRStructuredAppendSegmentsGenerateOptions` 型の dynamic options:
  `QRStructuredAppendSegmentsResult<QRGenerateResult>`

Named export と `QRCode.generateSegmentsStructuredAppend()` の推論は同じです。

### v2 summary inventory

v2 baseline の `QRStructuredAppendSegmentsSummaryDiagnostics` は次の own enumerable
properties をこの順序で生成します。

1. `version`
2. `errorCorrectionLevel`
3. `versionSelection`
4. `versionSelectionReason`
5. `total`
6. `parity`
7. `byteLength`
8. `inputLength`
9. `segmentCount`
10. `maxSymbols`
11. `splitStrategy`
12. `splitUnits`
13. `symbols`
14. `warnings`

v2 baseline の `splitUnits` は全 symbols の build 成功後、summary assembly 時に一度
materialize されます。`diagnostics:false` でも省略されません。Generation が
error で終了した場合は result 自体がないため、array も公開されません。

Array、各 entry、`splitUnits` property はいずれも freeze されていません。
Property は enumerable、writable、configurable です。したがって
`JSON.stringify()` は全 entry を出力し、`structuredClone()` は plain data として
全 entry を複製します。Mutation は internal state へ戻りませんが、返却後の同じ
result object には反映されます。

### v2 split unit fields

```ts
interface QRStructuredAppendSplitUnitDiagnostics {
  sourceSegmentIndex: number;
  mode: "numeric" | "alphanumeric" | "byte" | "kanji";
  unitStart: number;
  unitLength: number;
  byteStart: number;
  byteLength: number;
}
```

| Field | v2 baseline の意味 |
| --- | --- |
| `sourceSegmentIndex` | caller 順を保つ normalized manual data segment list の zero-based index |
| `mode` | source segment の data mode |
| `unitStart` | source segment 内の zero-based logical unit offset |
| `unitLength` | この entry が表す logical units。Byte は常に 1、他 mode は segment 全体の code-point count |
| `byteStart` | 全 manual segments を連結した canonical logical message bytes 内の zero-based offset |
| `byteLength` | この entry が占める canonical bytes |

Ordering は `sourceSegmentIndex`、同じ byte segment 内では `unitStart` の昇順です。

- binary byte segment: 1 raw byte = 1 split unit
- text byte segment: 1 Unicode code point = 1 split unit。`byteLength` は UTF-8長
- numeric / alphanumeric / kanji: segment 全体 = 1 atomic split unit
- numeric / alphanumeric canonical bytes: ASCII
- kanji canonical bytes: original JavaScript string の UTF-8
- `byteStart` は QR encoded bitstream、Shift_JIS offset、UTF-16 index ではない

`diagnostics.symbols[].splitUnitStart` / `splitUnitLength` は、この global
logical split-unit sequence を参照します。この offset contract は v3 でも
変更しません。

## 現行 cost の測定

### Method

測定日は 2026-07-31 です。

- macOS 27.0 (`26A5353q`)、Darwin arm64
- Node.js `v25.9.0`
- V8 `14.1.146.11-node.25`
- fixed Version 40-L、`maxSymbols: 16`、fixed mask `0`
- `output: "matrix"`、`diagnostics: false`
- `node --expose-gc` の fresh child process を case ごとに5回
- 表は5回の median

Case construction:

- ASCII text: `{ mode: "byte", data: "A".repeat(47_216) }`
- binary: `{ mode: "byte", data: new Uint8Array(47_216) }`
- astral text: `{ mode: "byte", data: "😀".repeat(737 * 16) }`
- many segments: 13,000個の 1-byte `Uint8Array` byte segments
- mixed: numeric `"1234567890"`、alphanumeric `"HELLO123"`、
  byte `"é😀Z"`、kanji `"漢字"` の 4 segments を1,450回

Input 構築後に GC した heap を before とし、public API を実行しました。
`retained splitUnits` は、生成後に matrix と他 summary を保持せず、
`splitUnits` と最小 holder だけを残して GC した差分です。これは V8上の再現可能な
retained-heap baseline であり、object 単体の厳密な byte size や性能 SLA では
ありません。

Full detail materialization だけの CPU 時間は、runtime instrumentation なしでは
generation 全体から分離できません。この docs-only goal では runtime を変更せず、
total generation、`JSON.stringify(splitUnits)`、full diagnostics JSON、
`structuredClone()` を別々に測りました。測定 script は
`/private/tmp/specqr-v3-splitunits-benchmark.mjs` で実行し、repository には
追加していません。

### Results

| Case | Segments | Symbols | Units / objects | Total generation | Full result heap delta | Retained `splitUnits` | Full diagnostics JSON |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 large ASCII text byte segment | 1 | 16 | 47,216 | 74.45 ms | 8,546,096 B | 4,369,744 B | 4,941,373 B |
| 1 large binary byte segment | 1 | 16 | 47,216 | 62.43 ms | 8,442,144 B | 4,261,936 B | 4,941,373 B |
| 1 astral text byte segment | 1 | 16 | 11,792 | 82.04 ms | 5,678,776 B | 1,510,096 B | 1,230,174 B |
| 13,000 one-byte segments | 13,000 | 16 | 13,000 | 104.54 ms | 5,504,696 B | 1,324,784 B | 1,348,769 B |
| numeric/alphanumeric/byte/kanji mix | 5,800 | 15 | 8,700 | 111.39 ms | 5,746,688 B | 1,828,288 B | 926,731 B |

最大 byte case では 1 array と 47,216 entry objects を返します。
`JSON.stringify(splitUnits)` は 4,935,461 bytes、median 3.39 ms
（text）/ 3.16 ms（binary）でした。Full diagnostics 全体は median
4.79 / 4.81 ms、`structuredClone()` は median 24.24 / 24.96 ms でした。

Astral text は 1 code point が 4 UTF-8 bytes なので、47,168 payload bytes に対して
11,792 units です。Mixed case の最初は atomic numeric entry、最後は atomic
kanji entry であり、mode による unit 粒度の違いも測定に含みます。

数値は環境依存ですが、次は環境に依存しない v2 baseline contract です。

- object count は `splitUnits.length` と等しい
- array count は 1
- allocation/serialization complexity は O(split unit count)
- `diagnostics:false` でも同じ array を生成する

## Alternatives

### A. 現行 eager required array を維持

- Memory: 常に O(unit count)
- Calculation: 1回
- JSON / clone: 自然だが常に full cost
- TypeScript: 最も単純
- Compatibility: v2 と完全互換

不採用です。Standard diagnostics を選べず、internal memory hardening 後も
4 MiB 超の public retained cost が残ります。

### B. Standard では省略、full detail だけ eager opt-in

- Memory: standard は O(1) count fields、full は現行 O(unit count)
- Calculation: standard は materialization 0回、full は成功後1回
- Sync / determinism: plain eager data だけなので現行と同じ
- JSON / structured clone: standard/full の見た目が明確
- Freeze: getter state や memoization を持たない
- Node/browser: 同一挙動
- TypeScript: discriminant で安全に narrow 可能
- Debug: count で規模を確認し、必要時だけ full を要求できる
- Compatibility: default から required property を除くため major が必要

**採用します。**

### C. Lazy getter / Proxy / iterator

不採用です。

- enumerable getter は `JSON.stringify()`、object spread、inspection で暗黙に
  full materialization する。
- non-enumerable getter は JSON contract を変え、property discovery も不自然。
- getter memoization は `Object.freeze()` 前後、再定義、access 時 error の扱いを
  複雑にする。
- Proxy は `structuredClone()` で plain data として扱えず、runtime 差も増える。
- Iterator は JSON に出ず、one-shot/reusable、再計算、途中 error、並行 iteration を
  新たに定義する必要がある。
- Access 時に split planning context を保持すると、standard result も source を
  retain し、期待した memory 削減を損なう。

Lazy で「普段は軽い」を実現できても、serialization、clone、freeze、debugger の
自然な意味を同時には保てません。明示的な eager full の方が予測可能です。

### D. Separate inspection API

初期 v3 では不採用です。`inspectStructuredAppendSplitUnits()` のような API は、
元 input/options から split selection を再実行して drift するか、public plan token を
新設して lifetime/mutation contract を定義する必要があります。将来、生成せず
inspection だけを行う明確な需要が出た場合に別設計とします。

### E. Segment 単位へ集約した summary

一部採用します。初期 v3 では安価で一意な `splitUnitCount` だけを standard へ
追加します。Segment 単位の aggregate array は、多数 segment で O(segment count)に
なり、byte chunk 境界や global offsets をどこまで含めるかも新しい contract です。
必要性が確認できるまで追加しません。

## Adopted v3 contract

### Option normalization

`generateSegmentsStructuredAppend()` と対応する `QRCode` static method だけが
object form を所有します。

| Input | Split detail | Symbol result |
| --- | --- | --- |
| omitted / `false` | `"summary"` | requested `output` |
| `true` | `"summary"` | `QRCodeDiagnosticResult` |
| `{}` | `"summary"` | `QRCodeDiagnosticResult` |
| `{ splitUnits: "summary" }` | `"summary"` | `QRCodeDiagnosticResult` |
| `{ splitUnits: "full" }` | `"full"` | `QRCodeDiagnosticResult` |
| `{ splitUnits: "full", symbolResults: "output" }` | `"full"` | requested `output` |
| `{ splitUnits: "summary", symbolResults: "output" }` | `"summary"` | requested `output` |

Object form の defaults:

```ts
{
  splitUnits: "summary",
  symbolResults: "diagnostics"
}
```

Optional property を明示的に `undefined` へした場合も、property 省略と同じ default を
使います。これは declaration の optional property semantics と runtime を一致させる
ためです。

`STRUCTURED_APPEND_DECODER_SUPPORT_VARIES` warning は、
`symbolResults: "diagnostics"` のときだけ現行 `diagnostics:true` と同様に返します。
`symbolResults: "output"` では現行 `diagnostics:false` と同じ warning 順序を
維持します。

`generateStructuredAppend()`、base generation、Planning、Node/browser
helpers はこの object form を所有しません。Top-level unknown option policy や
全 API の strict option validation は別の v3 decision です。

### Standard and full shapes

```ts
export interface QRStructuredAppendSegmentsSummaryDiagnosticsBase {
  version: Version;
  errorCorrectionLevel: ErrorCorrectionLevel;
  versionSelection: "fixed" | "auto-minimum";
  versionSelectionReason: string;
  total: number;
  parity: number;
  byteLength: number;
  inputLength: number;
  segmentCount: number;
  maxSymbols: number;
  splitStrategy: "segment-boundary-byte-chunk";
  splitUnitCount: number;
  symbols: QRStructuredAppendSegmentsSymbolDiagnostics[];
  warnings: QRWarning[];
}

export interface QRStructuredAppendSegmentsStandardDiagnostics
  extends QRStructuredAppendSegmentsSummaryDiagnosticsBase {
  splitUnitsDetail: "summary";
}

export interface QRStructuredAppendSegmentsFullDiagnostics
  extends QRStructuredAppendSegmentsSummaryDiagnosticsBase {
  splitUnitsDetail: "full";
  splitUnits: QRStructuredAppendSplitUnitDiagnostics[];
}

export type QRStructuredAppendSegmentsSummaryDiagnostics =
  | QRStructuredAppendSegmentsStandardDiagnostics
  | QRStructuredAppendSegmentsFullDiagnostics;
```

`splitUnitCount` は、現在の compact split source が保持する logical unit count です。
Full shape では常に `splitUnitCount === splitUnits.length` です。Count 取得は
既存 descriptor/index construction の結果を読むだけで、per-unit object allocation を
行いません。

Standard shape には `splitUnits` own property を**作りません**。
`undefined` value も空配列も返しません。

- `undefined`: 未計算、非対応、明示省略を区別できず、JSON では消える
- `[]`: unit count が 0 であるという誤った意味になる
- absent: `splitUnitsDetail` と `Object.hasOwn()`、JSON、TypeScript が一致する

Full array と entry は v2 と同じ mutable plain data です。Readonly 化や freeze は
この変更に混ぜません。

### Result generic and inference

```ts
export interface QRStructuredAppendSegmentsResult<
  TSymbol = QRGenerateResult,
  TDiagnostics extends
    QRStructuredAppendSegmentsSummaryDiagnostics =
      QRStructuredAppendSegmentsSummaryDiagnostics
> {
  symbols: TSymbol[];
  total: number;
  parity: number;
  inputLength: number;
  byteLength: number;
  diagnostics: TDiagnostics;
}
```

Required inference:

```ts
const standard = generateSegmentsStructuredAppend(segments, {
  diagnostics: true
});
// symbols: QRCodeDiagnosticResult[]
// diagnostics: QRStructuredAppendSegmentsStandardDiagnostics

const full = generateSegmentsStructuredAppend(segments, {
  diagnostics: { splitUnits: "full" }
});
// symbols: QRCodeDiagnosticResult[]
// diagnostics: QRStructuredAppendSegmentsFullDiagnostics

const fullPng = generateSegmentsStructuredAppend(segments, {
  output: "png",
  diagnostics: {
    splitUnits: "full",
    symbolResults: "output"
  }
});
// symbols: Uint8Array[]
// diagnostics: QRStructuredAppendSegmentsFullDiagnostics

declare const dynamic: QRStructuredAppendSegmentsGenerateOptions;
const result = generateSegmentsStructuredAppend(segments, dynamic);
// symbols: QRGenerateResult[]
// diagnostics:
//   QRStructuredAppendSegmentsStandardDiagnostics |
//   QRStructuredAppendSegmentsFullDiagnostics

if (result.diagnostics.splitUnitsDetail === "full") {
  result.diagnostics.splitUnits; // safe
}
```

Named export と static method に同じ overload を置き、最後に dynamic options を
受ける catch-all を残します。Literal output、`symbolResults`、`splitUnits` の
3軸を精密化し、`QRCodeOptions` 相当の dynamic value を拒否しません。

### Error policy

Object form は新しい v3 schema として最初から strict にします。

- `diagnostics`: boolean、non-null non-array object だけ
- `splitUnits`: `"summary"` または `"full"` だけ
- `symbolResults`: `"output"` または `"diagnostics"` だけ
- object 内の unknown own key: reject
- inherited key:参照しない

Error は既存 `InvalidInputError` / `code: "INVALID_INPUT"` を使います。提案する
message pattern:

```text
generateSegmentsStructuredAppend diagnostics must be a boolean or an object
diagnostics.splitUnits must be "summary" or "full"; got <value>
diagnostics.symbolResults must be "output" or "diagnostics"; got <value>
Unsupported generateSegmentsStructuredAppend diagnostics option: <key>
```

Top-level unknown option の扱いを同時に strict 化しません。新しい nested object に
互換 history がないため、その schema だけを strict にできます。

### Runtime pseudocode

```js
const detail = normalizeSegmentsDiagnosticsOption(options.diagnostics);
const inputInfo = createStructuredAppendSegmentsInputInfo(...);
const selected = selectStructuredAppendSegmentsSplit(...);
const symbols = buildEachSelectedSymbolOnce(...);

const diagnostics = {
  ...createCompactSummary(...),
  splitUnitCount: inputInfo.splitUnitCount,
  splitUnitsDetail: detail.splitUnits,
  ...(detail.splitUnits === "full"
    ? { splitUnits: inputInfo.materializeSplitUnits() }
    : {})
};
```

Invariants:

- Standard path は `materializeSplitUnits()` を呼ばない。
- Standard result は full array や、後から full を作るための hidden source を
  retain しない。
- Full path は成功後に一度だけ materialize する。
- Full `splitUnits` の deep equality、entry/property order、offset、mode、array
  order は v2 fixture と一致する。
- Split selection、symbol build、output、parity、summary、warnings は detail
  selection から独立する。

## Serialization and runtime matrix

| Operation | Standard | Full |
| --- | --- | --- |
| `JSON.stringify()` | count/discriminant だけ。`splitUnits` key なし | v2 array 全体を deterministic order で出力 |
| `structuredClone()` | plain data として成功 | plain data として成功し、全 array を複製 |
| `Object.freeze(result.diagnostics)` | shallow freeze。hidden lazy state なし | shallow freeze。nested array は現行どおり mutable |
| Node | 同一 plain object contract | 同一 plain object contract |
| Browser | 同一 plain object contract | 同一 plain object contract |
| TypeScript | `"summary"` branch に array なし | `"full"` branch で array 必須 |

Visual output、scanner behavior、ZXing metadata lane はこの selection に依存しません。

## Migration

### v2 default から v3 standard

Split units を読んでいない consumer は option 変更不要です。

```js
const set = generateSegmentsStructuredAppend(segments, {
  output: "png"
});

console.log(set.diagnostics.splitUnitCount);
```

### v2 `diagnostics:true` で full detail を使う consumer

```js
// v2
const set = generateSegmentsStructuredAppend(segments, {
  diagnostics: true
});
console.log(set.diagnostics.splitUnits);

// v3
const set = generateSegmentsStructuredAppend(segments, {
  diagnostics: { splitUnits: "full" }
});
console.log(set.diagnostics.splitUnits);
```

### Requested output と full detail を併用する consumer

```js
// v2: diagnostics:falseでもfull arrayが付属
const set = generateSegmentsStructuredAppend(segments, {
  output: "png",
  diagnostics: false
});

// v3
const set = generateSegmentsStructuredAppend(segments, {
  output: "png",
  diagnostics: {
    splitUnits: "full",
    symbolResults: "output"
  }
});
```

Codemod は不要です。`diagnostics: true` または `false` を nested object へ置換する
局所的な変更です。ただし `splitUnits` を暗黙に読む consumer には breaking なので、
minor release では実装しません。

v2 runtime に deprecation warning は追加しません。Warning order と diagnostics JSON
自体が public behavior であり、v3 candidate では nested option schema と return
shape の breaking change だけを隔離するためです。
README/release notes で major migration として告知します。

## Compatibility matrix

| Contract | v3 standard | v3 full |
| --- | --- | --- |
| Split positions | unchanged | unchanged |
| Parity / totals | unchanged | unchanged |
| Per-symbol diagnostics | unchanged | unchanged |
| Output bytes / matrix | unchanged | unchanged |
| Warning order | boolean-equivalent behavior | `symbolResults` に対応する boolean-equivalent behavior |
| `splitUnits` property | absent | present |
| `splitUnits` contents/order | not materialized | deep-equal to v2 |
| Full mutability | n/a | same as v2 |
| JSON size | compact | v2 array cost + new count/discriminant |
| Dynamic TypeScript options | safe union | safe union |

## Release and rollback conditions

v3 implementation を stable へ入れる条件:

1. v2 characterization fixture と full result の `splitUnits` が deep-equal。
2. Standard path で `materializeSplitUnits()` が0回であることを focused test で固定。
3. Standard/full で matrix、SVG/PNG、split positions、parity、symbol diagnostics、
   warnings が一致。
4. Literal/static/dynamic overload を consumer type tests と packed tarball で確認。
5. `JSON.stringify()`、`structuredClone()`、property presence を Node と browser E2E で
   確認。
6. Version 40-L / 16-symbol case で standard retained heap が full より明確に小さい。
   硬い RSS/time SLA は置かない。
7. Existing unit、golden、Nayuki 1280、deterministic conformance、
   resource/Structured Append memory、browser E2E、ZXing Java lane が green。

Stable 前の RC で full compatibility、type narrowing、serialization のいずれかが
満たせない場合は、v3 stable からこの変更を外し、現行 eager contract を維持します。
Stable 公開後に standard へ `splitUnits` を黙って戻すことは、JSON/property presence
contract を再び変えるため patch rollback にはしません。

## Implementation evidence

2026-07-31 の v3 candidate は次を満たします。

- standard summary assembly は `materializeSplitUnits()` を呼ばない。Focused test は
  materializer が呼ばれた瞬間に throw する fake source を使い、呼出し0回を
  deterministic に確認する。
- full opt-in は既存 golden fixture 3件と memory characterization で、v2 の
  `splitUnits` array、entry property order、split offsets、parity、symbol
  diagnostics、matrix/output hash と一致する。
- full summary 全体には v3 で必須の `splitUnitCount` と `splitUnitsDetail` が加わる。
  そのため summary 全体の JSON/hash を v2 と byte-for-byte 同一にはできない。
  Characterization ではこの 2 field を除いた v2 projection hash を固定し、
  `JSON.stringify(splitUnits)` 自体は v2 fixture と完全一致させる。これは本書の
  serialization contract「v2 array cost + new count/discriminant」と一致する。
- Node unit、installed tarball、Chromium / Firefox / WebKit で
  `Object.hasOwn()`、`Object.keys()`、`JSON.stringify()`、
  `structuredClone()`、full array の mutability と fresh-call isolation を確認する。
- Named export / `QRCode` static method の literal/full/output inference と dynamic
  union は source consumer および installed tarball consumer で compile する。
- Bounded/extended deterministic conformance は standard/full、
  output/diagnostic symbols の matrix・summary invariant を同じ seed で確認する。

Version 40-L、16 symbols、47,216-byte manual byte segment を fresh child で各5回
測定した candidate baseline は次です。Node/V8/CPU load 依存であり、性能 SLA では
ありません。

| Mode | Generation median | Retained heap delta median | Diagnostics JSON |
| --- | ---: | ---: | ---: |
| standard | 85.64 ms | 4,648,608 B | 5,950 B |
| full | 86.12 ms | 8,436,776 B | 4,941,422 B |

Standard は 32 MiB old-space child でも成功し、`splitUnitCount: 47_216`、
`splitUnits` materialization 0、full と同じ matrix hash
`c988d784ba06d4b3b06fefca9325d1c5f16bbf53952d8d700193747bef3f7bc0`
を返しました。

## Non-goals

- Structured Append split strategy、maxSymbols、capacity policy の変更
- `diagnostics.symbols`、per-symbol offsets、parity、warnings の再設計
- Lazy getter、Proxy、iterator、inspection API の追加
- Full array の readonly 化、freeze、field 削除
- Base API 全体の `diagnostics` object 化
- Unknown top-level option rejection
- GS1 metadata readonly decision
- QR decoder/scanner integration、new QR family、renderer 変更

## Next release step

次の Codex へ渡す goal 概要:

> Review the canonical SpecQR 3.0.0-rc.1 tarball and its content manifest,
> rerun all release gates against that exact artifact, then publish only to
> the npm `next` tag after explicit human approval. Verify
> `specqr@3.0.0-rc.1` and `specqr@next` resolve to the same version before
> creating a tag or GitHub Release. Do not combine unknown-option rejection,
> GS1 readonly changes, new QR families, or additional diagnostics redesign
> with RC 1.

変更対象の想定:

- npm `next` publish 後の registry smoke
- RC tag / GitHub Release
- 必要な場合だけ RC evidence に対応する Pages deploy

Acceptance:

- Canonical tarball hash と manifest が review 済み。
- `specqr@3.0.0-rc.1` と `specqr@next` が exact version へ解決する。
- Published root/node/browser runtime、types、standard/full contract が green。
- Other v3 candidates は未実装のまま分離される。
