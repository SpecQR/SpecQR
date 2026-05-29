# Planning / Diagnostics API v2.4

この文書は SpecQR v2.4.0 の planning / diagnostics API contract です。`estimate()`、`analyzeSegments()`、`getCapacity()` は root named exports と `QRCode` static methods として実装済みです。2.4.0 release package では package version を `2.4.0` に更新しますが、npm publish / GitHub Release / Pages deploy / tag 作成は別手順で行います。

v2.4.0 は QR generation core の新機能 release ではなく、生成前に「どの Version / ECC / mode に収まるか」「どの警告を UI に出すべきか」を安全に見積もる API surface を固定する release として扱います。

## Goals

- QR を実際に render する前に、payload がどの Version / ECC / mode で収まるかを見積もる。
- `generate(..., { diagnostics: true })` の情報を、生成後だけでなく planning 段階でも使える形に整理する。
- capacity table を直接参照したい利用者向けに、内部 table を安全な public shape で返す。
- quiet zone、color contrast、print DPI、scan risk warning を planning UI / playground に出せるようにする。
- `generate()` と `generateSegments()` の既存挙動を変えず、planning API は同じ planner を source of truth にする。

## Non-Goals

- QR core algorithm、capacity table、mask selection、renderer output を変更しない。
- `generate()` / `generateSegments()` の return shape を変更しない。
- Micro QR / rMQR / logo overlay / styled modules を扱わない。
- GS1 Digital Link full canonicalization、full GS1 AI catalog、decoder / scanner integration を扱わない。
- npm publish、GitHub Release、Pages deploy、tag 作成はこの release preparation step の対象外。

## Public API

v2.4.0 の public API は次です。

```ts
estimate(input, options?): QREstimateResult;
QRCode.estimate(input, options?): QREstimateResult;

analyzeSegments(segments, options?): QREstimateResult;
QRCode.analyzeSegments(segments, options?): QREstimateResult;

getCapacity(options): QRCapacityInfo;
QRCode.getCapacity(options): QRCapacityInfo;
```

Root named exports と `QRCode` static methods の両方を提供します。これは既存の `generate()`、GS1 helper、Structured Append helper と同じ discoverability policy です。

### Relationship To Existing APIs

| 目的 | API |
| --- | --- |
| QR を生成する | `generate(input, options)` |
| manual segments から QR を生成する | `generateSegments(segments, options)` |
| 生成後の matrix / renderer / mask / codeword diagnostics を見る | `generate(..., { diagnostics: true })` |
| 生成前に single-symbol QR の capacity / warnings を見る | `estimate(input, options?)` |
| manual segments を生成前に分析する | `analyzeSegments(segments, options?)` |
| Version / ECC / mode の capacity table を直接参照する | `getCapacity(options)` |

`estimate()` と `analyzeSegments()` は single-symbol QR の planning API です。Structured Append high-level splitting の計画は、v2.4.0 初期 API には含めません。`generateStructuredAppend()` / `generateSegmentsStructuredAppend()` の multi-symbol planning は、後続で `estimateStructuredAppend()` のような別 API として設計します。

## `estimate(input, options?)`

`estimate()` は `generate()` と同じ input family を受け付けます。

- JavaScript `string`
- byte array
- `Uint8Array`
- `ArrayBuffer`
- `ArrayBufferView`

`options` は `generate()` の主要 planning option と同じです。

```ts
interface QREstimateOptions {
  errorCorrectionLevel?: "L" | "M" | "Q" | "H";
  version?: 1 | 2 | 3 | /* ... */ 40 | "auto";
  minVersion?: number;
  maxVersion?: number;
  mode?: "auto" | "numeric" | "alphanumeric" | "byte" | "kanji";
  encoding?: "utf-8";
  optimizeSegments?: boolean;
  boostErrorCorrection?: boolean;
  eci?: false | true | number;
  gs1?: boolean;
  fnc1Second?: false | string;
  structuredAppend?: false | {
    index: number;
    total: number;
    parity: number;
  };
  margin?: number;
  scale?: number;
  foreground?: string;
  background?: string;
  printDpi?: number | null;
}
```

`output` と `maskPattern` は planning result に影響しません。既存 option validation と API consistency のため指定値は `normalizeOptions()` で検証しますが、`estimate()` は render を行わないため `RASTER_SCALE_SMALL` warning や mask diagnostics を返しません。`maskPattern` は matrix construction 後でしか penalty を評価できないため、mask diagnostics は `generate(..., { diagnostics: true })` に残します。

### GS1 / ECI / Digital Link

- `gs1: true` は `generate()` と同じく raw GS1 element string validation を行う。
- GS1 Digital Link URI は通常 URL input なので、`gs1: true` を付けずに `estimate(uri)` で扱う。
- `eci: true` は `generate()` と同じく UTF-8 ECI assignment number `26` の control segment overhead を含める。
- `fnc1Second` と low-level `structuredAppend` option は `generate()` と同じ併用制限と overhead を使う。

## `analyzeSegments(segments, options?)`

`analyzeSegments()` は `generateSegments()` と同じ manual segment input を受け付けます。

- `numeric`
- `alphanumeric`
- `byte`
- `kanji`
- `eci`
- `fnc1`
- `fnc1-second`
- `structured-append`

初期実装では、`analyzeSegments()` も `generateSegments()` と同じ single-symbol planner を使います。したがって ECI / GS1 / FNC1 / FNC1 second / low-level Structured Append control segments の bit length と capacity accounting を含めます。

`gs1: true` option と manual `{ mode: "fnc1" }` segment の二重指定、ECI と GS1 / FNC1 の併用、Structured Append と他 control segment の併用などは、`generateSegments()` と同じ error behavior にします。

High-level `generateSegmentsStructuredAppend()` の分割計画は含めません。manual segments の multi-symbol split planning は、後続 API で別途扱います。

## `getCapacity(options)`

`getCapacity()` は QR Code Model 2 の Version / ECC capacity を public-safe shape で返します。内部 table をそのまま露出せず、利用者が UI や validation で使いやすい単位に整理します。

```ts
interface QRGetCapacityOptions {
  version: number;
  errorCorrectionLevel?: "L" | "M" | "Q" | "H";
  errorCorrection?: "L" | "M" | "Q" | "H";
  mode?: "numeric" | "alphanumeric" | "byte" | "kanji";
  controlBits?: number;
}
```

`errorCorrectionLevel` を primary option にします。`errorCorrection` は短い alias として受け付けてもよいですが、両方が指定されて矛盾する場合は `InvalidInputError` です。SpecQR の既存 option 名と揃えるため、docs と examples では `errorCorrectionLevel` を使います。

`mode` を指定しない場合、raw capacity だけを返します。`mode` を指定した場合、mode indicator と character count indicator を差し引いた payload capacity も返します。

```ts
interface QRCapacityInfo {
  version: number;
  errorCorrectionLevel: "L" | "M" | "Q" | "H";
  size: number;
  dataCodewords: number;
  capacityBits: number;
  mode: null | "numeric" | "alphanumeric" | "byte" | "kanji";
  characterCountBits: null | number;
  modeIndicatorBits: null | 4;
  controlBits: number;
  payloadBits: null | number;
  maxCharacters: null | number;
  maxBytes: null | number;
}
```

`maxCharacters` は `numeric` / `alphanumeric` / `kanji` 向けです。`byte` mode では `maxBytes` を返します。UTF-8 string の文字数は byte length と一致しないため、`byte` mode で `maxCharacters` を返しません。

`getCapacity()` は GS1 AI、Digital Link、Structured Append high-level split の semantic capacity は返しません。これらは separator、URI encoding、control segment ordering、split strategy に依存するため、`estimate()` / `analyzeSegments()` を使います。

## Examples / Playground

実行可能な usage example は [../examples/planning-api.mjs](../examples/planning-api.mjs) にあります。この example は `estimate()`、`analyzeSegments()`、`getCapacity()`、固定 Version の `{ ok: false, reason: "data-too-long" }` result を 1 つの JSON summary として出力します。

Playground は single-symbol generation の前に `estimate()` を実行し、`selectedVersion`、`minVersion`、`maxVersion`、ECC、mode、`dataBitLength`、`capacityBits`、`remainingBits`、`usageRatio`、capacity overflow を表示します。Version / ECC / mode の byte capacity 参照には `QRCode.getCapacity()` を使います。Structured Append mode では、v2.4.0 API の範囲を明確にするため single-symbol estimate として表示し、multi-symbol split planning は後続 API の対象に残します。

## Result Shape

`estimate()` と `analyzeSegments()` は同じ discriminated union を返します。

```ts
type QREstimateResult = QREstimateSuccess | QREstimateFailure;

interface QREstimateSuccess {
  ok: true;
  selectedVersion: number;
  minVersion: number;
  maxVersion: number;
  errorCorrectionLevel: "L" | "M" | "Q" | "H";
  requestedErrorCorrectionLevel: "L" | "M" | "Q" | "H";
  boostedErrorCorrection: boolean;
  mode: "numeric" | "alphanumeric" | "byte" | "kanji" | "mixed";
  dataBitLength: number;
  capacityBits: number;
  remainingBits: number;
  usageRatio: number;
  capacityUtilization: number;
  inputBytes: number;
  segments: QRPlanningSegment[];
  controlSegments: QRControlSegmentDiagnostics[];
  versionSelection: "fixed" | "auto-minimum";
  versionSelectionReason: string;
  warnings: QRWarning[];
  diagnostics: QRPlanningDiagnostics;
}

interface QREstimateFailure {
  ok: false;
  reason: "data-too-long";
  selectedVersion: number | null;
  minVersion: number;
  maxVersion: number;
  errorCorrectionLevel: "L" | "M" | "Q" | "H";
  requestedErrorCorrectionLevel: "L" | "M" | "Q" | "H";
  boostedErrorCorrection: false;
  mode: "numeric" | "alphanumeric" | "byte" | "kanji" | "mixed";
  dataBitLength: number;
  capacityBits: number;
  remainingBits: number;
  overflowBits: number;
  usageRatio: number;
  capacityUtilization: number;
  inputBytes: number;
  segments: QRPlanningSegment[];
  controlSegments: QRControlSegmentDiagnostics[];
  versionSelection: "fixed" | "auto-range";
  versionSelectionReason: string;
  warnings: QRWarning[];
  diagnostics: QRPlanningDiagnostics;
  error: {
    name: "DataTooLongError";
    code: "DATA_TOO_LONG";
    message: string;
  };
}
```

`usageRatio` と `capacityUtilization` は同じ値です。`capacityUtilization` は既存 diagnostics との互換名、`usageRatio` は planning UI で読みやすい名前です。v2.4.0 では両方を返し、将来の deprecation は行いません。

`selectedVersion` は成功時に実際に使う Version です。Failure の場合、fixed version overflow ではその fixed version、auto range overflow では `null` を返します。`capacityBits` は failure 時も比較に使えるよう、fixed version ではその Version の capacity、auto range overflow では `maxVersion` の capacity を返します。

### Planning Diagnostics

`diagnostics` は `generate(..., { diagnostics: true })` の subset + planning-specific fields とします。

```ts
interface QRPlanningDiagnostics {
  phase: "planning";
  renderPlanned: false;
  maskEvaluated: false;
  codewordsBuilt: false;
  version: number | null;
  size: number | null;
  errorCorrectionLevel: "L" | "M" | "Q" | "H";
  requestedErrorCorrectionLevel: "L" | "M" | "Q" | "H";
  boostedErrorCorrection: boolean;
  versionSelection: "fixed" | "auto-minimum" | "auto-range";
  versionSelectionReason: string;
  mode: "numeric" | "alphanumeric" | "byte" | "kanji" | "mixed";
  controlSegments: QRControlSegmentDiagnostics[];
  eciAssignmentNumber: number | null;
  fnc1: null | "first-position" | "second-position";
  fnc1Second: {
    enabled: boolean;
    applicationIndicator: string | null;
    applicationIndicatorCodeword: number | null;
  };
  structuredAppend: {
    enabled: boolean;
    index: number | null;
    total: number | null;
    parity: number | null;
    sequenceIndex: number | null;
    sequenceTotal: number | null;
    sequenceIndicator: number | null;
  };
  gs1: boolean;
  gs1Validation: {
    enabled: boolean;
    elementCount: number | null;
    ais: string[];
    hasSeparators: boolean;
  };
  segments: QRPlanningSegment[];
  dataBitLength: number;
  capacityBits: number;
  remainingBits: number;
  capacityUtilization: number;
  quietZone: QRQuietZoneDiagnostics;
  colors: QRColorContrastDiagnostics;
  print: QRPrintDiagnostics;
  warnings: QRWarning[];
}
```

`maskPattern`、`maskPenalty`、`maskPenalties`、`maskSelectionReason`、`dataCodewords`、`errorCorrectionCodewords`、`totalCodewords` は planning diagnostics では返しません。これらは matrix / codeword construction 後の情報なので、`generate(..., { diagnostics: true })` に残します。

## Warning Surface

Planning API の `warnings` は既存 diagnostics warning shape を使います。

```ts
interface QRWarning {
  code: string;
  severity: "info" | "warning";
  message: string;
  details?: Record<string, unknown>;
}
```

v2.4.0 初期 warning surface は次を対象にします。

| Warning | planning API での扱い |
| --- | --- |
| `QUIET_ZONE_TOO_SMALL` | `margin < 4` で返す。 |
| `COLOR_CONTRAST_UNKNOWN` | inspect できない color string で返す。 |
| `COLOR_CONTRAST_LOW` | contrast ratio が推奨未満の場合に返す。 |
| `COLOR_CONTRAST_MODERATE` | scan 可能だが強い contrast を推奨する場合に返す。 |
| `COLOR_ALPHA_USED` | foreground / background alpha が 255 未満の場合に返す。 |
| `CAPACITY_NEAR_LIMIT` | `remainingBits / capacityBits < 0.05` の場合に返す。 |
| `PRINT_MODULE_TOO_SMALL` | `printDpi` と `scale` から計算した module size が推奨未満の場合に返す。 |
| `RASTER_SCALE_SMALL` | `output` を planning で扱わない場合は初期 API では返さない。 |
| `SCAN_RISK` | warning severity を含む場合の aggregate warning として返す。 |

`RASTER_SCALE_SMALL` は renderer output に依存するため、`estimate()` 初期 API では返さない方針です。もし `output` を accepted planning option に含める場合だけ、既存 diagnostics と同じ条件で返します。

## Throwing / Non-Throwing Policy

Planning API は payload capacity check を UI / batch import で扱いやすくするため、`DataTooLongError` は原則 throw しません。代わりに `ok: false` result を返します。

ただし、呼び出し側の設定ミスや invalid input type は既存 API と同じ error class を投げます。

| ケース | `estimate()` / `analyzeSegments()` |
| --- | --- |
| input が容量超過 | throw せず `{ ok: false, reason: "data-too-long" }` |
| invalid version / minVersion / maxVersion | `InvalidVersionError` |
| invalid mode / segment mode / control combination | `InvalidModeError` |
| invalid ECI assignment number | `InvalidEciError` |
| invalid GS1 payload | `InvalidGs1Error` |
| invalid color | `InvalidColorError` |
| invalid input type | `InvalidInputError` |

`throwOnDataTooLong: true` のような option は v2.4.0 初期 API には含めません。Throwing behavior が必要な利用者は `generate()` / `generateSegments()` を使えます。

## Consistency With `generate()`

`ok: true` の `estimate(input, options)` は、同じ input / planning options を `generate(input, { ...options, diagnostics: true })` に渡したとき、次の fields が一致するべきです。

- `version` / `selectedVersion`
- `errorCorrectionLevel`
- `requestedErrorCorrectionLevel`
- `boostedErrorCorrection`
- `versionSelection`
- `mode`
- `controlSegments`
- `eciAssignmentNumber`
- `fnc1`
- `fnc1Second`
- `structuredAppend`
- `gs1`
- `gs1Validation`
- `segments`
- `dataBitLength`
- `capacityBits`
- `remainingBits`
- `capacityUtilization`
- `quietZone`
- `colors`
- `print`
- planning で評価できる `warnings`

次は一致対象外です。

- `maskPattern`
- `maskPenalty`
- `maskPenalties`
- `maskSelectionReason`
- `dataCodewords`
- `errorCorrectionCodewords`
- `totalCodewords`
- rendered `matrix` / `svg` / `png`

`estimate()` は mask selection を行わないため、auto mask の penalty list を返しません。Mask diagnostics が必要な場合は `generate(..., { diagnostics: true })` を使います。

## Playground Plan

Playground では、後続 phase で次の表示を追加する方針です。

- 入力変更時に `estimate()` を軽量に実行し、生成ボタン前に `selectedVersion`、ECC、mode、capacity usage を表示する。
- Version / ECC / mode の候補 UI で `getCapacity()` を使い、最大 bytes / characters を補助表示する。
- `warnings` を generation result と同じ UI component で表示する。
- `DataTooLongError` 相当は throw ではなく `{ ok: false }` result として、Version / ECC / mode の改善候補を表示する。
- Structured Append mode では、初期 v2.4.0 API は single-symbol planning であることを明示し、multi-symbol estimate は後続設計へ回す。

## Test Plan For Implementation

v2.4.0 implementation は、少なくとも次を release gate に含めます。

- Root export と `QRCode` static method が存在すること。
- `estimate()` が string / binary input で `generate(..., { diagnostics: true })` と planning fields を一致させること。
- `analyzeSegments()` が manual data segments と control segments の bit accounting を `generateSegments(..., { diagnostics: true })` と一致させること。
- `getCapacity()` が Version 1 / 9 / 10 / 26 / 27 / 40、ECC L/M/Q/H、numeric / alphanumeric / byte / kanji で capacity table と mode overhead を正しく返すこと。
- Capacity overflow は `{ ok: false, reason: "data-too-long" }` になり、`DataTooLongError` を throw しないこと。
- Invalid option / invalid GS1 / invalid ECI / invalid color は既存 error class を投げること。
- `warnings` が quiet zone、contrast、print DPI、capacity near limit、scan risk を既存 diagnostics と同じ shape で返すこと。
- TypeScript consumer check が return shape と discriminated union を検査すること。
- Packed package smoke が root export と `QRCode` static variants を install 後に確認すること。

## Rejected Alternatives

### `plan()` という API 名にする

`plan` は一般語で、Structured Append の split plan や renderer plan と衝突しやすいため reject します。利用者が「これは見積もりであり QR を生成しない」と理解しやすい `estimate()` を採用候補にします。

### `estimate()` で `DataTooLongError` を投げる

UI / form / batch import では容量超過が通常の分岐であり、例外にすると扱いにくいため reject します。Invalid configuration は throw、capacity overflow は result object で返す方針に分けます。

### Planning diagnostics に mask penalty を含める

Mask penalty は matrix construction 後でないと評価できません。`estimate()` が軽量な planning API であることを保つため、mask diagnostics は `generate(..., { diagnostics: true })` に残します。

### `getCapacity()` で GS1 / Digital Link の最大文字数を返す

GS1 separator、Digital Link percent encoding、AI placement、Structured Append control overhead は semantic layer に依存します。誤解を避けるため、`getCapacity()` は QR mode-level capacity に留め、semantic payload は `estimate()` / `analyzeSegments()` に任せます。

## Implementation Notes

v2.4.0 implementation は、既存 planner と diagnostics helper を source of truth にします。Capacity math を `estimate()` 用に重複実装せず、`generate()` / `generateSegments()` と同じ segment normalization、control segment prepend、version selection、error correction boosting、warning construction を共有します。`getCapacity()` は table lookup と mode-level payload math のみに限定し、semantic payload capacity は `estimate()` / `analyzeSegments()` に任せます。
