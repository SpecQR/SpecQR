# Repository-wide Correctness and Contract Audit

## 監査対象

| 項目 | 値 |
| --- | --- |
| 監査日 | 2026-07-30 |
| Repository | `SpecQR/SpecQR` |
| Checkout | `/Users/kifu/SpecQR` |
| Commit | `18da5bc1e2ca1cb7d4249b0c886fb0b88f643ee9` (`docs: link SpecQR Conformance Lab`) |
| Branch | `main` |
| Local `origin/main` | `18da5bc1e2ca1cb7d4249b0c886fb0b88f643ee9` |
| Remote `origin/main` | 開始時の確認では同一。監査後半の再照会は一時的な DNS failure で再取得不能 |
| Checkout 差分 | 開始時は staged / working tree / `origin/main` との差分なし |
| Package | `specqr@2.4.0` |
| Runtime policy | ESM-first、Node.js `>=18`、runtime dependency 0 |
| 実行環境 | macOS 27.0 arm64、Node.js 25.9.0、npm 11.12.1 |
| GitHub | `SpecQR/SpecQR` の default branch は `main`。HEAD の CI run `26817041221` は success |

この監査では roadmap や設計文書を実装済みの根拠にはしていません。`src`、型定義、tests、fixtures、tools、examples、playground、workflows、実際の tarball を相互照合し、文書の記述は「claim」、継続実行される test / tool / CI は「evidence」として分けました。ISO/IEC 18004:2024 や GS1 の制限付き仕様本文は転載せず、repository 内の実装、公開資料に依存しない参照比較、実デコード結果から確認できる範囲だけを評価しています。

## 総合評価

通常 QR Code Model 2 の matrix construction は強い状態です。193 unit tests、15 golden fixtures、12 decode fixtures、jsQR / macOS Vision、Nayuki 6 fixed-condition cases が継続 gate にあり、今回の非永続 probe でも Version 1 / 7 / 10 / 26 / 27 / 40、ECC L/M/Q/H、mask 0..7 の 192 matrix が Nayuki と完全一致しました。

一方、次の大規模機能や内部 refactor に入る前に閉じるべき問題があります。特に renderer の無制限 allocation、manual Structured Append parity の stack overflow、過大 auto input の memory amplification は resource safety の実証済みリスクです。TypeScript overload と DOM canvas 型には、runtime では有効な利用を consumer compiler が拒否する contract mismatch があります。browser playground / ImageData / Object URL は source smoke に留まり、現在の core release gate では実ブラウザ動作を保証していません。

判定は **core encoding / matrix は release-quality に近いが、repository 全体の public contract と resource safety は hardening 前** です。新機能追加より先に、conformance/fuzzing gate を固定し、その直後に resource safety を修正するのが妥当です。

### Finding 集計

| 重要度 | 件数 |
| --- | ---: |
| High | 2 |
| Medium | 10 |
| Low | 3 |
| 合計 | 15 |

| 分類 | 件数 |
| --- | ---: |
| confirmed defect | 4 |
| contract mismatch | 6 |
| untested risk | 4 |
| maintainability risk | 1 |

## Public API Inventory

### Package exports

`package.json` が公開する subpath は次の 3 つだけです。

| Import | Runtime | Types | Public exports |
| --- | --- | --- | --- |
| `specqr` | `src/index.js` | `src/index.d.ts` | 42 named exports |
| `specqr/node` | `src/node.js` | `src/node.d.ts` | 4 named exports |
| `specqr/browser` | `src/browser.js` | `src/browser.d.ts` | 6 named exports |

CommonJS、minified browser build、`package.json` subpath、内部 `src/gs1.js` 等は export map にありません。

### Root named exports

**Generation / planning / Structured Append (12)**

- `QRCode`
- `generate`
- `generateSegments`
- `drawToCanvas`
- `estimate`
- `analyzeSegments`
- `getCapacity`
- `generateStructuredAppend`
- `generateSegmentsStructuredAppend`
- `calculateStructuredAppendParity`
- `calculateStructuredAppendSegmentsParity`
- `mergeStructuredAppendParts`

**GS1 / Digital Link (20)**

- `GS1_FNC1_SEPARATOR`
- `createGs1ElementString`
- `parseGs1HumanReadable`
- `parseGs1ElementString`
- `getSupportedGs1Ais`
- `getGs1AiInfo`
- `validateGs1Elements`
- `validateGs1ElementString`
- `createGs1DigitalLink`
- `parseGs1DigitalLink`
- `validateGs1DigitalLink`
- `normalizeGs1DigitalLink`
- `calculateGs1CheckDigit`
- `validateGs1CheckDigit`
- `calculateGtinCheckDigit`
- `appendGtinCheckDigit`
- `validateGtinCheckDigit`
- `calculateSsccCheckDigit`
- `appendSsccCheckDigit`
- `validateSsccCheckDigit`

**Errors (10)**

- `SpecQRError`
- `DataTooLongError`
- `InvalidInputError`
- `InvalidVersionError`
- `InvalidModeError`
- `InvalidColorError`
- `InvalidEciError`
- `InvalidGs1Error`
- `InvalidOutputError`
- `InvalidCanvasTargetError`

`QRCode` は、上記の generation / planning / Structured Append 関数 11 個と、separator constant を除く GS1 関数 19 個を static method として mirror します。static method は合計 30 個です。

### Node and browser subpaths

`specqr/node`:

- `toPngBuffer`
- `toPngBufferFromSegments`
- `writePngFile`
- `writePngFileFromSegments`

`specqr/browser`:

- `toBlob`
- `toBlobFromSegments`
- `toImageData`
- `toImageDataFromSegments`
- `toObjectURL`
- `toObjectURLFromSegments`

### Input and output contract

- `QRInput`: JavaScript `string`、`Uint8Array`、`ArrayBuffer`、任意 `ArrayBufferView`、readonly byte array。
- `QRSegmentInput`: `structured-append`、`fnc1`、`fnc1-second`、`eci`、`numeric`、`alphanumeric`、`byte`、`kanji`。
- `output`: `matrix`、`svg`、`svg-data-url`、`png`、`png-data-url`。
- `diagnostics: false`: output ごとの raw value を返す。matrix は `boolean[][]`、PNG は `Uint8Array`、他は string。
- `diagnostics: true`: output 指定にかかわらず `{ matrix, svg, diagnostics }` を返す。現在の実装は SVG も必ず構築する。
- `generateStructuredAppend()` と `generateSegmentsStructuredAppend()` は、symbol output のほか top-level summary diagnostics を常に返す。`diagnostics: true` のとき各 symbol は `{ matrix, svg, diagnostics }` になる。
- `estimate()` / `analyzeSegments()` は capacity overflow だけを `{ ok: false, reason: "data-too-long" }` として返し、invalid option / invalid input は既存 error class を throw する。
- `getCapacity()` は fixed Version の mode-level capacity を返す。GS1 / Structured Append semantic capacity は含まない。

### Options contract

`QRCodeOptions` は次を型公開しています。

`errorCorrectionLevel`、`version`、`minVersion`、`maxVersion`、`maskPattern`、`mode`、`encoding`、`margin`、`scale`、`foreground`、`background`、`output`、`optimizeSegments`、`boostErrorCorrection`、`eci`、`gs1`、`fnc1Second`、`structuredAppend`、`diagnostics`、`printDpi`。

実装は Version 1..40、mask 0..7、非負 integer margin、1 以上の integer scale、boolean `optimizeSegments` / `boostErrorCorrection`、positive finite `printDpi` を検査します。`diagnostics` 自体の boolean validation と options object validation はありません。`scale` / `margin` に allocation 上限もありません。

### Error and warning contract

Stable error code:

`DATA_TOO_LONG`、`INVALID_INPUT`、`INVALID_VERSION`、`INVALID_MODE`、`INVALID_COLOR`、`INVALID_ECI`、`INVALID_GS1`、`INVALID_OUTPUT`、`INVALID_CANVAS_TARGET`。

Warning code:

`QUIET_ZONE_TOO_SMALL`、`COLOR_CONTRAST_UNKNOWN`、`COLOR_CONTRAST_LOW`、`COLOR_CONTRAST_MODERATE`、`COLOR_ALPHA_USED`、`CAPACITY_NEAR_LIMIT`、`PRINT_MODULE_TOO_SMALL`、`RASTER_SCALE_SMALL`、`SCAN_RISK`、`STRUCTURED_APPEND_MAX_SYMBOLS_NEAR_LIMIT`、`STRUCTURED_APPEND_DECODER_SUPPORT_VARIES`。

GS1 non-throwing validation は別の detail code union を持ち、unsupported AI、length、charset、separator、check digit、Digital Link placement / URI / percent encoding / unknown query / duplicate AI / invalid input を区別します。

### Diagnostics contract

Generation diagnostics は Version / ECC / mask と全 mask penalties、segments / control segments、ECI、FNC1 first / second、Structured Append header、GS1 validation summary、data/capacity/remaining bits、codeword counts、quiet zone、color contrast、print hints、warnings を返します。

Planning diagnostics は `phase: "planning"`、`renderPlanned: false`、`maskEvaluated: false`、`codewordsBuilt: false` を持ち、matrix、mask penalty、codeword stream、renderer output は返しません。成功時は generation diagnostics の planning-compatible fields と一致する設計です。

### GS1 contract

- Public AI metadata は現在 50 AI。全 GS1 AI catalog ではない。
- Human-readable parser は `(01)...` notation を `{ ai, value }[]` にする。
- Raw parser は parentheses-free element string を `{ elements, hasSeparators }` にする。
- Variable-length AI の後に次 element がある場合は ASCII GS (`\x1D`) が必要。final variable value は separator なしを許可する。
- Raw parser は曖昧な suffix を推測分割しない。
- `generate(input, { gs1: true })` は raw element string を内部 validation してから FNC1 first position を付加する。
- Digital Link は通常 URL QR として生成し、`gs1: true` と併用しない。
- Digital Link helper は deterministic builder / parser / validation / normalization であり、resolver、compression、full canonicalizer ではない。

### Structured Append contract

- Low-level public index は 1-based、`total` は 2..16、parity は byte。
- High-level string / binary API は deterministic greedy largest-fitting split、最大 16 symbols、元 payload bytes の XOR parity。
- Manual segments API は segment boundary first。byte segment だけを binary byte / Unicode code point boundary で分割し、numeric / alphanumeric / kanji segment の途中分割はしない。
- Manual parity は QR encoded bitstream ではなく canonical logical bytes の XOR。Kanji は元 JavaScript string の UTF-8 bytes。
- ECI / GS1 / FNC1 first / FNC1 second と high-level Structured Append の併用は現在 reject。
- `mergeStructuredAppendParts()` は decoder が返した metadata 付き parts を検査・結合する helper で、decoder / scanner integration 自体は提供しない。

## Architecture Map

| Layer | 主なファイル | 責務 | 監査所見 |
| --- | --- | --- | --- |
| Public orchestration | `src/index.js` | Public API、plan selection、render dispatch、Structured Append split | 1,535 lines。責務集中と二重生成あり |
| Options / diagnostics | `src/options.js`, `src/diagnostics.js` | Normalization、warnings、planning/generation diagnostics | Minimum validation はあるが resource ceiling と一部 type validation がない |
| Encoding | `src/encoding/modes.js` | UTF-8、mode validation、DP segment optimization、manual segments、bit encoding | Version ごとに optimizer を再実行。過大 input で memory amplification |
| Control segments | `src/encoding/control-segments.js` | ECI、FNC1 first / second、Structured Append header | Unit / golden coverage が厚い |
| Kanji environment | `src/encoding/shift-jis.js` | Shift_JIS mapping、fallback / reject | Platform `TextDecoder("shift_jis")` 依存を docs/tests で明示 |
| Core tables / ECC | `src/core/tables.js`, `galois-field.js`, `reed-solomon.js`, `codewords.js` | Capacity、GF arithmetic、RS、interleave | Unit / golden / reference evidence あり |
| Matrix / masks | `src/core/matrix.js`, `mask.js` | Function patterns、placement、format/version info、mask/penalty | Golden と external exact matrix 比較が強い |
| Renderers | `src/render/*` | SVG、PNG、canvas、color | PNG は stored-deflate、複数 full-size buffer を保持。dimension ceiling なし |
| Runtime helpers | `src/node.js`, `src/browser.js` | File/Buffer、Blob/ImageData/Object URL | Node/Blob は実行確認。real browser ImageData/Object URL は未 gate |
| GS1 | `src/gs1/*` | AI dictionary、parser、validation、check digit、Digital Link | Current 50 AI に限定。catalog scope は明確 |
| Structured Append merge | `src/structured-append.js` | Parity、decoded parts merge | Unit / packed root smoke あり |

## Claim-to-Evidence Matrix

### Core, input, rendering

| Claim | Evidence | 判定 / gap |
| --- | --- | --- |
| Model 2 Version 1..40 | `tests/golden-conformance.test.js`, `tests/version-boundaries.test.js`, `tests/tables.test.js`, Nayuki comparison | 継続 evidence あり |
| ECC L/M/Q/H、RS、interleave | `tests/reed-solomon.test.js`, golden codewords、Nayuki | 継続 evidence あり |
| Numeric / alphanumeric / byte / Kanji | mode/generate/boundary/golden/decode tests | 継続 evidence あり |
| ECI / mixed segments | `tests/eci-mixed-capacity.test.js`, golden、Nayuki、decode fixture | 継続 evidence あり |
| Character-count Version 9/10、26/27 | `tests/version-boundaries.test.js`, Version 10/27 golden | 継続 evidence あり |
| Format/version info、placement、remainder bits | 15 golden fixtures と独立 helper calculation | 継続 evidence あり |
| Mask 0..7 と N1..N4 | `tests/mask-penalty.test.js`, golden、Nayuki | 継続 evidence あり |
| Binary / ArrayBufferView offset | `tests/binary-segments.test.js`, SA tests | 継続 evidence あり |
| Matrix / SVG / PNG | unit、golden、Vision/jsQR | 継続 evidence あり |
| Canvas | `tests/canvas.test.js` の fake structural target | Runtime logic は確認。real DOM TypeScript contract に gap |
| Browser Blob/ImageData/Object URL | Blob unit、export/type source smoke | ImageData / Object URL / actual browser は未検証。`Tested` claim は広すぎる |
| Playground | `pages:build` と source regex smoke | Build artifact の存在だけ。load、interaction、download、console error は未検証 |

### GS1, Digital Link, Structured Append, Planning

| Claim | Evidence | 判定 / gap |
| --- | --- | --- |
| FNC1 first / second | GS1/control/FNC1 tests、golden | 継続 evidence あり |
| Current GS1 parser / validation | 1,527-line `tests/gs1.test.js`、packed root smoke、types | Current 50 AI scope 内で evidence あり |
| Digital Link helper | GS1 tests、examples、packed root smoke | Deterministic policy は確認。resolver/full canonicalization は明示非対応 |
| Structured Append low-level | control/SA tests、golden | 継続 evidence あり |
| High-level and manual split | 1,141-line SA tests、4 dedicated fixtures、examples、packed root smoke | Internal consistency は強い。外部 metadata decode は未継続 |
| Parity / merge | SA tests、examples、packed root smoke | Normal cases は evidence あり。large manual byte segment に confirmed defect |
| Planning API | `tests/planning.test.js`、examples、packed root smoke、types | Success/overflow shape は確認。overflow warning に defect |

### Design document status

| 文書 | 実装との対応 | Evidence / gap |
| --- | --- | --- |
| `docs/gs1-v2-api.md` | Raw parser API 実装済み | GS1 tests、types、pack smoke |
| `docs/gs1-validation-v2.1.md` | Validation/introspection 実装済み | Current catalog のみ。full catalog は非対応 |
| `docs/gs1-digital-link-v2.md` | Builder/parser 実装済み | GS1 tests/examples |
| `docs/gs1-digital-link-validation-v2.2.md` | Validate/normalize 実装済み | GS1 tests、pack smoke。full canonicalizer は非対応 |
| `docs/gs1-supported-ai.md` | 50 public AI metadata と対応 | Dictionary + GS1 tests。外部 catalog completeness claim なし |
| `docs/planning-diagnostics-v2.4.md` | Public API 実装済み | Planning tests/types/examples。overflow warning defect あり |
| `docs/structured-append-v2.md` | High-level split 実装済み | SA tests/fixture/examples |
| `docs/structured-append-segments-v2.md` | Manual split 実装済み | SA tests/3 fixtures |
| `docs/structured-append-parity-v2.3.md` | Raw parity 実装済み | SA tests/pack smoke |
| `docs/structured-append-segments-parity-v2.3.md` | Manual parity 実装済み | Normal tests あり。large byte input で stack overflow |
| `docs/structured-append-scanning-v2.md` | Workflow 文書のみ | Decoder integration は意図的非対応 |
| `docs/structured-append-decoder-validation-v2.md` | Optional ZXing Java prototype | CI では classpath 未設定のため実質常時 skip |
| `docs/reference-comparison.md` | Nayuki fixed comparison | 継続 gate は 6 cases。auto/Kanji/GS1/rendering は非対象 |
| `docs/v2-roadmap.md` | 履歴と将来方針 | Evidence には使用しない |
| `docs/release.md` | Release process | 現在の 2.4.0 公開状態と冒頭記述が不一致 |

## Release Gate Inventory

| Gate / script | 分類 | 環境条件 | 実際に検証するもの |
| --- | --- | --- | --- |
| `npm ci` | required | npm lockfile | Reproducible dev install |
| `npm test` | required CI、Node 18/20/22/24 | Node | 193 unit/golden/contract tests |
| `npm run verify:types` | required CI、Node 18/20/22/24 | TypeScript + DOM lib | Source package consumer declarations |
| `npm run examples:smoke` | required CI、Node 18/20/22/24 | Node | Node examples 実行、browser/playground/TS は source regex/readability |
| `npm run verify:pack` | required CI、Node 18/20/22/24 | npm pack/install | Tarball root runtime smoke + declaration text assertions |
| `npm ls --omit=dev` | required CI、Node 18/20/22/24 | npm | Runtime dependency 0 |
| `npm run pages:build` | required release job | Node | Static copy/build。browser 実行なし |
| `npm run verify:decode` | required macOS release job | Swift Vision + ImageMagick | 12 cases、SVG-rendered PNG と native PNG |
| `npm run verify:decode:jsqr` | required release job | `jsqr` devDependency、ImageMagick は SVG 用 | 12 cases、24 artifacts |
| `npm run verify:reference:nayuki` | required release job | Nayuki devDependency | 6 fixed-condition exact matrices |
| `npm run verify:structured-append:zxing-java` | CI step だが optional execution | `ZXING_CLASSPATH`, Java, javac | SA payload + metadata。条件なしでは success 扱いの skip |
| `npm pack --dry-run` | required release job | npm | Tarball contents |
| `npm run verify:decode:optional` | optional local | jsQR / zbarimg / ZXing CLI discovery | 利用可能 decoder だけ。全 skip でも success |
| `npm run verify:decode:independent` | alias/manual | jsQR | `verify:decode:jsqr` と同じ |
| `npm run verify:published` | manual workflow | npm registry/network | Published package root/node/browser smoke |
| `npm run fixtures:golden` | manual mutation | Maintainer intent | Golden regeneration。通常 gate では実行しない |
| Individual `examples:*` | manual | Node | 各 example |
| `npm run playground` | manual | Local browser | Server 起動のみ |
| Pages workflow | manual `workflow_dispatch` | GitHub Pages | Build/deploy。browser E2E なし |
| Published Package Smoke workflow | manual `workflow_dispatch` | npm registry | Published specs の smoke |

### 今回の gate 結果

| Command | Result |
| --- | --- |
| `npm ci` | pass、5 dev packages installed |
| `npm test` | pass、193/193 |
| `npm run verify:types` | pass |
| `npm run examples:smoke` | pass |
| `npm run pages:build` | pass |
| `npm run verify:decode` | pass、12/12 fixtures |
| `npm run verify:decode:jsqr` | pass、24/24 artifacts |
| `npm run verify:reference:nayuki` | pass、6/6 fixed matrices |
| `npm run verify:pack` | pass、`specqr@2.4.0` local tarball root smoke |
| `npm ls --omit=dev` | pass、runtime dependency 0 |
| `npm pack --dry-run --cache /private/tmp/specqr-npm-cache` | pass、監査文書を含む 89 files、217.3 kB packed、964.6 kB unpacked |
| `npm run verify:decode:optional` | pass。jsQR 24/24、zbarimg/ZXing CLI は未導入で skip |
| `npm run verify:structured-append:zxing-java` | skip success。`ZXING_CLASSPATH` 未設定 |
| Temporary installed-tarball subpath smoke | pass。root/node/browser import、matrix、PNG Buffer、Blob |
| Temporary 192-case Nayuki probe | pass。6 Versions × 4 ECC × 8 masks |
| Playground Playwright probe | 測定不能。repository に browser E2E dependency がなく、CLI 取得は network DNS failure |

GitHub Actions の HEAD push run は success です。ただし CI の ZXing Java step は classpath を provision しないため、workflow が green でも Structured Append metadata decode が実行されたことは意味しません。

## Conformance Lab との責務分界

`SpecQR/SpecQR-Conformance-Lab` repository の存在は GitHub metadata で確認しましたが、この監査では checkout や report implementation を変更・評価していません。

Core repository が所有するもの:

- Source-level unit/golden tests
- Fixed-condition reference comparison
- Source checkout と local tarball の API/types/package gates
- macOS Vision / jsQR decode fixtures
- Public scope、known limitations、release checklist

Conformance Lab が担うと docs が宣言しているもの:

- Published npm package を外部 consumer として検証する report
- jsQR readability、Nayuki comparison、GS1 / Digital Link / Structured Append / Planning helper report
- 外部公開用 badge/report artifact

Core 側に残る gap:

- Lab report は core CI の required check ではない。
- Real browser の playground / ImageData / Object URL / download interaction は core にも required E2E がない。
- `verify:pack` は root runtime だけで、node/browser subpath の installed tarball 実行は manual published smoke に寄っている。
- Structured Append metadata-returning decoder は core CI で実行されていない。
- Lab の成功を core source correctness の代替にはできない。

## Resource / Performance Baseline

測定は同じ checkout、Node.js 25.9.0 arm64 の新規 process で `performance.now()` と `process.memoryUsage()` を使った単発値です。benchmark suite ではなく、再現可能な危険度比較です。RSS delta は allocator / GC の影響を受けます。

### Version 40 single-symbol render

Payload は byte mode 2,900 bytes、Version 40-L fixed。

| Case | Time | Output | RSS delta |
| --- | ---: | ---: | ---: |
| Matrix、diagnostics off | 28.35 ms | 177×177 | 12.9 MB |
| Matrix、diagnostics on | 30.31 ms | matrix + 261,630-byte SVG | 19.7 MB |
| SVG、scale 8 | 30.33 ms | 261,630 bytes | 18.7 MB |
| PNG、scale 1 | 31.79 ms | 137,163 bytes | 18.6 MB |
| PNG、scale 8 | 150.96 ms | 8,763,813 bytes | 75.9 MB |
| PNG、scale 16 | 502.92 ms | 35,052,098 bytes | 239.8 MB |

PNG は filter byte 付き RGBA raw buffer、stored-deflate stream、chunk、final output を複数保持します。圧縮を行わないため output と transient memory はおおむね pixel count に比例します。ImageData も `dimension² × 4` bytes を一括 allocation します。

### Oversized auto segmentation

| Case | Time | RSS delta | Heap delta | Result |
| --- | ---: | ---: | ---: | --- |
| 10,000 lowercase chars、mode auto | 161.05 ms | 87.5 MB | 16.3 MB | `DataTooLongError` |
| 20,000 lowercase chars、mode auto | 329.03 ms | 221.9 MB | 113.4 MB | `DataTooLongError` |
| 20,000 lowercase chars、mode byte | 10.92 ms | 8.1 MB | 5.3 MB | `DataTooLongError` |

Auto plan は Version 1..40 ごとに `optimizeSegmentModes()` を再実行し、各 code point ごとの `Map` layer と backpointer state を作ります。QR に絶対収まらない input でも preflight rejection 前にこの cost を払います。

### Structured Append

20,000 lowercase bytes、byte mode、ECC L、matrix output:

| Case | Time | RSS delta | Result |
| --- | ---: | ---: | --- |
| diagnostics off | 451.33 ms | 44.0 MB | 16 symbols、Version 25 |
| diagnostics on | 359.85 ms | 45.4 MB | 16 symbols、SVG 合計 1,752,345 bytes |

`diagnostics: false` でも各 symbol を diagnostics 用に一度生成し、その後 requested output 用に再生成します。`diagnostics: true` は一度だけですが、全 symbol の SVG を構築します。

Manual byte segment parity:

| Bytes | Result |
| ---: | --- |
| 100,000 | pass、13.94 ms |
| 150,000 | raw `RangeError: Maximum call stack size exceeded` |

原因は `canonicalBytes.push(...segmentBytes)` です。同系統の spread は byte chunk materialization にもあります。

### Extreme dimensions

`generate("A", { scale: Number.MAX_VALUE })`:

- SVG: success 扱いだが width/path に `Infinity` を含む invalid output。
- PNG: raw `RangeError: Invalid typed array length: Infinity`。

### 上限候補

次の goal で値と互換性を決定する必要があります。

1. `dimension` が finite safe integer であることを全 renderer/helper で共通検査する。
2. Raster は max pixels / max RGBA bytes を設け、超過時は stable SpecQR error にする。候補初期値は 4,096² pixels 程度だが、Node/browser 双方の実測と override policy を先に決める。
3. Single-symbol input は QR 理論最大容量を超えることが明白な byte count / code point count を DP 前に reject する。
4. Structured Append は 16 symbols の理論最大を超える input を split-unit materialization 前に reject する。
5. Parity-only helper は全 bytes を配列へ複製せず streaming XOR にする。生成 API と異なり、parity helper 自体には低い任意上限を設けない。
6. SVG は finite coordinate と safe dimension を検査し、必要なら最大 serialized bytes を別に扱う。

## Findings

### AUD-01: Renderer dimension と allocation が無制限

- 分類: confirmed defect
- 重要度: High
- 確信度: High
- 根拠: `src/options.js` の `margin` / `scale` validation、`src/render/svg.js`、`src/render/png.js`、`src/browser.js`
- 再現: `generate("A", { output: "svg", scale: Number.MAX_VALUE })` は `Infinity` を含む。PNG は raw `RangeError`。
- 影響: Invalid SVG、予測不能な exception、browser/server の memory exhaustion。PNG/ImageData/Data URL は特に増幅が大きい。
- 推奨修正: 共通 checked-dimension helper、finite/safe integer、pixel/byte budget、stable error。PNG/Data URL/Node/browser/canvas を同じ policy にする。
- 依存: Public error policy と上限値の決定、renderer regression tests。

### AUD-02: Manual Structured Append parity が valid large byte input で stack overflow

- 分類: confirmed defect
- 重要度: High
- 確信度: High
- 根拠: `src/index.js` `createStructuredAppendSegmentsInputInfo()` の spread push。150,000-byte `Uint8Array` で再現。
- 再現: `calculateStructuredAppendSegmentsParity([{ mode: "byte", bytes: new Uint8Array(150000) }])`。
- 影響: Public type 上有効な input が SpecQR error でなく engine-dependent `RangeError` になる。manual high-level split にも同じ path がある。
- 推奨修正: Streaming XOR、chunked copy または typed-array concat、generation path の early capacity preflight。
- 依存: Large-input regression test、Node 18/20/22/24 thresholds に依存しない実装。

### AUD-03: Oversized auto input が capacity failure 前に大きな memory を消費

- 分類: untested risk
- 重要度: Medium
- 確信度: High
- 根拠: `src/encoding/modes.js` `optimizeSegmentModes()`、`src/index.js` `selectPlan()`、20,000 chars の実測。
- 再現: `generate("a".repeat(20000), { output: "matrix" })` は約 329 ms、RSS +222 MB。`mode: "byte"` は約 11 ms、RSS +8 MB。
- 影響: Untrusted text を受ける service/browser で容易な memory pressure。最終結果は必ず `DataTooLongError` でも cost を先に払う。
- 推奨修正: QR 最大値に基づく cheap preflight、optimizer の rolling state/backpointer 圧縮、Version range 間の計算再利用。
- 依存: Tie-break を含む auto segmentation behavior を先に fuzz/golden で固定。

### AUD-04: Structured Append が diagnostics off で各 symbol を二重生成

- 分類: confirmed defect
- 重要度: Medium
- 確信度: High
- 根拠: `src/index.js` `generateStructuredAppend()` / `generateSegmentsStructuredAppend()` は diagnostics matrix を生成後、requested output を再生成。
- 再現: 20,000-byte/16-symbol probe で diagnostics off 451 ms、on 360 ms。
- 影響: Matrix/codeword/mask/render work の重複。PNG では allocation cost も二重化する。
- 推奨修正: 一度の plan/matrix build から summary diagnostics と requested output を派生させる。
- 依存: Internal pipeline refactor 前に full behavior/golden gate が必要。

### AUD-05: Capacity overflow に `CAPACITY_NEAR_LIMIT` が付く

- 分類: confirmed defect
- 重要度: Medium
- 確信度: High
- 根拠: `src/diagnostics.js` は `remainingBits / capacityBits < 0.05` のみを条件にする。
- 再現: Version 1-H byte 100 chars。`remainingBits: -740`、utilization 11.28 に「close to full capacity」warning。
- 影響: UI/automation が overflow を near-full success と誤解する。warning semantics が機械判定に不適切。
- 推奨修正: `remainingBits >= 0` を条件に加え、overflow result は専用 reason/error だけにする。
- 依存: Planning diagnostics regression test。

### AUD-06: `QRCodeOptions` 変数を `generate()` overload が受け付けない

- 分類: contract mismatch
- 重要度: Medium
- 確信度: High
- 根拠: `src/index.d.ts` の literal-discriminated overload のみ。Temporary consumer probe で TS2769。
- 再現: `const o: QRCodeOptions = { output: cond ? "matrix" : "svg" }; const r: QRGenerateResult = generate("x", o);`
- 影響: Public options type を正しく使う一般的 consumer code が compile しない。static/segments/Structured Append にも同形の risk。
- 推奨修正: Narrow overload の後に `QRCodeOptions -> QRGenerateResult` fallback overload を追加し、全 mirror を揃える。
- 依存: Consumer type tests。Inference precision を維持する順序確認。

### AUD-07: Real DOM canvas が `drawToCanvas()` 型に適合しない

- 分類: contract mismatch
- 重要度: Medium
- 確信度: High
- 根拠: `QRCanvasContextLike.fillStyle` は `string` 固定。DOM `CanvasRenderingContext2D.fillStyle` は `string | CanvasGradient | CanvasPattern`。
- 再現: DOM lib 有効の consumer で実 `HTMLCanvasElement` / `CanvasRenderingContext2D` を渡すと TS2345。
- 影響: Browser 向け public API の代表的利用が runtime 前に拒否される。
- 推奨修正: Setter 用途に適した structural type へ広げ、実 DOM target を consumer type test に追加。
- 依存: Node-only type consumer に DOM を強制しない構成確認。

### AUD-08: Browser helper / playground の `Tested` claim が source smoke を超えている

- 分類: untested risk
- 重要度: Medium
- 確信度: High
- 根拠: `tests/helpers.test.js` は Blob のみ。`tools/verify-examples.js` は browser/playground source を読むだけ。`tools/build-pages.js` は copy のみ。
- 再現: Repository 内に Playwright 等の browser E2E gate なし。今回も CLI 取得不可で browser 実行不能。
- 影響: ImageData、Object URL、download、controls、console/runtime import error、responsive layout が green CI でも壊れ得る。
- 推奨修正: Built Pages artifact を実 browser で load し、single/GS1/Digital Link/SA、Blob/ObjectURL/ImageData、download と console を確認する required smoke を追加。
- 依存: Test-only browser runtime と CI install policy。runtime dependency は増やさない。

### AUD-09: Local pack smoke の docs claim と実検証範囲が不一致

- 分類: contract mismatch
- 重要度: Medium
- 確信度: High
- 根拠: `docs/release.md` は `verify:pack` が `specqr/node` / `specqr/browser` も確認すると記載。`tools/verify-packed-package.js` runtime smoke は root だけ。
- 再現: Script source 参照。今回の manual tarball install では subpath import は成功。
- 影響: package files/exports drift が required prepublish gate を通過し得る。Published smoke は manual で publish 後。
- 推奨修正: Packed smoke に node/browser import と軽い runtime assertion を移す。declaration は regex だけでなく tarball consumer `tsc` を使う。
- 依存: `verify:published` と重複しない責務整理。

### AUD-10: Core options が object/boolean contract を runtime で強制しない

- 分類: contract mismatch
- 重要度: Medium
- 確信度: High
- 根拠: `normalizeOptions()` の object spread と未検査 `diagnostics`。
- 再現: `generate("A", null)`、`generate("A", "x")` は default 生成。`diagnostics: "yes"` は diagnostic result を返す。
- 影響: JavaScript consumer の configuration error が silently accepted され、return shape が truthiness で変わる。SA/getCapacity の strict object validation と不統一。
- 推奨修正: options object と `diagnostics` boolean を stable `InvalidInputError` で検査。
- 依存: Invalid usage の runtime tightening をどの release で行うか決定。

### AUD-11: Structured Append ZXing Java CI step は継続検証になっていない

- 分類: untested risk
- 重要度: Medium
- 確信度: High
- 根拠: Workflow は classpath を provision せず、script は `ZXING_CLASSPATH` 未設定を success skip にする。
- 再現: 今回の実行も skip。CI green だけでは metadata decode 実行を示さない。
- 影響: Sequence indicator / parity metadata の外部 decoder 互換性は internal golden に依存したまま。
- 推奨修正: Optional 表記を維持するなら green badge/gate から明確に分離。継続保証にするなら license を確認した test-only pinned ZXing setup を別 job にする。
- 依存: External artifact licensing、CI download reliability。

### AUD-12: GS1 metadata は runtime readonly だが型は mutable

- 分類: contract mismatch
- 重要度: Low
- 確信度: High
- 根拠: `getSupportedGs1Ais()`、各 info、nested `length` / path arrays を `Object.freeze()`。`GS1AiInfo[]` と fields は readonly でない。
- 再現: Mutation は runtime で TypeError になり得るが TypeScript は許可する。
- 影響: Consumer が合法と判断した mutation が実行時に失敗。
- 推奨修正: `readonly GS1AiInfo[]` と readonly fields/arrays に合わせるか、defensive mutable copy を返す。
- 依存: Public type tightening の互換性判断。

### AUD-13: Release checklist の current-state 記述が公開状態と不一致

- 分類: contract mismatch
- 重要度: Low
- 確信度: High
- 根拠: `docs/release.md` 冒頭は 2.4.0 を「公開準備状態」、tag/publish 未実行と記載。実際は npm latest/next 2.4.0、local `v2.4.0` tag あり。
- 再現: `npm view specqr version dist-tags`、`git show-ref --tags v2.4.0`。
- 影響: Maintainer が release 操作を重複実行する判断材料になり得る。
- 推奨修正: Checklist を evergreen process と current release state に分離する。
- 依存: GitHub Release/Pages の人手確認。

### AUD-14: Public orchestration と fixture tooling の変更影響が集中

- 分類: maintainability risk
- 重要度: Low
- 確信度: Medium
- 根拠: `src/index.js` 1,535 lines が planning、generation、rendering、SA split、diagnostics glue を所有。Golden updater も独自計算を多く持つ。
- 再現: Static inspection。
- 影響: Resource fix や pipeline reuse が広い file を触り、意図しない contract drift を起こしやすい。
- 推奨修正: Conformance/fuzzing と resource fixes 後に、plan/build/render、SA input/split、diagnostics assembly を behavior-preserving に分離。
- 依存: AUD-03/04 の behavior lock。先に refactor しない。

### AUD-15: External exact comparison は代表 6ケースに限定

- 分類: untested risk
- 重要度: Medium
- 確信度: High
- 根拠: `tools/verify-reference-nayuki.js` は 6 fixed cases。Auto segmentation、Kanji、GS1、rendering は明示非対象。
- 再現: Script source。今回の 192-case probe は pass したが、継続 gate には残っていない。
- 影響: Version/ECC/mask table や rare boundary の将来 regression が、golden fixture にない組合せでは独立 oracle なし。
- 推奨修正: Seeded bounded differential harness を CI に追加し、failure seed/case を表示する。Nayuki が扱えない領域は property/golden/decode に分離する。
- 依存: CI 時間 budget、reference implementation の対象範囲。

## 確認済み事実と推測の分離

確認済み:

- 全 required local gates は pass。
- 192 additional fixed matrices は Nayuki と一致。
- Renderer extreme scale、manual parity stack overflow、planning warning、TypeScript 2件は再現済み。
- Browser E2E は repository に存在しない。
- ZXing Java metadata validation はこの環境と現行 CI 設定で skip。

推測ではなく未検証として残すもの:

- ISO/IEC 18004:2024 全文への完全準拠。
- GS1 full catalog / industry-specific rules。
- 全 scanner の FNC1/Structured Append metadata behavior。
- Browser engine 間の ImageData/Object URL/download 互換性。
- 2015版と 2024版の全差分。
- Conformance Lab repository 内部の正確性。この監査では変更・実行していない。

## 後続 Goal

### 1. Conformance / fuzzing

まず、変更前 behavior と独立 oracle 範囲を広げる。AUD-15 を閉じ、AUD-03/04 を安全に直す土台にする。

### 2. Resource safety / performance

AUD-01、AUD-02、AUD-03、AUD-04、AUD-05 を修正する。共通 dimension budget、early capacity preflight、streaming parity、一回 build pipeline を扱う。

### 3. Behavior-preserving refactor

`src/index.js` を plan/build/render、Structured Append preparation/split、diagnostics assembly へ分離する。Public output、matrix、errors、warnings を golden/differential で固定した後に行う。

### 4. API / type precision

AUD-06、AUD-07、AUD-09、AUD-10、AUD-12 を閉じる。General options overload、DOM canvas、readonly metadata、packed subpaths、invalid option policy を揃える。

### 5. GS1 expansion

上記が green になった後、出典・license・metadata version を固定して AI group 単位に拡張する。Full catalog や industry rules を一括導入しない。

## 次に Codex へ渡す Goal

```text
Goal: Add deterministic conformance and fuzzing gates before changing SpecQR runtime behavior.

目的:
repository-wide auditで確認した現行behaviorを、resource safety修正と内部refactorの前に独立oracle/property testsで固定する。新機能は追加しない。

主スコープ:
- Existing nayuki-qr-code-generator devDependencyを使い、seeded fixed-condition differential testを追加する
- Version 1/7/9/10/26/27/40、ECC L/M/Q/H、mask 0..7を必ず含める
- numeric/alphanumeric/byte/binary/ECI/manual mixedで、参照実装とfull matrix exact matchする
- Random casesはseedと最小再現に必要なinput/optionsをfailure outputへ出す
- Auto segmentation、Kanji、GS1/FNC1、Structured Appendは独立参照可能な範囲を無理に主張せず、capacity/matrix/diagnostics/round-trip invariantsとして別testにする
- Exact-fit/max+1、Version 9/10・26/27、ArrayBufferView offset、0x00/0xffをseed corpusに含める
- Current 15 golden fixturesと12 decode fixturesを変更・再生成しない
- Runtime implementation/public API/package version/runtime dependencyを変更しない
- CI時間をboundedにし、Node 18/20/22/24でdeterministicに通るようにする
- docs/test-plan.md、docs/conformance.mdへoracleの対象範囲と対象外を正確に反映する

完了条件:
- npm testがgreen
- npm run verify:reference:nayukiが拡張後もgreen
- 同一seedで同一case setになる
- Failure時にseed、case index、input/segments、Version、ECC、maskが分かる
- Nayuki非対応領域を「比較済み」と過剰claimしない
- Runtime/source outputに変更がない
- 次のresource safety goalでAUD-01..05を修正できる回帰基盤が整う
```

## 監査追補: AUD-01〜05 hardening

追補日: 2026-07-30  
対象: audit target commit `18da5bc1e2ca1cb7d4249b0c886fb0b88f643ee9` 上の current working tree  
位置づけ: 上記 finding 本文は監査時点の再現記録として保持し、この節で後続実装の status と evidence を追加する。

| Finding | Current working-tree status | Evidence |
| --- | --- | --- |
| AUD-01 renderer allocation | Remediated | `src/render/geometry.js` の checked arithmetic / deterministic budgets、`tests/resource-safety.test.js` の SVG/PNG/Data URL/canvas/browser/node helper assertions、`npm run verify:resource-safety` |
| AUD-02 manual parity stack overflow | Remediated | canonical bytes / split units を作らない streaming parity、150,000-byte と offset 付き view の unit / 32 MiB old-space child |
| AUD-03 oversized auto input | Remediated for single-symbol generation/planning | max Version/ECC/control-aware safe lower bound。20,000 characters は generation 0.27 ms、planning 2.00 ms の測定値で明示 failure。32 MiB old-space child でも完了 |
| AUD-04 Structured Append double generation | Remediated | final symbol ごとに一つの artifact を build。`BitBuffer.toBytes()` call count が symbol 数と一致し、SVG/PNG bytes と diagnostics warning semantics を回帰 test で確認 |
| AUD-05 overflow warning | Remediated | negative `remainingBits` では `CAPACITY_NEAR_LIMIT` を出さず、fixed/auto/manual overflow と successful near-limit を unit test で確認 |

Renderer budget の数値・根拠・failure semantics、修正前後 baseline、non-goals は [Resource Safety / Correctness Hardening](./resource-safety.md) に記録した。`output: "matrix"` は renderer budget の対象外であり、正常範囲の matrix/codeword 互換性は 15 golden fixtures、Nayuki 1280 fixed-condition matrices、bounded/extended deterministic properties で確認した。

2026-07-30 の確認結果:

- `npm test`: 210/210 pass
- bounded conformance: Nayuki 1280 + properties 256 = 1536 pass
- extended conformance: Nayuki 1280 + properties 2048 = 3328 pass
- Vision: 12/12 fixtures
- jsQR: 24/24 artifacts
- `verify:pack`: local packed install pass
- runtime dependencies: 0
- ZXing Java Structured Append metadata: `ZXING_CLASSPATH` 未設定のため skip。AUD-11 は未解決のまま

残存 risk:

- High-level Structured Append は split strategy のため split units を materialize する。Parity-only helper の O(1) aggregation とは別であり、極端に大きい high-level input 向けの architecture 改善余地は残る。
- Raster budget 以下でも、より小さい platform 固有 canvas limit や process 全体の memory 状況により失敗し得る。
- AUD-06 以降の type precision、browser E2E、package invalid-option policy、ZXing metadata lane はこの追補では解決していない。

## 次の Goal: Behavior-Preserving Architecture Refactor

```text
Goal: Split SpecQR orchestration internals without changing public behavior.

目的:
resource-safety hardeningとdeterministic conformance gateで固定したbehaviorを保ったまま、src/index.jsに集中しているplan/build/render、Structured Append preparation/split、diagnostics assemblyを責務別internal modulesへ分離する。

受入条件:
- public exports、types、error/warning codes/messages、return shapes、package exportsを変更しない
- matrix、codewords、SVG/PNG bytes、mask/version selection、diagnosticsを変更しない
- resource budgets、early preflight、streaming parity、single-pass Structured Appendを維持する
- golden fixturesを再生成しない
- npm test 210 cases、Nayuki 1280、bounded/extended conformance、Vision/jsQR、resource gate、pack smokeがgreen
- refactor前後でnormal generationとStructured Appendの代表benchmarkに重大な退行がない
- dependency追加、version bump、publish、新機能追加を行わない
- AUD-06以降は同時に直さず、API/type precision goalへ分離する
```

## 監査追補: Behavior-Preserving Architecture Refactor

位置づけ: AUD-14 への current working-tree 対応を記録する。監査本文と AUD-06 以降の finding は履歴・未解決事項として保持する。

2026-07-30、public behavior を characterization した後、`src/index.js` の planning、build、render、diagnostics adapter、Structured Append orchestration を `src/internal/*` へ分離した。

- `src/index.js`: 1,814 lines / 70 top-level functions から、208 lines の public binding と 30 `QRCode` forwarding methods へ縮小
- Public root exports: 42 から増減なし
- Root/node/browser package exports、`.d.ts`、version、dependencies: 変更なし
- `tests/architecture-characterization.test.js`: output bytes/hash、diagnostics、Planning、GS1/Digital Link、Structured Append、canvas、errors を固定
- `tests/internal-architecture.test.js`: facade boundary と static module graph の cycle 不在を固定
- AUD-01〜05: renderer budget、early reject、streaming parity、single-build、overflow warning behavior を focused tests で再確認

Current module map と internal artifact invariant は [Internal Architecture](./internal-architecture.md) に記録した。AUD-14 は current working tree で remediated と評価できるが、AUD-06〜13、AUD-15および browser/decoder の環境依存範囲はこの refactor では変更していない。

Refactor 前後の Structured Append 5-run median は同文書に記録し、重大な退行がないことを確認した。時間値は correctness gate には使用しない。

Current working-tree verification:

- `npm test`: 219/219 pass
- Nayuki fixed-condition comparison: 1280/1280 exact matrix match
- bounded conformance: 1280 differential + 256 properties = 1536 pass
- extended conformance: 1280 differential + 2048 properties = 3328 pass
- Vision: 12/12 fixtures、jsQR: 24/24 artifacts
- `verify:resource-safety`、`verify:pack`、TypeScript、examples、Pages、pack dry-run、runtime dependency check: pass
- ZXing Java Structured Append metadata: `ZXING_CLASSPATH` 未設定のため引き続き skip。AUD-11 は未解決

## 監査追補: Public API / TypeScript Contract Precision

位置づけ: AUD-06、AUD-07、AUD-09 への current working-tree 対応と、AUD-10 / AUD-12 の互換性判断を記録する。Finding 本文は監査時点の再現記録として保持する。

| Finding | Current working-tree status | Evidence |
| --- | --- | --- |
| AUD-06 dynamic `QRCodeOptions` | Remediated | Named/static `generate()` / `generateSegments()` の literal overload 後に catch-all を追加。Structured Append にも同じ安全な fallback を追加。NodeNext/Bundler consumer type fixture |
| AUD-07 real DOM canvas types | Remediated for TypeScript contract | Legacy `QRCanvasLike` / `QRCanvasContextLike` を維持し、root に DOM global 名を持ち込まない portable structural overload を追加。実 `HTMLCanvasElement` / `CanvasRenderingContext2D` compile fixture |
| AUD-09 packed subpath smoke | Remediated | Tarball を隔離 install し、root/node/browser exact export manifest、代表 runtime call、installed declarations だけを使う NodeNext/Bundler compile を `verify:pack` へ追加 |
| AUD-10 option validation | Characterized, intentionally open | Base/Planning/manual/Structured Append/getCapacity/node/browser policy を runtime test と文書 matrix で固定。Unknown key rejection、plain-object 統一、`diagnostics` boolean validation は breaking v3 decision |
| AUD-12 GS1 metadata mutability | Runtime boundary verified, type mismatch intentionally open | Detached/deep-frozen return、nested mutation rejection、後続 validation 非伝播を test。`readonly` annotation は baseline consumer を拒否するため current major では未適用 |

この追補では runtime implementation、QR bytes、diagnostics、error/warning semantics、package exports、version、dependencies を変更していない。引数省略時の `generate()` を declaration 上 `QRCodeDiagnosticResult` と誤推論していた点は runtime との誤記として修正し、default SVG string と一致させた。既存 consumer fixture は型変更前後で compile し、mutable に見える GS1 type を含む narrowing は行っていない。

Contract と v3 decision は [Public API / TypeScript Contract](./public-api-contract.md) に整理した。AUD-08 の実 browser E2E、AUD-11 の ZXing metadata 継続実行、AUD-12 の最終 readonly 方針は未解決のままである。

## 監査追補: Real Browser E2E Gate

位置づけ: 監査本文の「実ブラウザ未検証」という再現記録は保持し、current working tree に追加した AUD-08 の証拠を追補する。

| Finding | Current working-tree status | Evidence |
| --- | --- | --- |
| AUD-08 real browser E2E | Remediated for desktop engine coverage | 独立 `e2e/browser/` harness、packed-install native ESM fixture、built Pages fixture、Chromium / Firefox / WebKit 27 tests、required Ubuntu / Node.js 22 CI job、failure artifact upload |

Harness は root dependencies へ追加せず、`npm pack` した tarball を一時 directory へ install して `package.json#exports` から root/browser entry を解決する。Checkout の `src/` は配信しない。Playground 側も毎回 build した `dist/pages` だけを配信し、resource origin を自動検査する。

2026-07-30 の current working-tree 実行:

- Playwright Test: 1.62.0
- Chromium 151.0.7922.34: 9/9 pass
- Firefox 153.0: 9/9 pass
- WebKit 26.5: 9/9 pass
- Total: 27/27 pass、retry 0

Packed coverage は matrix/SVG/PNG determinism、実 canvas、Blob/Object URL/ImageData の通常/segment 版、transparent RGBA、offset 付き view、geometry failure、Kanji capability を含む。Built Playground coverage は Single QR、fixed Version overflow、GS1、Digital Link、Structured Append、download を含む。`console.error`、page error、unhandled rejection、外部/failed local request は failure になる。

AUD-08 の remaining non-claims は branded Safari、実端末/mobile browser、scanner、network/CDN、visual fidelity である。AUD-11 の ZXing metadata 継続実行と AUD-12 の major-version readonly 判断は、この追補では変更していない。

## 監査追補: High-Level Structured Append Memory Hardening

追補日: 2026-07-31  
位置づけ: AUD-03 の high-level Structured Append 残存 risk に対する current
working-tree evidence を追加する。監査本文と過去の再現記録は保持する。

| Risk | Current working-tree status | Evidence |
| --- | --- | --- |
| Oversized high-level raw input | Remediated | Version/ECC/header/maxSymbols/mode-aware safe lower-bound preflight。150,000-byte offset view と 150,000-character ASCII を 32 MiB old-space child で stable `DataTooLongError` |
| Oversized high-level manual input | Remediated | Segment descriptor を streaming scan し、canonical bytes / per-unit object 作成前に reject。150,000-byte manual segment を 32 MiB old-space child で stable `DataTooLongError` |
| Raw split source materialization | Remediated | Binary view/range、64-code-point sparse text index、range-only candidate 探索。Final ranges だけ materialize |
| Manual split source materialization | Remediated internally; v3 candidate extends public boundary | O(segment count + sparse checkpoints) descriptors。Candidate standard summary は materialization 0、full opt-in だけが O(unit count)で一度 materialize |

`tests/structured-append-memory.test.js` は、変更前 checkout と照合した
UTF-8/astral、offset binary、manual mixed、Version 9/10・26/27、16-symbol
boundary の matrix/diagnostics hash、split 位置、parity、error class/code/message を
固定する。`npm run verify:structured-append:memory` は 32 MiB low-heap
child を required release gate として実行する。設計と baseline は
[Structured Append Memory Hardening](./structured-append-memory.md) を参照する。

修正前の 150,000-character ASCII は 13,456 ms、manual 150,000-byte は raw
`RangeError` だった。修正後5回中央値はそれぞれ 2.28 ms の
`DataTooLongError`、2.08 ms の `DataTooLongError` である。V10-L 4,304-byte /
16-symbol の matrix と diagnostics hash は変更前後で一致し、Nayuki 1280件と
bounded conformance 1536件も green である。

残存 risk:

- Published v2 manual API の public `diagnostics.splitUnits` は成功時に O(unit count)
  memory を必要とする。この追補時点では v3 candidate は release integration 前
  だった。後続の 3.0.0-rc.1 追補に現在状態を記録する。
- Candidate full opt-in は意図的に O(unit count) memory を維持する。
- Caller 自身が保持する巨大 string、`number[]`、typed array の memory は制限しない。
- ZXing metadata 継続 lane（AUD-11）と GS1 readonly major decision（AUD-12）は
  この hardening では変更していない。

## 監査追補: AUD-11 Structured Append ZXing Java Required Lane

追補日: 2026-07-31  
位置づけ: AUD-11 に対する current working-tree evidence。監査本文と、以前の
`ZXING_CLASSPATH` 未設定 skip 記録は当時の事実として保持する。

| Finding | Current working-tree status | Evidence |
| --- | --- | --- |
| AUD-11 | Remediated locally; remote CI execution pending commit/push | `e2e/zxing-java/` に Maven Wrapper 3.3.4 / Maven 3.9.16 / Temurin 21 canonical CI / ZXing core + javase 3.5.4 を exact pin。Root command は classpath 未設定でも required 実行し、JDK/dependency/metadata 不在を failure にする |

`npm run verify:structured-append:zxing-java` は repository を pack して隔離 install し、
public API だけで 10 fixtures / 44 symbols を生成する。2026-07-31 の local canonical
JDK 実行では 44/44 symbols の metadata が一致し、7 text cases は実 decoded parts を
`mergeStructuredAppendParts()` で元 payload へ復元した。Raw/offset/manual binary
3 cases は ZXing `Result.getText()` が任意 bytes を保存しないため、理由付き
metadata-only assertion として全 index/total/parity を検証した。

Dedicated Ubuntu / Node 22 / Temurin `21.0.11+10` workflow job には skip path がなく、
failure 時の JSON report、fixture PNG、Java/Node/Maven log upload を定義した。
この goal では commit/push を行わないため、GitHub-hosted job の実行結果はまだ存在
しない。Local report、pinning、mapping、non-claims は
[Structured Append ZXing Java Verification](./structured-append-zxing-java.md)
に記録する。

残存 non-claims:

- ZXing Java の単一実装での成功を全 scanner / 全 ZXing family へ一般化しない。
- Arbitrary binary payload の ZXing string round-trip は検証しない。
- 実端末 camera、printed/damaged symbol、scanner 側自動 merge は対象外。
- AUD-12 の GS1 metadata major-version readonly 判断は未解決。

## 監査追補: v3 `diagnostics.splitUnits` Contract Design

追補日: 2026-07-31  
位置づけ: High-Level Structured Append Memory Hardening 後に残った public
O(unit count) cost の設計・実装追補。Dirty working tree では v3 candidate を
runtime/type/gates へ実装済みです。この section 作成時点では version bump / RC
integration 前でした。後続 section で 3.0.0-rc.1 integration を追補し、npm
publish 前なので stable finding は引き続き resolved とはしません。

Current v2 contract では、`generateSegmentsStructuredAppend()` の成功結果が
`diagnostics:false` を含め常に 1 split unit あたり 1 plain object を返す。
Version 40-L / 16-symbol / 47,216-unit case を fresh Node child で5回測定すると、
`splitUnits` retained heap の median は ASCII text 4,369,744 bytes、binary
4,261,936 bytes、full diagnostics JSON は 4,941,373 bytes だった。

[v3 Structured Append Diagnostics Contract](./v3-structured-append-diagnostics.md)
では、standard diagnostics に `splitUnitCount` と
`splitUnitsDetail: "summary"` だけを返し、full array を
`diagnostics: { splitUnits: "full" }` へ移す案を固定した。Lazy
getter/Proxy/iterator は JSON、structured clone、freeze、access-time failure、
source retention の contract が不自然になるため不採用とした。

Status:

- Design: complete
- Runtime / declarations / tests: implemented v3 candidate
- Deterministic evidence: standard materializer 0 calls、full v2 array/legacy
  projection、packed types/runtime、3-engine serialization、32 MiB standard
- Migration release: not implemented
- Published v2 support claim: unchanged eager required array
- AUD-03 residual public memory risk: mitigated in candidate、open until v3 release

## 監査追補: 3.0.0-rc.1 Release Artifact Integration

追補日: 2026-07-31  
位置づけ: v3 `diagnostics.splitUnits` candidate だけを prerelease metadata と
package-level gate へ統合した証拠。監査冒頭の `specqr@2.4.0` は当時の baseline
として保持する。

Current working tree:

- Package metadata: `3.0.0-rc.1`
- npm status: unpublished
- Stable channel: published 2.4.0。Conformance Lab も 2.4.0 対象
- Breaking change: manual `generateSegmentsStructuredAppend()` diagnostics
  contract だけ
- Unknown-option rejection / GS1 readonly: RC 1 へ未実装

`npm run release:artifact` は repository 外で一度だけ canonical tarball を作り、
二回目の pack と expanded file content manifest を比較する。Manifest は tarball
SHA-256、file count、packed/unpacked size、全 path/size/content hash、
repository metadata、exports、runtime dependency count、allow/deny policy を
記録する。

CI 設計は `package-artifact` を producer とし、Node 18 / 20 / 22 / 24、
artifact verification、Chromium / Firefox / WebKit、ZXing Java が同じ
download artifact を使う。Consumer は artifact 指定時に再 pack や checkout
`src/` import へ fallback しない。`npm publish --dry-run --tag next` も同じ
canonical tarball を package spec として使う。

Local/CI architecture、manifest schema、post-publish exact version/dist-tag
verification は [Release Artifact Verification](./release-artifact.md) に記録する。
GitHub-hosted jobs、npm registry、tag、Release、Pages はこの追補時点で未実行の
ため、remote 成功や公開済み claim にはしない。

## 監査追補: 3.0.0-rc.1 Release Freeze and Editorial Gate

追補日: 2026-07-31  
位置づけ: RC 1 の runtime / type / export contract を凍結し、GitHub / npm で公開する
文章と release metadata を最終確認する editorial gate。

Freeze:

- 唯一の breaking change は manual `generateSegmentsStructuredAppend()` diagnostics
  contract。
- unknown-option rejection、GS1 readonly、新 inspection API は future work。
- runtime behavior、types、exports、error / warning message、QR bytes、resource
  budget、dependencies、version は変更しない。

Evidence:

- [Project Language and Writing Style](./project-language.md) を prose の source of
  truth とする。
- `verify:writing` は code / URL / path を除外し、曖昧でない spacing、unit、
  terminology rule を release gate で一度だけ確認する。
- README、CHANGELOG、release notes、migration、SECURITY、CONTRIBUTING、workflow
  display text、package discovery metadata を人が確認する。

この追補は既存 finding を新たに resolved とするものではない。公開前に残る作業は
commit / push、hosted CI、canonical tarball の `next` publish、post-publish
verification に限定する。
