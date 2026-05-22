# GS1 Digital Link v2 Design

この文書は、SpecQR v2 系で追加する GS1 Digital Link helper の設計記録です。`createGs1DigitalLink(input, options)` と `parseGs1DigitalLink(uri, options?)` は実装済みです。resolver、compression、full canonicalizer はまだ実装していません。

参考にする外部仕様は [GS1 Digital Link Standard: URI Syntax 1.6.0](https://ref.gs1.org/standards/digital-link/uri-syntax/) と [GS1 Digital Link overview](https://www.gs1.org/standards/gs1-digital-link) です。SpecQR の v2 helper はこの仕様全体の完全実装ではなく、既存 GS1 element data から安全に URL QR を作るための小さな API layer として始めます。

## 一番大事な区別

SpecQR では、GS1 element string QR と GS1 Digital Link URI QR を別物として扱います。

| 用途 | 入力 | QR 生成時の option | QR 内の payload |
| --- | --- | --- | --- |
| GS1 QR Code / FNC1 first position | raw GS1 element string | `gs1: true` | `010491234567890410ABC123` など。先頭に QR FNC1 first position control mode を入れる。 |
| GS1 Digital Link URI | Web URI | `gs1: false` または省略 | `https://example.com/01/04912345678904/10/ABC123` など。通常 URL QR として生成する。 |

Digital Link URI は URL なので、`QRCode.generate(uri)` で通常 QR として encode します。`QRCode.generate(uri, { gs1: true })` は誤用です。v2 helper の docs と examples では、この違いが見えるように必ず両方の流れを並べます。

## Public API

### `createGs1DigitalLink(input, options)` implemented

GS1 element data から GS1 Digital Link URI string を作ります。

```ts
type GS1Element = { ai: string; value: string };

type GS1ElementStringParseResult = {
  elements: GS1Element[];
  hasSeparators: boolean;
};

function createGs1DigitalLink(
  input: GS1Element[] | GS1ElementStringParseResult,
  options: {
    baseUrl: string | URL;
    primaryAi?: "01" | "00" | "414";
    pathAis?: string[];
  }
): string;
```

`input` は `{ ai, value }[]` を第一級の形にします。`parseGs1HumanReadable()` と `parseGs1ElementString()` のどちらからでも自然につなげるため、`{ elements, hasSeparators }` の parse result も受け取れるようにします。`hasSeparators` は Digital Link URI construction には影響しません。

`baseUrl` は必須にします。`https://id.gs1.org` のような resolver domain を暗黙 default にしないことで、利用者が自分の brand domain / resolver domain / test domain を意識して選べるようにします。

`primaryAi` は `"01"` を default にします。対応 primary key は既存 dictionary の Digital Link role metadata で管理し、現時点では `"01"` GTIN、`"00"` SSCC、`"414"` GLN に絞ります。

`pathAis` は primary key の後ろに path segment として置く AI を指定します。指定がない場合、dictionary の Digital Link role metadata に従います。現行 dictionary では GTIN primary (`"01"`) の key qualifier として `"10"` batch/lot、`"21"` serial number、`"22"` consumer product variant を path に置き、それ以外の supported AI は data attribute として query string に置きます。`pathAis` は default placement より優先されますが、dictionary 上 path に置けない AI は `InvalidGs1Error` で reject します。path / query の完全な GS1 Digital Link semantic classification は、full AI catalog phase まで広げません。

`querySort` は v2 初期実装では `"lexical"` 固定です。canonical URI に近づけるため、query string の AI key は lexical order で並べます。`http` と `https` はどちらも許可しますが、`baseUrl` に query / fragment は含められません。

### `parseGs1DigitalLink(uri, options?)` implemented

GS1 Digital Link URI から GS1 element data を取り出します。

```ts
function parseGs1DigitalLink(
  uri: string | URL,
  options?: {
    primaryAi?: "01" | "00" | "414";
    unknownQuery?: "preserve" | "reject";
  }
): {
  elements: GS1Element[];
  primary: GS1Element | null;
  pathElements: GS1Element[];
  queryElements: GS1Element[];
  unknownQuery: Array<{ key: string; value: string }>;
};
```

`elements` は path elements と query AI elements を結合した配列です。`primary` は path 上の左端 primary key です。`pathElements` と `queryElements` を分けて返すことで、利用者は Digital Link URI 上で何が識別階層に入っていて、何が属性 query だったかを失わずに扱えます。

`unknownQuery` は GS1 AI として扱わない query parameter を `{ key, value }` で保持します。default は `"preserve"` です。`unknownQuery: "reject"` の場合は非 AI query parameter を `InvalidGs1Error` にします。SpecQR は resolver ではないため、linkType や custom extension parameter の意味付けは v2 初期 helper では行いません。

### まだ公開しない API

次は v2 初期 API には含めません。

- `validateGs1DigitalLink(uri)`
- resolver client / network API
- Digital Link compression / decompression
- resolver description file lookup
- `linkType` helper
- full GS1 AI catalog based canonicalizer

`parseGs1DigitalLink()` が成功すれば validation 済みの parse result を返し、失敗時は `InvalidGs1Error` を throw するため、boolean-only validator は最初の公開 API には不要と判断します。現時点では `validateGs1DigitalLink()` は public export していません。

## Supported v2 Scope

v2 初期実装では、次だけを対象にします。

- Uncompressed GS1 Digital Link URI のみ。
- `http` / `https` URI のみ。
- Primary key を path に置く。
- GTIN `(01)` を default primary key にする。
- SSCC `(00)` と GLN `(414)` は `primaryAi` option で primary key にできる。
- Additional supported AI は、dictionary metadata で key qualifier とされたものだけを path に置き、それ以外は query string に置く。
- Query string の AI key は lexical order で生成する。
- URL construction / parsing は WHATWG `URL` を使い、network access はしない。
- QR generation は `QRCode.generate(digitalLinkUri)` で通常 URL QR として行う。

v2 初期実装では、Digital Link URI が実際に resolver として応答するか、特定の industry profile に合っているか、linkType の解決結果が正しいかは確認しません。

## Validation Policy

### AI validation

AI と value の validation は既存 `src/gs1/ai-dictionary.js` の metadata を再利用します。

- Unsupported AI は default で `InvalidGs1Error`。
- Fixed-length AI は exact length を検証する。
- Variable-length AI は min / max length と character set を検証する。
- GTIN / SSCC は既存 check digit rule を使う。
- AI value は string として扱い、先頭ゼロを保持する。

full GS1 AI catalog ではないため、dictionary にない AI は「仕様上存在するかもしれないが SpecQR v2 初期 helper では未対応」として reject します。これにより、誤った URI を silent に生成するよりも安全側に倒します。

### Duplicate AI

v2 初期 API は duplicate AI を reject します。

GS1 resolver 文脈では、同じ AI が同じ value で重複する場合を許容する設計もあり得ます。ただし SpecQR の helper は deterministic construction と round-trip を優先するため、最初は duplicate をすべて `InvalidGs1Error` にします。必要になった場合だけ、将来 `duplicateAi: "allow-identical"` のような option を検討します。

### Path / query placement

`createGs1DigitalLink()` は primary AI を必ず path に置きます。primary AI と、primary に対して path eligible な key qualifier は dictionary metadata で管理します。

現行 dictionary の Digital Link role:

- Primary key: `00`, `01`, `414`
- Key qualifier for GTIN primary (`01`): `10`, `21`, `22`
- Data attribute: その他の supported AI

指定がない場合、GTIN `(01)` の path は `01`, `10`, `21`, `22` までに制限し、`17`, `30`, `37`, `310n`, `320n`, `240`, `241`, `400`, `410` から `426`, `9n` などは query に置きます。`parseGs1DigitalLink()` も同じ metadata を使い、path に置けない AI が primary 以降の path に出た場合は `InvalidGs1Error` にします。この分類は初期 helper の実務的な安全策であり、GS1 Digital Link の全 semantic classification を主張するものではありません。

### Unknown query params

`parseGs1DigitalLink()` の default は `unknownQuery: "preserve"` です。

- Numeric query key が dictionary にない場合は unsupported AI として reject。
- Non-numeric query key は extension parameter 候補として `unknownQuery` に `{ key, value }` として返す。
- `unknownQuery: "reject"` の場合は non-numeric query key も reject。

SpecQR は resolver ではないため、unknown query params を勝手に解釈しません。

### Percent encoding and normalization

`createGs1DigitalLink()` は AI values を path segment または query value として percent-encode します。

- `/`、`?`、`#`、`&`、`=` など URI 構文と衝突する文字は literal として置かず、percent-encoded value として扱う。
- `parseGs1DigitalLink()` は path segment と query value を percent-decode してから AI validation する。
- Invalid percent escape は `InvalidGs1Error`。
- Canonical output は trailing slash を付けない。
- `parseGs1DigitalLink()` は edge slash を除いた path から最初の supported primary AI を探す。primary より前の segments は URI stem として扱う。
- Host / scheme の case normalization は WHATWG `URL` に任せる。path AI と query AI は numeric string として扱う。

## Conversion Examples

### Human-readable to GS1 QR Code

```js
import { QRCode, createGs1ElementString, parseGs1HumanReadable } from "specqr";

const elements = parseGs1HumanReadable("(01)04912345678904(10)ABC123(17)251231");
const elementString = createGs1ElementString(elements);

const svg = QRCode.generate(elementString, {
  gs1: true,
  output: "svg"
});
```

これは GS1 QR Code / FNC1 first position です。Digital Link URI ではありません。

### Human-readable to GS1 Digital Link URI QR

```js
import { QRCode, createGs1DigitalLink, parseGs1HumanReadable } from "specqr";

const elements = parseGs1HumanReadable("(01)04912345678904(10)ABC123(17)251231");
const uri = createGs1DigitalLink(elements, {
  baseUrl: "https://example.com"
});

const svg = QRCode.generate(uri, {
  output: "svg"
});
```

これは通常 URL QR です。`gs1: true` は指定しません。

### Raw element string to Digital Link URI

```js
import { createGs1DigitalLink, parseGs1ElementString } from "specqr";

const parsed = parseGs1ElementString("010491234567890410ABC123\u001D17251231");
const uri = createGs1DigitalLink(parsed, {
  baseUrl: "https://example.com"
});
```

`parseGs1ElementString()` の result をそのまま渡せるようにし、raw element string と Digital Link URI の conversion path を明確にします。

### Digital Link URI to elements

```js
import { parseGs1DigitalLink } from "specqr";

const parsed = parseGs1DigitalLink("https://example.com/01/04912345678904/10/ABC123?17=251231");

console.log(parsed.primary);
console.log(parsed.elements);
```

返される `elements` は `createGs1ElementString(parsed.elements)` に渡せる形にします。ただし URI 上の path/query placement は `pathElements` と `queryElements` に残します。

## Rejected Choices

- `QRCode.generate(uri, { gs1DigitalLink: true })`: Digital Link URI は通常 URL QR であり、QR encoder に特別な control mode は不要です。QR generation option にすると、FNC1 first と混同しやすいため見送ります。
- `createGs1DigitalLink(rawElementString, options)`: raw string は separator ambiguity を持つため、まず `parseGs1ElementString()` で明示的に `{ ai, value }[]` へ変換させます。
- `baseUrl` default を `https://id.gs1.org` にする案: 便利ですが、resolver domain の選択を library が暗黙に決めてしまうため見送ります。
- Unknown query params を default reject する案: 厳格ですが、Digital Link resolver / web app 文脈では `linkType` など GS1 AI ではない query parameter を保持したい場面が多いため、default は preserve にします。数字 2-4 桁の key は GS1 AI として validation し、unsupported AI は reject します。
- Full canonicalizer を最初から提供する案: full AI catalog、より広い primary/key-qualifier metadata、industry profile が必要になり、v2 初期 scope を超えるため見送ります。

## Remaining Non-scope

- `validateGs1DigitalLink()` public API
- Network resolver / redirect / linkset lookup
- Resolver Description File lookup
- Digital Link compression / decompression
- Full GS1 Digital Link standard conformance claim
- Full GS1 AI catalog
- Industry-specific validation
- FNC1 second position
- Structured Append
- Micro QR / rMQR
- Logo overlay / styled modules

## Future Test Plan

実装済みの `createGs1DigitalLink()` / `parseGs1DigitalLink()` では、次を tests / smoke で確認しています。

- `createGs1DigitalLink()` constructs GTIN path URI.
- Dictionary role metadata based placement for primary key, key qualifier, and data attribute.
- Path qualifier placement for AI `10`, `21`, `22` when primary AI is `01`.
- Query attribute placement and lexical sorting.
- Invalid path placement rejection for data attributes.
- `QRCode.createGs1DigitalLink()` static API.
- `parseGs1ElementString()` result input.
- baseUrl required / invalid baseUrl rejection.
- Invalid GTIN / SSCC check digit rejection.
- Unsupported AI rejection.
- Duplicate AI rejection.
- Percent-encoding for `/` in path values.
- `parseGs1DigitalLink()` parses path and query AI elements.
- Human-readable -> elements -> Digital Link URI -> normal QR.
- Raw element string -> parser -> Digital Link URI.
- Digital Link URI -> elements -> element string round-trip.
- Unknown query preserve / rejection option.
- Percent-encoding parse cases for `/` in path values.
- `QRCode.generate(uri, { gs1: true })` misuse stays rejected through existing GS1 raw validator.

次フェーズでは、query/path placement metadata の full catalog 化、Digital Link canonicalization、resolver integration を検討します。

## Implementation Order

1. Add dictionary metadata for Digital Link roles: primary key, key qualifier, data attribute. (done for currently supported AI)
2. Add examples and playground copy that show GS1 QR Code and Digital Link QR side by side.
3. Revisit full canonicalization after broader AI catalog metadata exists.
4. Consider resolver / linkset integrations outside the core QR generator.
