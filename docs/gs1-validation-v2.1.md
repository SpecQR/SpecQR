# GS1 Validation v2.1 Design

この文書は SpecQR `2.1.0` を GS1 validation release として設計固定するための文書です。`2.1` 系では通常 QR Code Model 2 core、v2.0 の public API、runtime dependency-free policy を維持したまま、GS1 helper の introspection と non-throwing validation を追加します。

`getSupportedGs1Ais()`、`getGs1AiInfo(ai)`、`validateGs1Elements()`、`validateGs1ElementString()` は実装済みです。`validateGs1DigitalLink()`、GS1 Digital Link full canonicalization、full GS1 AI catalog は引き続き非スコープです。

## Goals

- Supported GS1 AI catalog を段階的に拡張できる形にする。
- UI / form validation で扱いやすい non-throwing GS1 validation API を追加する。
- Throwing API と non-throwing API の責務を分け、既存 `InvalidGs1Error` behavior を壊さない。
- GS1 error code / diagnostics を安定させ、unsupported AI、length、charset、separator、check digit、Digital Link placement を機械的に区別できるようにする。
- GS1 QR Code / FNC1 first position と GS1 Digital Link URI QR の誤用を減らす。
- Runtime dependency-free を維持する。

## Non-Goals

- v2.1.0 で full GS1 AI catalog を一気に取り込むこと。
- GS1 Digital Link full canonicalization。
- GS1 Digital Link resolver integration。
- Digital Link compression / decompression。
- FNC1 second position の GS1 syntax integration。
- Structured Append の追加変更。
- Micro QR / rMQR / logo / styled modules。
- Runtime dependency 追加。

## Proposed Public API

### `getSupportedGs1Ais()`

現在の public supported AI catalog を安定した metadata shape で返します。

```ts
function getSupportedGs1Ais(): Gs1AiInfo[];
```

返り値は concrete AI entry の配列にします。AI family は public API では展開済みとして返し、例えば `3100` through `3105` は `3100`, `3101`, `3102`, `3103`, `3104`, `3105` の 6 entries として返します。`91` through `99` も同じく concrete AI として返します。これにより、利用者は `getSupportedGs1Ais().some((entry) => entry.ai === ai)` のように単純な lookup ができます。

```ts
type Gs1AiInfo = {
  ai: string;
  label: string;
  length: Gs1AiLength;
  valueKind: Gs1ValueKind;
  checkDigitRule: Gs1CheckDigitRule;
  digitalLinkRole: Gs1DigitalLinkRole;
  digitalLinkPathForPrimary?: string[];
  separator: Gs1SeparatorRequirement;
};

type Gs1AiLength =
  | { type: "fixed"; exact: number }
  | { type: "variable"; min: number; max: number };

type Gs1ValueKind =
  | "numeric"
  | "text"
  | "date"
  | "decimal";

type Gs1CheckDigitRule =
  | "none"
  | "gtin"
  | "sscc";

type Gs1DigitalLinkRole =
  | "primary-key"
  | "key-qualifier"
  | "data-attribute"
  | "not-supported";

type Gs1SeparatorRequirement =
  | "none"
  | "required-when-followed";
```

`getSupportedGs1Ais()` は internal dictionary object をそのまま返しません。戻り値は frozen copy または deep-cloned public shape とし、内部 regex、private flags、source-specific implementation detail は公開しません。Family metadata は concrete AI entries に展開してから返します。

### `getGs1AiInfo(ai)`

1 つの AI の metadata を返します。

```ts
function getGs1AiInfo(ai: string): Gs1AiInfo | null;
```

`ai` は actual AI code を受け付けます。例えば `getGs1AiInfo("3102")` は concrete AI `"3102"` の public metadata を返します。Family notation の `"310n"` や range notation の `"3100-3105"` は受け付けません。

```js
const info = getGs1AiInfo("01");

console.log(info);
// {
//   ai: "01",
//   label: "Global trade item number",
//   length: { type: "fixed", exact: 14 },
//   valueKind: "numeric",
//   checkDigitRule: "gtin",
//   digitalLinkRole: "primary-key",
//   separator: "none"
// }
```

Unsupported AI は `null` を返します。これは lookup API なので throw しません。入力型が string ではない場合は `null` ではなく `InvalidGs1Error` にする案もありますが、v2.1.0 では UI lookup の扱いやすさを優先して string coercion はせず、non-string は `null` とする案を第一候補にします。実装時に TypeScript declaration と runtime validation の一貫性を再確認します。

### `validateGs1Elements(elements, options?)`

`{ ai, value }[]` を non-throwing に検証します。

```ts
function validateGs1Elements(
  elements: Gs1Element[],
  options?: Gs1ValidationOptions
): Gs1ValidationResult;
```

成功時:

```ts
type Gs1ValidationSuccess = {
  ok: true;
  elements: Gs1Element[];
  warnings: Gs1ValidationWarning[];
};
```

失敗時:

```ts
type Gs1ValidationFailure = {
  ok: false;
  errors: Gs1ValidationError[];
  warnings: Gs1ValidationWarning[];
};
```

`elements` は normalize 済みの `{ ai, value }[]` を返します。`warnings` は validation を失敗にしない注意です。`options.context: "digital-link"` では、Digital Link として primary AI が無い入力を structured error として返します。Full path / query placement policy は `validateGs1DigitalLink()` と合わせて後続に回します。

### `validateGs1ElementString(input, options?)`

Raw GS1 element string を non-throwing に検証します。

```ts
function validateGs1ElementString(
  input: string,
  options?: Gs1ValidationOptions
): Gs1ElementStringValidationResult;
```

成功時は `parseGs1ElementString(input)` と同じ element data に加えて warnings を返します。

```ts
type Gs1ElementStringValidationSuccess = {
  ok: true;
  elements: Gs1Element[];
  hasSeparators: boolean;
  warnings: Gs1ValidationWarning[];
};
```

失敗時:

```ts
type Gs1ElementStringValidationFailure = {
  ok: false;
  errors: Gs1ValidationError[];
  warnings: Gs1ValidationWarning[];
};
```

`parseGs1ElementString(input)` は引き続き throwing API です。`validateGs1ElementString(input)` は同じ parser / validator を使いますが、`InvalidGs1Error` を result object に変換します。UI は `ok` を見て inline error を出せます。

### `validateGs1DigitalLink(uri, options?)`

`validateGs1DigitalLink(uri, options?)` は v2.1.0 では公開しない第一候補です。理由は、GS1 Digital Link は raw GS1 element string よりも policy surface が大きく、次を同時に決める必要があるためです。

- canonicalization をどこまで検証するか。
- resolver URL と element data URI を区別するか。
- `linkType` など unknown query を warning にするか error にするか。
- path placement と primary/key-qualifier relation をどこまで full catalog に広げるか。
- industry profile 由来の rule を扱うか。

v2.1.0 では `createGs1DigitalLink()` / `parseGs1DigitalLink()` の throwing behavior を維持し、Digital Link 向け non-throwing validator は v2.2.0 の候補に回します。ただし `validateGs1Elements(elements, { context: "digital-link" })` で primary AI 不足のような明確な誤用だけを検出します。

## Validation Options

```ts
type Gs1ValidationOptions = {
  context?: "element-string" | "digital-link";
  allowUnsupportedAi?: false;
  collectAllErrors?: boolean;
};
```

v2.1.0 の default は次です。

- `context: "element-string"`
- `allowUnsupportedAi: false`
- `collectAllErrors: true`

`allowUnsupportedAi: true` は v2.1.0 では入れない第一候補です。SpecQR は unsupported AI を silent に通すより、現在 supported catalog を明確に伝える方針を維持します。将来、業務システム側の private AI を受け付けたい要望が強い場合だけ、`unknownAi: "reject" | "warn"` のような option を検討します。

## Error Codes

v2.0.x の `InvalidGs1Error.code` は `"INVALID_GS1"` です。v2.1.0 でも throwing API の top-level `code` は互換性のため維持します。Non-throwing validation result では、GS1 detail code を `errors[].code` として安定化します。

```ts
type Gs1ValidationError = {
  code: Gs1ValidationErrorCode;
  message: string;
  ai?: string;
  value?: string;
  offset?: number;
  elementIndex?: number;
};

type Gs1ValidationErrorCode =
  | "GS1_UNSUPPORTED_AI"
  | "GS1_INVALID_LENGTH"
  | "GS1_INVALID_CHARSET"
  | "GS1_MISSING_SEPARATOR"
  | "GS1_UNEXPECTED_SEPARATOR"
  | "GS1_INVALID_CHECK_DIGIT"
  | "GS1_INVALID_DIGITAL_LINK_PLACEMENT"
  | "GS1_INVALID_INPUT";
```

Minimum required mappings:

| Scenario | Detail code |
| --- | --- |
| Dictionary にない AI | `GS1_UNSUPPORTED_AI` |
| fixed length / variable max length 違反 | `GS1_INVALID_LENGTH` |
| numeric-only / printable ASCII 違反 | `GS1_INVALID_CHARSET` |
| variable-length AI 後の separator 不足 | `GS1_MISSING_SEPARATOR` |
| 不正な場所の ASCII GS separator | `GS1_UNEXPECTED_SEPARATOR` |
| GTIN / SSCC check digit 不一致 | `GS1_INVALID_CHECK_DIGIT` |
| Digital Link path に置けない AI | `GS1_INVALID_DIGITAL_LINK_PLACEMENT` |
| input type、empty string、parentheses direct input | `GS1_INVALID_INPUT` |

Throwing API との関係:

- `parseGs1HumanReadable()`、`createGs1ElementString()`、`parseGs1ElementString()`、`createGs1DigitalLink()`、`parseGs1DigitalLink()` は既存どおり `InvalidGs1Error` を throw します。
- `InvalidGs1Error.code` は `"INVALID_GS1"` のままです。
- v2.1.0 実装時に `InvalidGs1Error` に optional `details` を追加するかは慎重に判断します。既存 error object の列挙可能 property が増えることを避けるなら、non-throwing validator だけが detail code を返す形に留めます。

## Warning Codes

```ts
type Gs1ValidationWarning = {
  code: Gs1ValidationWarningCode;
  message: string;
  ai?: string;
  elementIndex?: number;
};

type Gs1ValidationWarningCode =
  | "GS1_DIGITAL_LINK_QUERY_ONLY"
  | "GS1_DIGITAL_LINK_UNKNOWN_QUERY_PRESERVED"
  | "GS1_SEPARATOR_NOT_NEEDED"
  | "GS1_CATALOG_PARTIAL";
```

Warnings は少なく始めます。`GS1_CATALOG_PARTIAL` は、利用者が `getSupportedGs1Ais()` を表示するときに「SpecQR の supported catalog は full GS1 AI catalog ではない」ことを UI に出したい場合の候補です。ただし毎回 validation result に入れると noisy なので、v2.1.0 では docs と metadata introspection に寄せ、validation warnings には入れない第一候補です。

## GS1 QR Code vs GS1 Digital Link

SpecQR は v2.1.0 でも次の区別を維持します。

| 目的 | Payload | QR generation |
| --- | --- | --- |
| GS1 QR Code / FNC1 first position | Raw GS1 element string | `QRCode.generate(data, { gs1: true })` |
| GS1 Digital Link URI QR | `https://.../01/...` URI | `QRCode.generate(uri)` |

誤用防止方針:

- `QRCode.generate(uri, { gs1: true })` は raw GS1 element string validator で reject される現状を維持します。
- `validateGs1ElementString("https://example.com/...")` は `GS1_UNSUPPORTED_AI` または `GS1_INVALID_INPUT` として失敗します。
- `validateGs1Elements(elements, { context: "digital-link" })` は Digital Link primary AI が無い入力を `GS1_INVALID_DIGITAL_LINK_PLACEMENT` として返します。Path / query placement の full validation は `validateGs1DigitalLink()` の後続設計に回します。
- `validateGs1DigitalLink()` は v2.2.0 に回し、v2.1.0 では Digital Link URI の full validation を主張しません。

## Catalog Expansion Plan

v2.1.0 は supported AI catalog を「表を増やすだけ」にはしません。AI group ごとに metadata、validation、negative tests、docs、Digital Link role を揃えてから追加します。

### v2.1.0 Candidate Groups

1. Date and product lifecycle AIs already near current scope
   - Existing `11`, `12`, `13`, `15`, `16`, `17` を維持し、date semantic warning / strict YYMMDD range validation を追加するかを検討します。
   - `YYMMDD` の calendar validity は GS1 practice と scanner 互換性に影響するため、v2.1.0 では invalid date を error にする前に docs と tests を固定します。
2. Trade item and logistics identifiers
   - `240`, `241`, `400`, `410` through `415` 近辺を現状維持しつつ、GLN 系の Digital Link primary / data-attribute role を見直します。
   - `414` は current primary-key として維持します。
3. Quantity / measure families
   - `30`, `37`, `310n`, `320n` を起点に decimal indicator metadata を public metadata に出します。
   - `valueKind: "decimal"` を導入する場合は、actual AI の indicator digit と value scaling の説明を docs に追加します。
4. Geographic / origin AIs
   - `422`, `424`, `425`, `426` の numeric length validation は維持し、国コード存在 validation は v2.1.0 では入れない候補です。

### v2.1.x Candidate Groups

- Additional GLN / party AIs not currently listed.
- Additional logistics and shipment AIs.
- Additional measurement families beyond `310n` / `320n`.
- Additional internal / company AIs with conservative text validation.
- Optional date semantic strictness after compatibility review.

### Deferred Beyond v2.1.x

- Full GS1 AI catalog.
- Industry-specific rule packages.
- Full Digital Link canonicalizer.
- Resolver-aware validation.

Full catalog を一気に入れない理由:

- AI ごとに length、charset、decimal indicator、date semantics、check digit、separator、Digital Link placement が異なる。
- Digital Link role は AI 単体ではなく primary AI との関係で決まるものがある。
- 仕様表を増やすだけでは valid-looking but unsafe な helper になりやすい。
- 外部 source の license / usage terms と generated data policy を先に固定する必要がある。

## Source / License / Generation Policy

GS1 Barcode Syntax Dictionary などの外部 metadata を参照する場合、v2.1.0 実装前に次を決めます。

- Source URL、version、取得日を docs に記録する。
- License / usage terms を確認し、repository に含めてよい derived metadata の範囲を明記する。
- 仕様本文や大きな表を無断コピーしない。
- 自動生成する場合は generator script と input source の取り扱いを `tools/` と docs に分ける。
- Generated dictionary は review 可能な小さな diff にし、runtime dependency を増やさない。
- NOTICE が必要なら publish package contents に含める。

v2.1.0 の第一候補は、現行 supported AI と追加する少数 group について hand-curated metadata を維持し、source / license policy を docs に明記することです。Full generated catalog は後続 phase に回します。

## Release Gate for Implementation

v2.1.0 実装時は少なくとも次を確認します。

- Existing throwing API の runtime behavior が変わらないこと。
- `getSupportedGs1Ais()` / `getGs1AiInfo()` が internal metadata を mutation 可能な形で漏らさないこと。
- `validateGs1Elements()` が success / failure result shape を安定して返すこと。
- `validateGs1ElementString()` が `parseGs1ElementString()` と同じ validation source を使うこと。
- Error code が negative tests で固定されていること。
- Digital Link misuse prevention が docs / examples / tests で確認されていること。
- Runtime dependency が 0 のままであること。
- Packed package smoke と TypeScript consumer check に新 API が含まれること。

## Rejected Alternatives

- `validateGs1ElementString()` が boolean だけを返す案: failure reason が失われるため rejected。
- Throwing API を non-throwing に変える案: v1 / v2.0 public behavior を壊すため rejected。
- `getSupportedGs1Ais()` で internal dictionary entry をそのまま返す案: internal metadata と public contract が結合するため rejected。
- v2.1.0 で `validateGs1DigitalLink()` まで入れる案: Digital Link canonicalization / resolver / unknown query policy を同時に決める必要があり、validation release の焦点が広がりすぎるため v2.2.0 候補へ deferred。
- Full GS1 AI catalog を一括追加する案: source / license / tests / Digital Link role が未固定のまま広げると unsafe なため rejected。

## Documentation Impact

v2.1 系の実装で更新する docs:

- `docs/api.md`: new public API の正式説明。
- `docs/gs1-supported-ai.md`: catalog metadata shape と新 supported AI group。
- `docs/conformance.md`: GS1 validation introspection / non-throwing validation の status。
- `docs/test-plan.md`: error code、validation result、catalog introspection、packed smoke。
- `docs/spec-scope.md`: v2.1.0 の実装済み範囲と non-scope。
- `README.md`: 短い usage link。
- `CHANGELOG.md`: `2.1.0` release entry。

この文書は、実装済み API と今後の catalog expansion / Digital Link validation backlog の境界を記録します。
