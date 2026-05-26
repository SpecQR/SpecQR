# SpecQR v2 Roadmap

この文書は SpecQR `1.0.0` の公開後に、v2 系で何を強化し、何を意図的に入れないかを固定するための roadmap / readiness log です。v2 系は新しい QR family を一気に増やす release line ではなく、通常 QR Code Model 2 core の上に、GS1 syntax、QR control segments、Structured Append、検証体系を厚くする release line として扱います。

実装済み範囲は [Conformance Matrix](./conformance.md) と [Specification Scope](./spec-scope.md) を参照してください。GS1 raw element string parser の public API 設計は [GS1 v2 API](./gs1-v2-api.md) に、GS1 Digital Link helper の設計は [GS1 Digital Link v2 Design](./gs1-digital-link-v2.md) に、v2.1.0 の GS1 validation release 設計は [GS1 Validation v2.1 Design](./gs1-validation-v2.1.md) に、v2.2.0 の GS1 Digital Link validation / normalization 設計は [GS1 Digital Link Validation v2.2 Design](./gs1-digital-link-validation-v2.2.md) に、Structured Append high-level API の設計は [Structured Append v2 API Design](./structured-append-v2.md) に、manual segments 版は [Structured Append Manual Segments v2 API Design](./structured-append-segments-v2.md) に、読み取り側 workflow と `mergeStructuredAppendParts()` は [Structured Append Scanning Workflow](./structured-append-scanning-v2.md) に、metadata-returning decoder 候補は [Structured Append Decoder Metadata Validation](./structured-append-decoder-validation-v2.md) に分離して記録します。v2 以降の公開文書と開発記録の言語方針は [Project Language Policy](./project-language.md) に固定します。

## v2.0.0 の目的

- GS1/FNC1 first position に留まっている v1 の GS1 helper を、より厳密な GS1 syntax layer へ進める。
- GS1 Digital Link URI と FNC1 first position の GS1 element string を API と docs で明確に分ける。
- ECI、FNC1 first、FNC1 second、Structured Append を内部的に扱いやすい control segment model として整理する。
- FNC1 second position、Structured Append low-level header、Structured Append high-level splitting は実装済み。次はこれらの control features を崩さずに GS1 syntax / validation を広げる。
- v2 で増える control feature に対して、golden fixtures、decoder validation、reference comparison の限界を明記した検証体系を用意する。
- v2.0.0 正式準備前に、public API、docs、examples、playground、package contents、release gate の整合性を監査する。

## v1.0.0 からの自然な拡張点

SpecQR v1.0.0 は、通常 QR Code Model 2 generation、Kanji、ECI、FNC1 first position、限定 GS1 helper、renderer、diagnostics、Nayuki reference comparison を持っています。v2.0.0 ではこの土台を壊さず、既存の `generate()` / `generateSegments()` / helper API と互換性を保ちながら次の領域を伸ばします。

- v1 の partial GS1 helper を、AI catalog driven な parser / validator へ広げる。
- GS1 Digital Link helper は minimal create/parse + role metadata まで到達済みとして、full canonicalization は metadata 拡張後に検討する。
- ECI / FNC1 first / FNC1 second / Structured Append low-level header は同じ control segment 設計へ寄せた。
- Structured Append は low-level header encoding と high-level splitting API まで到達済み。

## v2.0.0 に含めるもの

| 領域 | v2.0.0 の到達点 |
| --- | --- |
| GS1 syntax layer | GS1 Application Identifier catalog、strict parser、fixed / variable length validation、GTIN / SSCC / representative AI validation の拡張。 |
| GS1 Digital Link | element data と Digital Link URI の変換 helper。現段階は minimal create/parse + role metadata。Full canonicalization、resolver、compression は後続 phase。 |
| Control segment model | ECI、FNC1 first、FNC1 second、Structured Append low-level header の ordering、capacity accounting、diagnostics を整理する内部 model は実装済み。 |
| FNC1 second position | application indicator validation、encoding、diagnostics、golden / negative tests は実装済み。 |
| Structured Append | low-level header encoding、manual chunks、高レベル `generateStructuredAppend()`、automatic splitting、manual segments 版 `generateSegmentsStructuredAppend()`、最大 16 symbols、parity consistency validation、読み取り後 parts 向け `mergeStructuredAppendParts()` は実装済み。string / binary 分割方針は [Structured Append v2 API Design](./structured-append-v2.md) に、manual segments 版は [Structured Append Manual Segments v2 API Design](./structured-append-segments-v2.md) に、scanner workflow と merge helper 境界は [Structured Append Scanning Workflow](./structured-append-scanning-v2.md) に、metadata-returning decoder 候補は [Structured Append Decoder Metadata Validation](./structured-append-decoder-validation-v2.md) に固定済み。 |
| Validation expansion | v2 feature 向け golden fixtures、bitstream / matrix checks、decoder validation の限界説明、reference comparison の対象外領域の明記。 |
| Docs / examples / playground | GS1 QR、GS1 Digital Link、FNC1 second、Structured Append を誤用しにくい examples と docs。Structured Append は string / binary generation example、scanner adapter / merge helper example、playground mode まで追加済み。 |

## v2.0.0 に含めないもの

次の機能は v2.0.0 の対象外です。通常 QR Code Model 2 の control feature 強化と混ぜると、release の焦点と検証範囲が広がりすぎるためです。

- Micro QR
- rMQR
- Frame QR
- SQRC
- Logo overlay
- Styled modules
- Other visual customization helpers
- CJS build
- Minified browser build
- npm publish / release automation changes

Micro QR / rMQR は symbol family が通常 QR Code Model 2 と異なるため、将来の別 package または別 major scope として扱います。Logo overlay / styled modules は scan-risk diagnostics と強く結びつくため、core ではなく `@specqr/styled` のような別 helper package 候補として扱います。

## 推奨実装順

1. **GS1 module refactor**: 既存 public API を維持しながら、GS1 helper の内部を parser、dictionary、check digit、element string builder に分ける。
2. **GS1 AI dictionary**: GS1 Application Identifier metadata を static runtime data として導入し、source attribution と license / NOTICE 方針を明確にする。
3. **Strict GS1 parser / validator**: bracketed human-readable input、unbracketed element string、raw element string の validation を拡張する。
4. **GS1 Digital Link helpers**: Digital Link URI と GS1 element data の相互変換を追加し、FNC1 first QR と通常 URL QR の違いを docs で固定する。Minimal create/parse + role metadata は完了済みとし、canonicalization は supported AI metadata 拡張後に扱う。
5. **Control segment model refactor**: ECI / FNC1 first の挙動を保ったまま、FNC1 second / Structured Append を載せられる internal model に整理する。完了済み。
6. **FNC1 second position**: API、validation、diagnostics、golden fixtures、negative tests を追加する。完了済み。
7. **Structured Append low-level**: header encoding、sequence / total / parity、manual chunks を golden fixtures で固定する。完了済み。
8. **Structured Append high-level design**: automatic splitting API、capacity handling、diagnostics、parity policy、failure modes を docs に固定する。完了済み。
9. **Structured Append high-level implementation**: `generateStructuredAppend()`、capacity handling、diagnostics、failure modes を追加する。完了済み。
10. **Structured Append manual segments design**: `generateSegmentsStructuredAppend()` の segment boundary policy、byte segment chunking、parity、diagnostics、negative cases を docs に固定する。完了済み。
11. **Structured Append manual segments implementation**: docs に固定した設計に従い、runtime API、tests、packed smoke を追加する。完了済み。
12. **Structured Append scanner workflow design**: decoder metadata 依存の限界、missing / duplicate / parity mismatch handling、`mergeStructuredAppendParts(parts, options?)` API の境界を docs に固定する。完了済み。
13. **Structured Append decoder metadata validation design**: ZXing Java / ZXing-C++ / zbar / jsQR / Vision などを調査し、metadata-returning decoder fixture と future optional lane の条件を docs-only で固定する。完了済み。
14. **Project language policy**: v2 以降の README / docs / CHANGELOG / release notes / commit messages / PR-style summaries を日本語メインにする方針を固定する。完了済み。
15. **v2 validation expansion**: golden、decoder、optional external validation、reference comparison docs を v2 features に合わせて更新する。完了済み。
16. **v2 examples / playground / docs**: GS1 strict validation、Digital Link、FNC1 second、Structured Append の利用導線を整える。完了済み。
17. **v2 release readiness audit**: package version を変えずに public API surface、docs、CHANGELOG、package contents、examples、playground、release gate を監査する。完了済み。

## Progress Notes

- 2026-05-22: GS1 module refactor completed. `src/gs1.js` は互換 entrypoint として残し、内部実装を `src/gs1/` 配下の AI metadata、parser、element string builder、check digit helper に分割しました。public API と runtime behavior は v1.0.0 互換を維持します。
- 2026-05-22: GS1 AI dictionary foundation completed. v1 で対応済みの AI metadata を internal dictionary として整理し、validation は dictionary lookup を経由するようにしました。full GS1 AI catalog、GS1 Digital Link、strict parser 拡張は未導入です。
- 2026-05-22: Internal strict GS1 element string validation groundwork completed. raw element string を dictionary metadata で scan / validate する internal validator を追加しました。public `parseGs1ElementString()` API、GS1 Digital Link、FNC1 second position は未導入です。
- 2026-05-22: Internal GS1 raw validation integrated into generation. `generate(input, { gs1: true })` は raw GS1 element string を内部 validator に通し、diagnostics には `gs1Validation` metadata を追加しました。public parser API と package exports は変更していません。
- 2026-05-23: Public GS1 raw parser API implemented. `parseGs1ElementString(input)` を root export と `QRCode.parseGs1ElementString(input)` に追加し、return shape、error behavior、ambiguity policy、rejected alternatives を `docs/gs1-v2-api.md` に整理しました。この時点では `validateGs1ElementString()` は public API ではありませんでしたが、v2.1 validation API として後続実装済みです。
- 2026-05-23: GS1 Digital Link v2 design documented. `createGs1DigitalLink(elements, options)` と `parseGs1DigitalLink(uri, options?)` の API proposal、FNC1 first GS1 QR と通常 URL QR の区別、validation policy、conversion examples、non-scope を `docs/gs1-digital-link-v2.md` に固定しました。
- 2026-05-23: GS1 Digital Link URI builder implemented. `createGs1DigitalLink(input, options)` を root export と `QRCode.createGs1DigitalLink()` に追加し、supported AI validation、baseUrl validation、path/query placement、packed package smoke を追加しました。
- 2026-05-23: GS1 Digital Link URI parser implemented. `parseGs1DigitalLink(uri, options?)` を root export と `QRCode.parseGs1DigitalLink()` に追加し、path/query parsing、unknown query preservation、percent-decoding、builder/parser round-trip、packed package smoke を追加しました。
- 2026-05-23: GS1 Digital Link role metadata integrated. 現行 supported AI の dictionary に `primary-key` / `key-qualifier` / `data-attribute` を追加し、`createGs1DigitalLink()` / `parseGs1DigitalLink()` の default path/query placement と invalid path placement rejection を catalog-driven にしました。
- 2026-05-23: GS1 Digital Link canonical policy documented. 現在の output は full canonicalizer ではなく deterministic builder として固定し、baseUrl normalization、path/query placement、unknown query、percent encoding、supported AI metadata expansion plan を `docs/gs1-digital-link-v2.md` に整理しました。次の大きな実装は control segment model refactor に進みます。
- 2026-05-23: Internal control segment model refactor completed. ECI / FNC1 first の既存挙動を保ったまま、control segment validation、option-driven prepend、bit length、encoding、diagnostic helpers を `src/encoding/control-segments.js` に集約しました。Public API は増やしていません。次は FNC1 second position の validation / encoding design に進めます。
- 2026-05-23: FNC1 second position implemented. `fnc1Second` option と manual `{ mode: "fnc1-second", applicationIndicator }` を追加し、2 桁数字 / 1 文字 Latin alphabetic Application Indicator validation、8-bit codeword encoding、diagnostics、golden fixture、negative tests を追加しました。ECI との併用は安全側で reject します。
- 2026-05-23: Structured Append low-level header implemented. `structuredAppend` option と manual `{ mode: "structured-append", index, total, parity }` を追加し、1-based public index、2..16 total、0..255 parity validation、0-based sequence encoding、diagnostics、golden fixture、negative tests を追加しました。ECI / FNC1 first / FNC1 second との併用は安全側で reject します。この時点では自動分割と parity 自動計算は未実装でした。
- 2026-05-23: Structured Append high-level API design documented. `generateStructuredAppend(input, options)` / `QRCode.generateStructuredAppend(input, options)` の proposal、return shape、string / binary initial scope、greedy split strategy、original payload byte parity、diagnostics、error behavior、release gate を `docs/structured-append-v2.md` に固定しました。この時点では runtime behavior と package exports は変更していません。
- 2026-05-23: Structured Append high-level API implemented. `generateStructuredAppend(input, options)` と `QRCode.generateStructuredAppend(input, options)` を追加し、string / binary input、greedy largest-fitting split、最大 16 symbols、original payload byte parity、top-level diagnostics、fixed version / ECC / mask golden fixture、packed package smoke を追加しました。この時点では ECI / GS1 / FNC1 との併用、manual segments splitting、public parity helper、decode / merge helper は未対応でした。
- 2026-05-23: Structured Append examples and playground support added. `examples/structured-append.mjs` で string / binary input の自動分割、SVG / PNG symbol output、summary diagnostics を smoke し、playground に `Structured Append` mode、maxSymbols / ECC / Version controls、multi-symbol preview、per-symbol downloads、warnings display を追加しました。QR core と splitting logic は変更していません。
- 2026-05-23: Structured Append manual segments API designed. `generateSegmentsStructuredAppend(segments, options)` / `QRCode.generateSegmentsStructuredAppend(segments, options)` の docs-only proposal を `docs/structured-append-segments-v2.md` に追加しました。初期方針は segment boundary split を基本にし、byte segment のみ safe chunking を許可し、numeric / alphanumeric / kanji の途中分割、ECI / GS1 / FNC1 併用、runtime implementation は未対応です。
- 2026-05-23: Structured Append manual segments API implemented. `generateSegmentsStructuredAppend(segments, options)` と `QRCode.generateSegmentsStructuredAppend(segments, options)` を追加し、segment boundary first split、byte segment safe chunking、canonical payload byte parity、per-symbol diagnostics、golden fixture、packed package smoke を追加しました。ECI / GS1 / FNC1 併用、numeric / alphanumeric / kanji mid-segment splitting、public parity helper、decode / merge helper は未対応です。
- 2026-05-23: Structured Append scanner workflow documented. decoder が Structured Append metadata を返す場合と返さない場合の読み取り workflow、missing / duplicate / total mismatch / parity mismatch handling、将来候補の `mergeStructuredAppendParts(parts, options?)` API、core helper に入れる判断材料を `docs/structured-append-scanning-v2.md` に docs-only で固定しました。runtime behavior と package exports は変更していません。
- 2026-05-23: Structured Append decoder metadata validation researched. ZXing Java、ZXing-C++、zbar、jsQR、macOS Vision、Scandit の Structured Append metadata 露出を整理し、metadata-returning fixture の第一候補、optional validation lane、`mergeStructuredAppendParts()` 実装前の preconditions を `docs/structured-append-decoder-validation-v2.md` に docs-only で固定しました。runtime behavior と package exports は変更していません。
- 2026-05-23: Project language policy documented. v2 以降の README / docs / CHANGELOG / GitHub Release notes / commit messages / PR-style summaries / Codex final reports を日本語メインにし、package metadata や API names など最低限の英語導線を残す方針を `docs/project-language.md` に固定しました。
- 2026-05-23: Structured Append ZXing Java metadata prototype added and expanded. `npm run verify:structured-append:zxing-java` を追加し、`ZXING_CLASSPATH`、`JAVA`、`JAVAC` が揃う環境だけで string / binary / manual segment split / byte chunking / fixed deterministic PNG を ZXing Java で読み、sequence indicator から復元した `index` / `total` と parity を SpecQR diagnostics と照合できるようにしました。runtime dependency と required CI gate は増やしていません。
- 2026-05-23: Structured Append merge helper implemented. `mergeStructuredAppendParts(parts, options?)` と `QRCode.mergeStructuredAppendParts(parts, options?)` を追加し、decoder が返した `{ index, total, parity, data }` parts に対して missing、duplicate、total mismatch、parity mismatch、string/binary 混在、merged payload byte parity を検証して結合できるようにしました。QR decoder、scanner integration、public parity helper、runtime dependency は追加していません。
- 2026-05-23: Structured Append scanner adapter examples documented. `examples/structured-append-merge.mjs` を追加し、ZXing Java style metadata から `{ index, total, parity, data }` parts を作る adapter pattern、string / binary merge、shuffled scan order、missing / duplicate / parity mismatch、metadata-less decoder の制限を examples smoke で確認するようにしました。Core API と runtime dependency は変更していません。
- 2026-05-23: v2.0.0 release readiness audit completed. README、API docs、spec scope、conformance matrix、test plan、release checklist、CHANGELOG を v2 candidate state に合わせ、v2.0.0 release gate を明確化しました。新機能、runtime dependency、npm publish、GitHub Release は追加していません。
- 2026-05-23: v2.0.0-rc.1 release finalization started. `package.json` / `package-lock.json` の version を `2.0.0-rc.1` に揃え、npm `next` tag 向け dry-run、package contents、tag 作成を release gate として扱います。実 publish、GitHub Release、GitHub Pages deploy は手動判断まで行いません。
- 2026-05-25: v2.0.0 stable release package preparation completed. `package.json` / `package-lock.json` の version を `2.0.0` に揃え、README、CHANGELOG、release checklist、scope / conformance docs を stable 向けに更新しました。npm publish、GitHub Release、GitHub Pages deploy、`v2.0.0` tag 作成は最終承認まで行いません。
- 2026-05-25: v2.0.1 release hygiene patch prepared. Runtime と public API は変更せず、package version、CHANGELOG、release checklist、SECURITY / CONTRIBUTING、supported GS1 AI docs、published package smoke coverage を整理しました。`latest` / `next` が stable に揃っている状態を docs と release checklist に反映しました。
- 2026-05-25: v2.1.0 GS1 validation release designed. Runtime behavior、public API、package version は変更せず、supported AI introspection、non-throwing validation result、GS1 detail error codes、Digital Link misuse prevention、catalog expansion policy を [GS1 Validation v2.1 Design](./gs1-validation-v2.1.md) に docs-only で固定しました。
- 2026-05-25: v2.1.0 GS1 validation API implemented. `getSupportedGs1Ais()`、`getGs1AiInfo(ai)`、`validateGs1Elements()`、`validateGs1ElementString()` と対応する `QRCode` static methods を追加し、TypeScript surface、unit tests、packed package smoke に含めました。`validateGs1DigitalLink()`、Digital Link canonicalization、full GS1 AI catalog は未公開のままです。
- 2026-05-25: v2.1.0 stable release package prepared. `package.json` / `package-lock.json` の version を `2.1.0` に揃え、CHANGELOG、README、API / release docs を stable publish 前提に整理しました。npm publish、GitHub Release、GitHub Pages deploy、`v2.1.0` tag 作成は最終承認まで行いません。
- 2026-05-26: v2.2.0 GS1 Digital Link validation / normalization design documented. Runtime behavior、public API、package version は変更せず、`validateGs1DigitalLink(uri, options?)`、`normalizeGs1DigitalLink(uri, options?)`、unknown query、percent encoding、http / https、fragment、duplicate AI、full canonicalizer との違いを [GS1 Digital Link Validation v2.2 Design](./gs1-digital-link-validation-v2.2.md) に docs-only で固定しました。
- 2026-05-26: v2.2.0 GS1 Digital Link validation API implemented. `validateGs1DigitalLink(uri, options?)` と `QRCode.validateGs1DigitalLink(uri, options?)` を追加し、throwing `parseGs1DigitalLink()` とは別に `{ ok, result, errors, warnings }` の non-throwing result を返すようにしました。この時点では `normalizeGs1DigitalLink()`、full canonicalizer、resolver、compression は未公開でした。
- 2026-05-26: v2.2.0 GS1 Digital Link normalization API implemented. `normalizeGs1DigitalLink(uri, options?)` と `QRCode.normalizeGs1DigitalLink(uri, options?)` を追加し、SpecQR deterministic policy に基づく URI string 再出力、idempotency、unknown query preserve / reject、packed package smoke、TypeScript surface を確認しました。Full canonicalizer、resolver、compression は未公開のままです。

## v2.1.0 GS1 Validation Release Scope

v2.1.0 は、新しい QR symbol family や Structured Append 追加ではなく、v2.0 で入った GS1 layer を利用者が安全に扱うための validation release です。

### Public API

- `getSupportedGs1Ais()`: current supported AI catalog を public metadata shape で返す。
- `getGs1AiInfo(ai)`: 1 つの AI の metadata を返す。unsupported AI は `null`。
- `validateGs1Elements(elements, options?)`: `{ ai, value }[]` を non-throwing result で検証する。
- `validateGs1ElementString(input, options?)`: raw GS1 element string を non-throwing result で検証する。

`validateGs1DigitalLink(uri, options?)` は v2.1.0 では公開しません。Digital Link は canonicalization、resolver、unknown query、path placement policy の surface が広いため、v2.2.0 以降で別 design として扱います。

### Stable Result Shape

Validation API は、成功時に `{ ok: true, elements, warnings }`、失敗時に `{ ok: false, errors, warnings }` を返します。`validateGs1ElementString()` の成功 result はこれに `hasSeparators` を加えます。Throwing API は既存どおり `InvalidGs1Error` を投げ、non-throwing API は UI / form validation 用に detail error code を返します。

### Detail Error Codes

v2.1.0 で固定する detail code は次です。

- `GS1_UNSUPPORTED_AI`
- `GS1_INVALID_LENGTH`
- `GS1_INVALID_CHARSET`
- `GS1_MISSING_SEPARATOR`
- `GS1_UNEXPECTED_SEPARATOR`
- `GS1_INVALID_CHECK_DIGIT`
- `GS1_INVALID_DIGITAL_LINK_PLACEMENT`
- `GS1_INVALID_INPUT`

Existing `InvalidGs1Error.code` は互換性のため `"INVALID_GS1"` のまま維持します。

### Catalog Expansion Policy

v2.1.0 は supported AI catalog を一括で full catalog にしません。Date / lifecycle、quantity / measure、GLN / party、origin / geographic のような AI group ごとに metadata、validation、negative tests、docs、Digital Link role を揃えてから追加します。GS1 Barcode Syntax Dictionary など外部 metadata を使う場合は、source、version、license / usage terms、generated data policy を先に固定します。

## v2.2.0 GS1 Digital Link Polish Scope

v2.2.0 は、新しい QR control mode や symbol family ではなく、v2.0 / v2.1 で入った GS1 Digital Link helper を実務で扱いやすくする polish release として扱います。

### Proposed Public API

- `validateGs1DigitalLink(uri, options?)`: URI を non-throwing validation result として検証する。実装済み。
- `QRCode.validateGs1DigitalLink(uri, options?)`: root function と同じ static method。実装済み。
- `normalizeGs1DigitalLink(uri, options?)`: URI を SpecQR deterministic policy で再構成し、string を返す。実装済み。
- `QRCode.normalizeGs1DigitalLink(uri, options?)`: root function と同じ static method。実装済み。

### Stable Policy

- `parseGs1DigitalLink()` は throwing parser のまま維持する。
- `createGs1DigitalLink()` の既存 output は silent に変えない。
- Validation result は成功時 `{ ok: true, result, warnings }`、失敗時 `{ ok: false, errors, warnings }` にする。
- Normalization は metadata object ではなく string を返す。
- Unknown query は default preserve、strict mode では reject とする。
- Unknown query は sort せず、元の相対順序を維持する。
- Percent-encoded GS1 AI values は decode / validate / re-encode する。
- `http:` は warning、`https:` は通常成功、他 scheme と fragment は reject する。
- Duplicate AI、invalid Digital Link placement、invalid GTIN / SSCC check digit は detail error code で区別する。

### Non-scope

- Full GS1 Digital Link canonicalizer。
- Resolver / network API。
- Compression / decompression。
- `linkType` や web vocabulary の semantic helper。
- Full GS1 AI catalog。
- Industry profile validation。

## Release Gate

v2.0.0 の正式 release では、少なくとも次を通すことを release gate とします。

- `npm test`
- `npm run verify:types`
- `npm run examples:smoke`
- `npm run pages:build`
- `npm run verify:decode`
- `npm run verify:decode:jsqr`
- `npm run verify:reference:nayuki`
- `npm run verify:pack`
- `npm run verify:structured-append:zxing-java`
- `npm pack --dry-run`
- `npm publish --dry-run --tag latest`
- Node 18 / 20 / 22 / 24 GitHub Actions matrix
- v2 feature 向け golden fixtures
- published package smoke
- GitHub Actions green

Structured Append や FNC1 second は decoder によって露出方法が異なる可能性があるため、decoder validation だけを唯一の根拠にしません。control segment bit length、matrix / codeword golden fixtures、diagnostics、negative tests を組み合わせて release gate とします。Structured Append の読み取り後 merge validation は `mergeStructuredAppendParts()` の unit / packed smoke で検証し、外部 decoder metadata validation は [Structured Append Decoder Metadata Validation](./structured-append-decoder-validation-v2.md) に固定した optional lane として扱います。ZXing Java metadata prototype は任意 local check として扱い、required CI gate にはまだ含めません。FNC1 second と Structured Append low-level header の基本 coverage は実装済みです。

## v1 Compatibility Requirements

v2 実装の各段階では、次を壊さないことを前提にします。

- `QRCode.generate()` / `generate()` の通常 text / binary input behavior。
- `QRCode.generateSegments()` / `generateSegments()` の既存 segment shape。
- `eci: true` と manual ECI segment の既存挙動。
- `gs1: true` と manual `{ mode: "fnc1" }` の FNC1 first behavior。
- `parseGs1HumanReadable()` / `createGs1ElementString()` / check digit helpers の既存利用例。
- root / `specqr/node` / `specqr/browser` subpath exports。
- runtime dependency-free policy。
- ESM-first package policy。

破壊的変更が必要な場合は、v2 の major として理由を docs と CHANGELOG に明記し、migration guide を用意します。ただし v2.0.0 の基本方針は、v1 API を保ちながら厳密性と optional features を増やすことです。

## ISO/IEC 18004:2024 Notes

SpecQR は ISO/IEC 18004:2024 の全文に対する完全準拠をここでは主張しません。通常 QR Code Model 2 generation の実装・検証範囲を明確にし、Micro QR、rMQR などの未対応領域を段階的に扱います。ISO 本文や仕様表は repository にコピーしません。
