# GS1 Digital Link Validation v2.2 Design

この文書は、SpecQR v2.2.0 で公開する GS1 Digital Link validation API と deterministic normalization API の設計記録です。`validateGs1DigitalLink()` と `normalizeGs1DigitalLink()` は実装済みです。

既存の `createGs1DigitalLink()` / `parseGs1DigitalLink()` は v2.0.0 で実装済みです。v2.2.0 では、UI / form validation 向けの non-throwing API と、SpecQR が扱う supported AI 範囲に限定した deterministic normalization API を追加しました。

実利用時の入口は次のように分けます。

| やりたいこと | API / docs |
| --- | --- |
| GS1 element data から URI を作る | `createGs1DigitalLink()` / [GS1 Digital Link v2 Design](./gs1-digital-link-v2.md) |
| 既存 URI を strict に読む | `parseGs1DigitalLink()` |
| 画面入力や import を例外なしで検証する | `validateGs1DigitalLink()` |
| 保存・比較向けに安定した URI string にする | `normalizeGs1DigitalLink()` |
| 対応 AI と path/query placement を確認する | [Supported GS1 AIs](./gs1-supported-ai.md) |

Playground では `入力形式` に `GS1 Digital Link URI` を選ぶと、`preserve` / `reject` の unknown query policy、validation warnings、normalized URI を確認できます。

## Goals

- `parseGs1DigitalLink()` の throwing behavior を維持しながら、失敗理由を機械的に扱える validation result API を用意する。
- `createGs1DigitalLink()` の既存 output を silent に変えず、deterministic normalization は別 API として提供する。
- Unknown query、percent encoding、path / query placement、duplicate AI、fragment、http / https の扱いを v2.2.0 release 前に固定する。
- Full GS1 Digital Link canonicalizer、resolver、compression、web vocabulary helper ではないことを明確にする。
- Current supported AI catalog だけを対象にし、full GS1 AI catalog 対応を主張しない。

## Non-goals

- `createGs1DigitalLink()` の default output 変更。
- `parseGs1DigitalLink()` を non-throwing API に変えること。
- Full GS1 Digital Link canonicalization。
- Resolver / network API。
- Digital Link compression / decompression。
- `linkType` や web vocabulary の意味解釈。
- Full GS1 AI catalog。
- Industry profile validation。
- FNC1 second position、Structured Append、Micro QR、rMQR への追加変更。

## Public API

### `validateGs1DigitalLink(uri, options?)`

GS1 Digital Link URI を検証し、throw ではなく validation result を返します。

```ts
type Gs1DigitalLinkUnknownQueryPolicy = "preserve" | "reject";

type Gs1DigitalLinkValidationOptions = {
  primaryAi?: "00" | "01" | "414";
  unknownQuery?: Gs1DigitalLinkUnknownQueryPolicy;
};

type Gs1DigitalLinkValidationSuccess = {
  ok: true;
  result: GS1DigitalLinkParseResult;
  warnings: GS1ValidationWarning[];
};

type Gs1DigitalLinkValidationFailure = {
  ok: false;
  errors: GS1ValidationError[];
  warnings: GS1ValidationWarning[];
};

function validateGs1DigitalLink(
  uri: string | URL,
  options?: Gs1DigitalLinkValidationOptions
): Gs1DigitalLinkValidationSuccess | Gs1DigitalLinkValidationFailure;
```

`result` の基本 shape は `parseGs1DigitalLink()` と同じです。

```ts
type GS1DigitalLinkParseResult = {
  elements: GS1Element[];
  primary: GS1Element | null;
  pathElements: GS1Element[];
  queryElements: GS1Element[];
  unknownQuery: Array<{ key: string; value: string }>;
};
```

`QRCode.validateGs1DigitalLink(uri, options?)` も root function と同じ動作の static method として公開します。

### `normalizeGs1DigitalLink(uri, options?)`

GS1 Digital Link URI を SpecQR の deterministic policy で再構成し、string を返します。root function と `QRCode.normalizeGs1DigitalLink(uri, options?)` static method として公開します。

```ts
type Gs1DigitalLinkNormalizeOptions = {
  primaryAi?: "00" | "01" | "414";
  unknownQuery?: Gs1DigitalLinkUnknownQueryPolicy;
  mode?: "specqr-deterministic";
};

function normalizeGs1DigitalLink(
  uri: string | URL,
  options?: Gs1DigitalLinkNormalizeOptions
): string;
```

戻り値は metadata object ではなく string です。理由は、normalization の主用途が storage、comparison、copy、QR payload generation であり、metadata が必要な場合は `parseGs1DigitalLink(normalizedUri)` または `validateGs1DigitalLink(uri)` で得られるためです。

## Relationship to Existing APIs

| API | v2.2.0 での役割 |
| --- | --- |
| `createGs1DigitalLink(input, options)` | Element data から URI を作る throwing builder。既存 output は変えない。 |
| `parseGs1DigitalLink(uri, options?)` | URI を element data に戻す throwing parser。既存 behavior は変えない。 |
| `validateGs1DigitalLink(uri, options?)` | URI validation を non-throwing result として返す実装済み API。 |
| `normalizeGs1DigitalLink(uri, options?)` | URI を SpecQR deterministic policy で再構成する throwing API。 |

`validateGs1DigitalLink()` は `parseGs1DigitalLink()` の replacement ではありません。Throwing API は scripts / tests / strict workflows に向いており、validation API は UI / form / batch import で複数 error を扱いやすくするためのものです。

`normalizeGs1DigitalLink()` は `createGs1DigitalLink()` の replacement ではありません。Builder は element data から URI を作る API で、normalizer は既存 URI を parse して同じ supported AI metadata に沿って再出力する API です。

## Validation Result Policy

### Success

成功時は次を返します。

```js
{
  ok: true,
  result: {
    elements,
    primary,
    pathElements,
    queryElements,
    unknownQuery,
  },
  warnings
}
```

`warnings` は validation を失敗にしない注意です。初期候補は次です。

- `GS1_DIGITAL_LINK_HTTP`: URI が `http:` であり、transport security が必要な用途では `https:` が望ましい。
- `GS1_DIGITAL_LINK_UNKNOWN_QUERY_PRESERVED`: `unknownQuery: "preserve"` により non-GS1 query parameter を保持した。

### Failure

失敗時は次を返します。

```js
{
  ok: false,
  errors,
  warnings
}
```

`errors` は v2.1.0 の `GS1ValidationError` shape に合わせます。

```ts
type GS1ValidationError = {
  code: string;
  message: string;
  ai?: string;
  value?: string;
};
```

`InvalidGs1Error.code` は互換性のため既存どおり `"INVALID_GS1"` のままにし、non-throwing API の detail code で機械判別します。

## Error Codes

v2.2.0 の Digital Link validation では、v2.1.0 の GS1 detail code を再利用しつつ、URI 固有の code を最小限追加する方針です。

| ケース | Detail code |
| --- | --- |
| URI として不正、absolute URL ではない | `GS1_DIGITAL_LINK_INVALID_URI` |
| Scheme が `http:` / `https:` ではない | `GS1_DIGITAL_LINK_INVALID_URI` |
| Fragment がある | `GS1_DIGITAL_LINK_FRAGMENT_NOT_ALLOWED` |
| Percent encoding が不正 | `GS1_INVALID_PERCENT_ENCODING` |
| Unknown query を reject した | `GS1_DIGITAL_LINK_UNKNOWN_QUERY` |
| Unsupported AI | `GS1_UNSUPPORTED_AI` |
| Invalid length | `GS1_INVALID_LENGTH` |
| Invalid character set | `GS1_INVALID_CHARSET` |
| Invalid GTIN / SSCC check digit | `GS1_INVALID_CHECK_DIGIT` |
| Digital Link path に置けない AI | `GS1_INVALID_DIGITAL_LINK_PLACEMENT` |
| Duplicate AI | `GS1_DUPLICATE_AI` |
| 入力型が不正 | `GS1_INVALID_INPUT` |

`createGs1DigitalLink()` / `parseGs1DigitalLink()` は引き続き `InvalidGs1Error` を throw します。v2.2.0 実装時には、throwing API の message と validation detail code が対応するように unit tests を追加しますが、throwing API の public error class shape は変えません。

## Ambiguity Policy

GS1 Digital Link URI は path / query で AI が明示されるため、raw GS1 element string よりは曖昧さが少ないです。それでも次は推測しません。

- Supported primary AI は `00`, `01`, `414` だけ。
- Path は primary AI から AI/value pair として読む。
- Primary より前の path segment は URI stem として扱い、element data には含めない。
- Primary より後ろの path AI は dictionary の Digital Link role metadata で path eligible なものだけを許可する。
- Query key が 2-4 桁数字なら GS1 AI とみなし、unsupported AI は reject する。
- Non-numeric query key は `unknownQuery` として preserve するか、option で reject する。
- Duplicate AI は value が同じでも reject する。
- `linkType` など resolver / web vocabulary parameter の意味は解釈しない。

## Unknown Query Policy

Default は `unknownQuery: "preserve"` です。

- Validation success result は unknown query を `unknownQuery` に返す。
- Normalization は unknown query を元の相対順序で再出力する。
- Unknown query は sort しない。
- Unknown query の key/value は WHATWG `URLSearchParams` と同等の decode / encode を通るため、byte-for-byte preservation は保証しない。
- Strict な GS1-only URI が必要な場合は `unknownQuery: "reject"` を使う。

Unknown query を sort しない理由は、resolver extension parameter や web application parameter では同一 key の重複や順序に意味がある可能性があるためです。SpecQR は resolver ではないので、未知 parameter を勝手に canonicalize しません。

## Percent Encoding Policy

SpecQR deterministic normalization は、GS1 AI path / query values を次のように扱います。

- Path AI value は decode して validation した後、`encodeURIComponent()` 相当で再 encode する。
- Query AI value は decode して validation した後、`URLSearchParams` 相当で再 encode する。
- `/`, `?`, `#`, `&`, `=` など URI 構文と衝突する文字は literal structure として扱わない。
- Invalid percent escape は validation error にする。
- Percent hex digit の大小や space の `+` / `%20` 差は byte-level preservation しない。
- Unknown query は意味解釈しないが、normalization 時は URL API の query serialization policy に従う。

この方針は「安定した SpecQR output」を作るためのもので、GS1 Digital Link 標準全体の canonicalization を主張するものではありません。

## HTTP / HTTPS / Fragment Policy

- `http:` と `https:` を許可する。
- `http:` は validation failure にはせず warning にする。
- `ftp:` など他 scheme は reject する。
- Fragment は reject する。
- Host / scheme の case normalization は WHATWG `URL` に任せる。
- Normalization は `http` を `https` に強制変換しない。

`http:` を warning に留める理由は、private resolver、test environment、intranet の実務用途を壊さないためです。Security posture を強めたい caller は warning を policy error として扱えます。

## Deterministic Normalization Policy

`normalizeGs1DigitalLink(uri, options?)` は次の手順で URI を再構成します。

1. `parseGs1DigitalLink(uri, options)` と同じ validation source で URI を読む。
2. URI stem、primary element、path elements、query AI elements、unknown query を分ける。
3. Supported AI elements を current dictionary metadata に従って path / query に再配置する。
4. Query に置く GS1 AI は `ai`、同一 AI 内では `value` の lexical order で並べる。
5. Unknown query は default で元の相対順序を維持して末尾に付ける。
6. Trailing slash は `createGs1DigitalLink()` と同じく付けない。
7. GS1 AI values は decode 済み value から再 encode する。

Normalization は idempotent であるべきです。

```js
const first = normalizeGs1DigitalLink(uri);
const second = normalizeGs1DigitalLink(first);
console.assert(first === second);
```

ただし、これは SpecQR deterministic policy に対する idempotency であり、full GS1 canonical URI との一致を保証しません。

## Examples

### Throwing create / parse flow

```js
import {
  createGs1DigitalLink,
  parseGs1DigitalLink,
  parseGs1HumanReadable
} from "specqr";

const elements = parseGs1HumanReadable("(01)04912345678904(10)ABC123(17)251231");
const uri = createGs1DigitalLink(elements, { baseUrl: "https://example.com" });
const parsed = parseGs1DigitalLink(uri);
```

### Non-throwing validation

```js
import { validateGs1DigitalLink } from "specqr";

const result = validateGs1DigitalLink(
  "https://example.com/01/04912345678904/10/ABC123?17=251231&linkType=all"
);

if (result.ok) {
  console.log(result.result.elements);
  console.log(result.result.unknownQuery);
} else {
  console.log(result.errors[0].code);
}
```

### Deterministic normalization

```js
import { normalizeGs1DigitalLink } from "specqr";

const normalized = normalizeGs1DigitalLink(
  "https://example.com/01/04912345678904?17=251231&10=ABC123",
  { unknownQuery: "reject" }
);

console.log(normalized);
// "https://example.com/01/04912345678904/10/ABC123?17=251231"
```

### Invalid examples

```js
validateGs1DigitalLink("https://example.com/01/04912345678905");
// ok: false, GS1_INVALID_CHECK_DIGIT

validateGs1DigitalLink("https://example.com/01/04912345678904#frag");
// ok: false, GS1_DIGITAL_LINK_FRAGMENT_NOT_ALLOWED

validateGs1DigitalLink("https://example.com/01/04912345678904?linkType=all", {
  unknownQuery: "reject"
});
// ok: false, GS1_DIGITAL_LINK_UNKNOWN_QUERY
```

## Test Coverage

v2.2.0 runtime implementation では、少なくとも次を確認します。

- Root export と `QRCode` static method の existence / type tests。
- `validateGs1DigitalLink()` success result shape。
- `validateGs1DigitalLink()` failure result shape。
- `parseGs1DigitalLink()` throwing behavior が変わらないこと。
- `createGs1DigitalLink()` output が silent に変わらないこと。
- `http:` warning。
- `https:` no warning。
- Fragment reject。
- Invalid percent encoding reject。
- Unknown query preserve / reject。
- Unknown query order preservation。
- Repeated unknown query key preservation。
- Path AI と query AI の mixed placement。
- GS1 AI query lexical sort。
- Duplicate AI reject。
- Invalid path placement reject。
- Invalid GTIN / SSCC check digit reject。
- `validateGs1DigitalLink` packed package smoke。
- Digital Link validation / normalization example smoke。
- TypeScript declaration consumer check。
- `normalizeGs1DigitalLink` packed package smoke。
- `normalizeGs1DigitalLink()` の idempotency。

## Rejected Alternatives

- `parseGs1DigitalLink()` を non-throwing API に変える案: existing v2 API と user code を壊すため rejected。
- `normalizeGs1DigitalLink()` が metadata object を返す案: URI string を使いたい caller が多く、metadata は parse / validate result で取れるため initial API では rejected。
- Unknown query を default reject にする案: resolver extension や web app parameter の実務利用を壊しやすいため rejected。
- Unknown query を sort する案: duplicate key や extension parameter の順序を勝手に変えるため rejected。
- `http:` を reject する案: private/test resolver を壊すため warning に留める。
- `createGs1DigitalLink()` を full canonicalizer に変える案: existing output compatibility と scope を壊すため rejected。
- Full GS1 Digital Link canonicalizer を v2.2.0 に含める案: full catalog、resolver semantics、web vocabulary、industry profile が未固定のため rejected。

## Implementation Order

1. Internal helper で `parseGs1DigitalLink()` の throwing error を detail validation error に変換する。done.
2. `validateGs1DigitalLink()` root export と `QRCode` static method を追加する。done.
3. TypeScript declarations、unit tests、packed package smoke、docs examples を追加する。done.
4. Existing `createGs1DigitalLink()` / `parseGs1DigitalLink()` output regression tests を追加する。done.
5. `normalizeGs1DigitalLink()` root export と `QRCode` static method を追加する。done.
6. Full canonicalizer、resolver、compression は別 design に残す。

## Current Status

- `createGs1DigitalLink()` implemented.
- `parseGs1DigitalLink()` implemented.
- `validateGs1DigitalLink()` implemented / exported.
- `normalizeGs1DigitalLink()` implemented / exported.
- This document records the v2.2.0 validation and normalization implementation.
