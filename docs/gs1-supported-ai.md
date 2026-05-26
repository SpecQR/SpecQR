# Supported GS1 AIs

この文書は SpecQR が現在 validation する GS1 AI の一覧です。SpecQR の GS1 helper は、実用頻度の高い代表 AI を安全に扱うための小さな supported catalog です。**GS1 full AI catalog ではありません。**

QR に encode する payload は parentheses を含まない raw GS1 element string です。Human-readable 表記は `parseGs1HumanReadable()` で `{ ai, value }[]` に変換し、`createGs1ElementString()` で raw element string にします。外部から受け取った raw element string は `parseGs1ElementString()` で読み戻せます。

v2.1 系では、この catalog を一気に full GS1 AI catalog に広げるのではなく、AI group ごとに metadata、validation、negative tests、docs を揃えて拡張します。現在の supported AI は `getSupportedGs1Ais()` / `getGs1AiInfo(ai)` から public metadata として取得できます。Non-throwing validation API の方針は [GS1 Validation v2.1 Design](./gs1-validation-v2.1.md) に分けています。

## Public Introspection

`getSupportedGs1Ais()` はこの文書の supported AI を concrete entries として返します。AI family は `3100`-`3105`、`3200`-`3205`、`91`-`99` に展開済みです。`getGs1AiInfo(ai)` は 1 つの AI metadata を返し、unsupported AI は `null` を返します。どちらも internal dictionary object や正規表現は返しません。

## Separator Behavior

- Fixed-length AI は value length が決まっているため separator は不要です。
- Variable-length AI の後に別 AI が続く場合は ASCII GS separator (`"\x1D"`) が必要です。
- 最後の variable-length AI は separator なしを許可します。
- Raw element string は括弧がないため、variable-length value の末尾が supported AI に見える曖昧ケースは推測で分割せず reject します。

## Check Digit Validation

SpecQR は次を validation します。

- AI `00`: SSCC check digit
- AI `01`: GTIN check digit
- AI `02`: GTIN check digit

`appendGtinCheckDigit()`、`validateGtinCheckDigit()`、`appendSsccCheckDigit()`、`validateSsccCheckDigit()` も public helper として提供します。

## Digital Link Role

Digital Link helper は internal AI metadata の role を使い、default path/query placement を決めます。

- `primary-key`: Digital Link path の primary key 候補。
- `key-qualifier`: primary key に紐づく path qualifier 候補。
- `data-attribute`: query parameter 側に置く属性。

`createGs1DigitalLink()` / `parseGs1DigitalLink()` / `validateGs1DigitalLink()` / `normalizeGs1DigitalLink()` は supported AI 範囲に限定した helper です。Resolver、compression、full canonicalizer、full AI catalog validation は未対応です。

## Exact AI Entries

| AI | 内容 | Length | Value | Check digit | Digital Link role | Separator |
| --- | --- | --- | --- | --- | --- | --- |
| `00` | Serial shipping container code | fixed 18 | numeric | SSCC | primary-key | none |
| `01` | Global trade item number | fixed 14 | numeric | GTIN | primary-key | none |
| `02` | Contained trade item GTIN | fixed 14 | numeric | GTIN | data-attribute | none |
| `10` | Batch or lot number | variable 1-20 | printable ASCII | none | key-qualifier for `01` | required when followed |
| `11` | Production date | fixed 6 | numeric | none | data-attribute | none |
| `12` | Due date | fixed 6 | numeric | none | data-attribute | none |
| `13` | Packaging date | fixed 6 | numeric | none | data-attribute | none |
| `15` | Best before date | fixed 6 | numeric | none | data-attribute | none |
| `16` | Sell by date | fixed 6 | numeric | none | data-attribute | none |
| `17` | Expiration date | fixed 6 | numeric | none | data-attribute | none |
| `20` | Internal product variant | fixed 2 | numeric | none | data-attribute | none |
| `21` | Serial number | variable 1-20 | printable ASCII | none | key-qualifier for `01` | required when followed |
| `22` | Consumer product variant | variable 1-20 | printable ASCII | none | key-qualifier for `01` | required when followed |
| `30` | Variable count | variable 1-8 | numeric | none | data-attribute | required when followed |
| `37` | Count of contained trade items | variable 1-8 | numeric | none | data-attribute | required when followed |
| `240` | Additional product identification | variable 1-30 | printable ASCII | none | data-attribute | required when followed |
| `241` | Customer part number | variable 1-30 | printable ASCII | none | data-attribute | required when followed |
| `400` | Customer purchase order number | variable 1-30 | printable ASCII | none | data-attribute | required when followed |
| `410` | Ship to global location number | fixed 13 | numeric | none | data-attribute | none |
| `411` | Bill to global location number | fixed 13 | numeric | none | data-attribute | none |
| `412` | Purchased from global location number | fixed 13 | numeric | none | data-attribute | none |
| `413` | Ship for global location number | fixed 13 | numeric | none | data-attribute | none |
| `414` | Identification of a physical location | fixed 13 | numeric | none | primary-key | none |
| `415` | Global location number of the invoicing party | fixed 13 | numeric | none | data-attribute | none |
| `420` | Ship to postal code | variable 1-20 | printable ASCII | none | data-attribute | required when followed |
| `422` | Country of origin | fixed 3 | numeric | none | data-attribute | none |
| `424` | Country of processing | fixed 3 | numeric | none | data-attribute | none |
| `425` | Country of disassembly | fixed 3 | numeric | none | data-attribute | none |
| `426` | Country covering full process chain | fixed 3 | numeric | none | data-attribute | none |

## AI Families

| AI pattern | 内容 | Length | Value | Digital Link role | Separator |
| --- | --- | --- | --- | --- | --- |
| `3100`-`3105` | Net weight in kilograms | fixed 6 | numeric | data-attribute | none |
| `3200`-`3205` | Net weight in pounds | fixed 6 | numeric | data-attribute | none |
| `91`-`99` | Company internal information | variable 1-90 | printable ASCII | data-attribute | required when followed |

## v2.1.0 Catalog Expansion Plan

v2.1.0 の catalog 拡張は、既存表に AI を追加する前に public metadata shape と validation result を固定します。候補 group は次の順で検討します。

1. Date and product lifecycle AIs: 既存 `11`, `12`, `13`, `15`, `16`, `17` の `YYMMDD` semantics を error にするか warning にするかを先に固定します。
2. Quantity / measure families: `30`, `37`, `310n`, `320n` を起点に decimal indicator metadata を public `valueKind` へ出すかを決めます。
3. GLN / party / location AIs: `410` through `415` と `414` primary role を維持しつつ、追加 GLN group は Digital Link role と path placement tests を揃えてから広げます。
4. Geographic / origin AIs: `422`, `424`, `425`, `426` の numeric validation は維持し、国コード存在 validation は v2.1.0 ではまだ入れない候補です。

Full GS1 AI catalog、industry-specific validation、Digital Link full canonicalization は v2.1.0 の一括対象にはしません。GS1 Barcode Syntax Dictionary など外部 metadata を使う場合は、source URL、version、取得日、license / usage terms、NOTICE 要否、generated dictionary policy を先に docs に固定します。

## Non-Scope

- GS1 full AI catalog の完全実装。
- 業界別・用途別の追加 validation。
- GS1 Digital Link resolver。
- Digital Link compression。
- Full canonicalization。
- GS1 data source からの automatic code generation。
