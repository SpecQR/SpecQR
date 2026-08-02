# Resource Safety / Correctness Hardening

この文書は、renderer allocation、過大 input、Structured Append parity / generation、planning warnings に対する決定的な防御方針を記録します。OS や JavaScript engine の allocation probe には依存せず、同じ input/options は対応 runtime で同じ境界判定になります。

## Renderer Budget

すべての描画 path は、allocation、canvas dimension 変更、SVG path / Data URL の構築前に checked arithmetic を通ります。共通式は次のとおりです。

```text
moduleSpan = matrixSize + 2 * margin
dimension = moduleSpan * scale
pixelCount = dimension * dimension
rgbaBytes = pixelCount * 4
pngRowBytes = dimension * 4 + 1
pngRawBytes = pngRowBytes * dimension
```

`moduleSpan`、`dimension`、各積・和は non-negative safe integer でなければなりません。出力別の deterministic budget は次のとおりです。

| Metric | Limit | 対象と根拠 |
| --- | ---: | --- |
| Raster pixels | 4,194,304 (2048²) | PNG、canvas、ImageData。Version 40、margin 4、default scale 8 の 1480² pixels を含み、cross-runtime の巨大 surface を避ける |
| RGBA bytes | 16,777,216 (16 MiB) | Canvas / ImageData と PNG raster の画素領域 |
| PNG raw scanline bytes | 17,825,792 (17 MiB) | RGBA に各 scanline の filter byte を加えた現行 encoder buffer |
| PNG zlib stream bytes | 18,874,368 (18 MiB) | stored-deflate block overhead を含む事前上限 |
| SVG source characters | 8,388,608 (8 MiB) | dark module 数、coordinate digits、escaped color の保守的事前見積もり |
| PNG / SVG Data URL characters | 33,554,432 (32 MiB) | Base64 または percent encoding の保守的事前見積もり |

Budget 超過、`Infinity`、unsafe integer は、既存の `InvalidInputError` (`code: "INVALID_INPUT"`) で失敗します。message は次のいずれかで始まります。

```text
Render geometry for <output> is not a non-negative safe integer:
Render geometry for <output> exceeds the deterministic budget:
```

この policy は SVG / SVG Data URL、PNG / PNG Data URL、canvas、`specqr/browser` の Blob / Object URL / ImageData、`specqr/node` の PNG Buffer / file helper に適用されます。`output: "matrix"` は raster/vector allocation を行わないため、この描画 budget の対象外です。`diagnostics: true` は SVG を返す既存 contract のため、SVG budget の対象です。

## Oversized Input Preflight

single-symbol generation は、選択可能な最大 Version と requested ECC の capacity に対し、収容不能を証明できる lower bound を optimizer / Version iteration より前に計算します。

- binary と explicit numeric / alphanumeric / byte / Kanji mode は payload と character-count/control overhead を exact に数えます。
- auto text は、全 data mode で下回れない numeric density (3 characters / 10 bits) と最小 character-count indicator を lower bound にします。
- ECI、FNC1 first / second、low-level Structured Append header の bit overhead を加えます。
- lower bound が capacity 以下なら従来 planner に委ねます。したがって preflight は fit し得る input を reject しません。
- 収容不能時の generation は既存 `DataTooLongError`、planning API は既存 `{ ok: false, reason: "data-too-long" }` です。

Overflow planning では、lower bound で failure が確定している場合に expensive auto-segmentation DP を再実行しません。Version 9/10・26/27、UTF-8、Kanji、binary、manual segments、ECI overhead の exact-fit / max+1 は unit test で固定します。

### AUD-05 overflow warning

`ok: false` かつ `remainingBits < 0` の planning result は、成功時専用の
`CAPACITY_NEAR_LIMIT` を返しません。その warning だけを根拠にした `SCAN_RISK` も
生成しません。成功し、`remainingBits >= 0` の near-limit result は従来どおり
warning を返します。

この条件は `src/diagnostics.js` の `remainingBits >= 0` guard、
`tests/resource-safety.test.js` の fixed / ranged / manual overflow と successful
near-limit case、`tools/verify-resource-safety.js` の 20,000-character low-heap
planning case で固定しています。

公開済み 2.4.0 は overflow result に `CAPACITY_NEAR_LIMIT` を付けていました。
3.0.0-rc.1 では AUD-05 修正済みであり、3.0.0-rc.2 は runtime を変更せず、この
observable correctness change の release claim を訂正します。

## Structured Append

`calculateStructuredAppendSegmentsParity()` は normalized segments を順次走査し、canonical logical message byte length と XOR parity を更新します。全 canonical bytes や split units は作らず、parity 集計の追加 memory は O(1) です。

- numeric / alphanumeric: ASCII bytes
- byte string / Kanji string: original JavaScript string の UTF-8 bytes
- byte binary: raw bytes。`ArrayBufferView` の offset / length を尊重
- control segments: 従来どおり reject

`generateStructuredAppend()` と `generateSegmentsStructuredAppend()` は、選択後の各 symbol について plan、data/ECC codewords、matrix を一度だけ構築します。同じ artifact から requested output と summary diagnostics を作り、diagnostics 無効時に内部 SVG を生成しません。

高レベル分割は、raw/manual payload 全体が最大 16 symbols にも収容不能な場合を
split-unit materialization 前に reject します。Binary view、sparse text index、
manual segment descriptor による compact source と公開 diagnostics の memory 下限は
[Structured Append Memory Hardening](./structured-append-memory.md) に記録します。

## Deterministic Gate

```sh
npm test
npm run verify:resource-safety
npm run verify:structured-append:memory
```

`verify:resource-safety` は 32 MiB V8 old-space limit の child process で、20,000-character auto input の generation/planning failure と 150,000-byte manual parity を実行します。RSS の固定閾値や処理時間を pass/fail に使わず、明示的 error/result と正しい parity を判定します。Renderer は allocation を試さず preflight error を確認します。

`verify:structured-append:memory` は同じ 32 MiB old-space policy で、150,000-byte
raw binary / ASCII / manual byte input の早期 `DataTooLongError` と、
4,304-byte / 16-symbol raw/manual success を確認します。

single-pass の根拠は `tests/resource-safety.test.js` で `BitBuffer.toBytes()` の呼び出し回数が final symbol 数と一致すること、matrix output が危険な SVG geometry でも unused SVG を作らないことです。

## Baseline

2026-07-30、Darwin arm64、Node.js 25.9.0 で同じ process・3回 median を用いて修正前後を測定しました。これは性能 SLA ではなく、再現手順と相対的な退行検知の参考値です。

| Case | Before | After |
| --- | ---: | ---: |
| auto text 20,000 chars generation | 391.67 ms、RSS +215,728,128 bytes | 0.27 ms、RSS +16,384 bytes |
| auto text 20,000 chars planning | DP path | 2.00 ms、RSS +770,048 bytes |
| manual parity 150,000 bytes | raw `RangeError` | 2.83 ms、parity success |
| Structured Append 20,000 byte / 16 symbols / diagnostics off | 472.81 ms | 245.74 ms |
| Structured Append 20,000 byte / 16 symbols / diagnostics on | 300.83 ms | 213.13 ms |

Benchmark の再実行時は warm-up、GC、CPU load により値が変わります。正しさの gate は時間/RSS ではなく、checked preflight、低 heap child、single-pass call count、golden/Nayuki/fuzzing equivalence です。

## Non-Goals

- 呼び出し側がすでに保持している巨大 JavaScript string / array 自体の memory を制限するものではありません。
- OS/engine 固有の最大 canvas や全 browser の実メモリ容量を保証しません。共通 budget より小さい platform limit は残り得ます。
- High-level Structured Append の内部 split-unit 全量 materialization は後続 hardening で
  compact/virtual source へ変更済みです。v3 candidate では manual standard
  diagnostics も O(1) count fields だけを返し、O(unit count)の public
  `splitUnits` は full opt-in 時だけ生成します。
- Auto optimizer 全体の architecture、PNG encoder の圧縮方式は変更しません。
- Budget override public option は追加しません。
