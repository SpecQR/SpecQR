# テスト計画

## Unit Tests

- Bit buffer が指定 bit を正確に書き込むこと。
- UTF-8 byte encoding が ASCII と multi-byte characters を扱うこと。
- Numeric / alphanumeric mode selection が QR character set に従うこと。
- Shift_JIS-compatible Japanese text が QR Kanji mode を使えること。
- Mixed-segment optimization が byte / numeric / alphanumeric / kanji runs の bit length を減らすこと。
- Manual segments が呼び出し側の mode selection を保つこと。
- Binary input が UTF-8 text conversion を通らず byte mode になること。
- `ArrayBufferView` input が `byteOffset` と `byteLength` を尊重すること。
- Error correction boosting が、同じ Version に収まる場合だけ ECC を上げること。
- ECI metadata が leading control segment として追加され、decode 可能な output を保つこと。
- ECI capacity accounting が option-driven ECI、manual ECI segments、mixed segments、exact-fit payloads、max+1 `DataTooLongError` を覆うこと。
- GS1/FNC1 first position が `0101` mode indicator を encode し、diagnostics、API collision、supported human-readable parser、GS1 element-string helper を検証すること。
- FNC1 second position が `1001` mode indicator と 8-bit Application Indicator を encode し、option / manual segment、diagnostics、invalid combination rejection を検証すること。
- Structured Append low-level header が `0011` mode indicator、0-based sequence values、8-bit parity data を encode し、option / manual segment、diagnostics、invalid combination rejection を検証すること。
- Control segment model が ECI / FNC1 first / FNC1 second / Structured Append low-level header の output、capacity accounting、diagnostics、invalid combination rejection を保つこと。
- Kanji mode が Shift_JIS `TextDecoder` のない環境で明確に fallback / reject すること。
- Diagnostics が capacity、mask/version selection reasons、quiet-zone status、contrast、print hints、warnings を出すこと。
- Node helpers が PNG buffers を返し、PNG file を書き出すこと。
- Browser helpers が platform support のある環境で Blob/ImageData/Object URL output を返すこと。
- Examples smoke が Node PNG / GS1 SVG / GS1 Digital Link / Structured Append examples と browser/playground source files を確認すること。
- TypeScript consumer check が `specqr` root export、`specqr/node`、`specqr/browser` を compiler で検査し、v2 API と Node/browser helper declarations が consumer import で壊れていないことを確認すること。
- Nayuki reference comparison が fixed payload / fixed Version / fixed ECC / fixed mask の matrix exact match を確認すること。
- Root、Node、browser subpath exports が import 可能であること。
- Deterministic random payloads が matrix shape、capacity、masking、diagnostics invariants を満たすこと。
- Reed-Solomon arithmetic が安定した correction bytes を生成すること。
- Version capacity selection が fitting payloads を受け入れ、oversized payloads を reject すること。
- Matrix size が `21 + 4 * (version - 1)` に従うこと。
- Version range boundaries 9/10 と 26/27 で numeric、alphanumeric、byte、Kanji mode の character count indicator width が正しいこと。
- Fixed-version capacity edges で最大 payload を受け入れ、1 character / 1 byte 超過を reject すること。
- Mask penalty conformance が N1/N2/N3/N4 penalty rules と fixed/auto mask diagnostics consistency を覆うこと。
- SVG output が quiet zone と期待寸法を含むこと。
- PNG output が valid PNG signature と期待寸法を持つこと。
- SVG/PNG Data URL output が正しい media type を含むこと。
- Canvas drawing が canvas dimensions を設定し、background/modules を描画すること。

## Golden Tests

Golden tests は、fixed version、error correction level、mask settings のもとで deterministic な QR construction を固定します。目的は generated matrix と codeword stream の意図しない変化を検出することで、decoder validation の代替ではありません。

Golden fixtures は `fixtures/golden-cases.json` にあり、`tests/golden-conformance.test.js` で検証します。各 fixture は次を保持します。

- fixed input または manual segments
- fixed `version`, `errorCorrectionLevel`, `maskPattern`
- version、mask、capacity、segment bit lengths、codeword counts の diagnostics fields
- padded data codewords と final interleaved data/ECC codewords
- full matrix rows、SHA-256 hash、dark-module count
- independently computed format information bits
- version 7+ の independently computed version information bits
- function-module、data-module、remainder-bit counts

現在の golden coverage は、numeric、alphanumeric、byte URL、UTF-8 byte text、QR Kanji mode、manual mixed segments、ECI-prefixed UTF-8 byte text、ECI-prefixed auto mixed exact-fit fixture、GS1/FNC1 first-position exact-fit fixture、FNC1 second-position fixture、Structured Append low-level header fixture、Structured Append high-level fixed version / ECC / mask fixture、raw binary byte data、version information modules を使う version 7 symbol、version 10 / version 27 の exact-fit boundary fixtures を含みます。

Version boundary conformance は `tests/version-boundaries.test.js` でも検証します。この test は 1-9、10-26、27-40 の version ranges で numeric、alphanumeric、byte、Kanji mode の payload bit length を独立に計算し、automatic input と manual segments の両方を確認します。そのうえで fixed-version max payloads と max+1 `DataTooLongError` failure を検証します。

`tests/eci-mixed-capacity.test.js`、`tests/control-segments.test.js`、`tests/fnc1-second.test.js`、`tests/structured-append.test.js`、`tests/mask-penalty.test.js` は、ECI bit accounting、FNC1 second Application Indicator encoding、Structured Append sequence / total / parity encoding、control segment ordering / invalid combination、mixed-segment boundaries、individual mask penalty rules、auto/fixed mask diagnostics consistency を固定します。

GS1/FNC1 first-position coverage は `tests/gs1.test.js` にあります。raw element strings、manual FNC1 segments、supported human-readable parser cases、fixed/variable AI validation、separator insertion、invalid-input rejection を検証します。decoder によって FNC1 control mode や symbology identifier の露出方法が異なるため、GS1 semantics の唯一の根拠を decoder validation には置きません。

snapshot は QR construction change を意図的に受け入れる場合だけ再生成します。

```sh
npm run fixtures:golden
npm test
```

Golden tests は、すべての scanner が output image を受け入れることを証明しません。下記の Vision / jsQR decode checks と併せて解釈します。

## External Reference Comparison

固定条件の QR construction regression を検出するため、外部参照実装との matrix comparison を行います。

```sh
npm run verify:reference:nayuki
```

この script は devDependency の `nayuki-qr-code-generator@1.8.0` を使い、SpecQR と Nayuki に同じ fixed payload、fixed Version、fixed error correction level、fixed mask、fixed segment を渡して full matrix rows を比較します。現在の coverage は numeric、alphanumeric、byte、manual mixed segments、ECI + UTF-8 byte、raw binary byte data です。

Auto segmentation、auto mask selection、Kanji helper、GS1 semantics、renderer output、SpecQR diagnostics は参照比較の対象外です。これらは unit / golden / decoder validation で別に検証します。詳細は [External Reference Comparison](./reference-comparison.md) を参照してください。

## v2.0.0 Validation Planning

v2.0.0 の release scope は [SpecQR v2.0.0 Roadmap](./v2-roadmap.md) にまとめています。v2 では GS1 syntax layer、GS1 Digital Link、Structured Append、control segment model が増えるため、次の検証カテゴリを release gate に含めます。FNC1 second position、Structured Append low-level header、高レベル分割、manual segments 分割、decoded parts merge helper の基本 coverage は実装済みです。

- GS1 strict validation: current supported AI に限定して AI metadata、fixed / variable length、numeric / text constraints、separator insertion、GTIN / SSCC check digit、unsupported AI rejection を確認する。Supported AI metadata を広げる場合は、AI group ごとに validation と negative tests を追加する。
- GS1 Digital Link conversion: `createGs1DigitalLink()` の URL construction、baseUrl validation、dictionary role metadata based path/query placement、invalid path placement rejection、invalid GS1 value rejection、`parseGs1DigitalLink()` の path/query parsing、unknown query preservation、percent-decoding、round-trip を確認する。FNC1 first の raw GS1 element string と URL-based QR を混同しないことを固定する。現在の output は deterministic builder / normalizer であり、full canonicalization は未対応として docs に固定する。詳細な API proposal と validation policy は [GS1 Digital Link v2 Design](./gs1-digital-link-v2.md) と [GS1 Digital Link Validation v2.2 Design](./gs1-digital-link-validation-v2.2.md) を参照する。
- GS1 Digital Link future tests: full AI catalog metadata、canonicalization、resolver integration、compression、broader percent-encoding cases、industry-specific validation を確認する。Canonicalization を実装する場合は既存 builder output との互換性 test と migration test を追加する。
- Control segment ordering: ECI、FNC1 first、FNC1 second、Structured Append low-level header の内部 model は実装済み。新しい control mode を追加するときは、併用可否、ordering、capacity accounting、diagnostics を同じ model に載せ、既存 output が変わらないことを golden / regression tests で確認する。
- FNC1 second position: application indicator validation、bit length、encoding、diagnostics、negative cases は unit / golden tests で確認済み。今後は decoder ごとの symbology identifier 表示差を optional validation として整理する。
- Structured Append low-level: header encoding、sequence number、total count、parity、manual chunks は unit / golden fixtures で固定済み。
- Structured Append high-level: [Structured Append v2 API Design](./structured-append-v2.md) に固定した `generateStructuredAppend()` に従い、automatic splitting、最大 16 symbols、split failure、symbol diagnostics、original payload byte parity consistency、fixed version / ECC / mask golden fixture、packed package smoke を確認する。low-level header 利用者向けの parity helper は `calculateStructuredAppendParity(input)` で確認する。
- Structured Append manual segments: [Structured Append Manual Segments v2 API Design](./structured-append-segments-v2.md) に従い、`generateSegmentsStructuredAppend()` の segment-boundary split、byte segment chunking、numeric / alphanumeric / kanji atomic behavior、control segment rejection、canonical parity、per-symbol diagnostics、golden fixture、packed package smoke を確認する。
- Structured Append decoded parts merge: [Structured Append Scanning Workflow](./structured-append-scanning-v2.md) に従い、decoder が `index` / `total` / `parity` / unmerged data を返す場合だけ `mergeStructuredAppendParts()` で merge validation する。unit tests と packed package smoke では valid merge、shuffled parts、binary merge、missing symbol、duplicate index、total mismatch、parity mismatch、mixed data type を確認する。examples smoke では scanner adapter pattern、ZXing Java style metadata mapping、string / binary merge、metadata-less decoder の制限を確認する。metadata がない decoder では missing symbol、duplicate symbol、parity mismatch を検証できないため、外部 decoder merge は required CI gate にしない。
- Structured Append parity helper: v2.3.0 では [Structured Append Parity Helper v2.3](./structured-append-parity-v2.3.md) に従い、`calculateStructuredAppendParity(input)` の root export、`QRCode` static method、UTF-8 string、binary input、`ArrayBufferView` offset / length、`number[]` validation、empty input、invalid input、`generateStructuredAppend()` / `mergeStructuredAppendParts()` との parity consistency、TypeScript surface、packed package smoke を確認する。Manual segments 専用 helper は [Structured Append Manual Segments Parity Helper v2.3](./structured-append-segments-parity-v2.3.md) に従い、`calculateStructuredAppendSegmentsParity(segments)` の root export、`QRCode` static method、numeric / alphanumeric ASCII、byte string UTF-8、byte binary raw bytes、`ArrayBufferView` offset / length、Kanji UTF-8、control segment rejection、`generateSegmentsStructuredAppend()` との parity consistency、TypeScript surface、packed package smoke を確認する。
- Structured Append decoder metadata: [Structured Append Decoder Metadata Validation](./structured-append-decoder-validation-v2.md) に従い、ZXing Java / ZXing-C++ など metadata-returning decoder 候補を optional lane として検討する。jsQR / zbar / Vision は payload readability には使えるが、`mergeStructuredAppendParts()` の release gate には使わない。
- Golden fixtures: decoder 表示に依存しすぎず、matrix / codeword / diagnostics / control metadata を固定する。
- Decoder validation limits: FNC1 や Structured Append は decoder によって露出方法が異なるため、decode 成功だけを唯一の根拠にしない。
- Reference comparison limits: Nayuki comparison は fixed-condition matrix regression に使い、GS1 semantics、Digital Link conversion、Structured Append API shape の検証は unit / golden tests に分ける。

## v2.1.0 GS1 Validation

v2.1 系は [GS1 Validation v2.1 Design](./gs1-validation-v2.1.md) に固定した GS1 validation release として扱います。新しい QR generation behavior ではなく、GS1 helper の public validation surface を中心に次を release gate に含めます。

- Supported AI introspection: `getSupportedGs1Ais()` が stable public metadata shape を返し、internal dictionary object を mutation 可能な形で漏らさないこと。
- Single AI lookup: `getGs1AiInfo(ai)` が exact AI と supported family AI を扱い、unsupported AI を throw せず `null` として扱う方針を検証すること。
- Non-throwing element validation: `validateGs1Elements(elements, options?)` が `{ ok: true, elements, warnings }` と `{ ok: false, errors, warnings }` を安定して返すこと。
- Non-throwing raw element string validation: `validateGs1ElementString(input, options?)` が `parseGs1ElementString()` と同じ validation source を使い、成功時に `hasSeparators` を返すこと。
- Detail error codes: unsupported AI、invalid length、invalid charset、missing separator、unexpected separator、invalid check digit、invalid Digital Link placement、invalid input を negative tests で固定すること。
- Throwing API compatibility: `parseGs1HumanReadable()`、`createGs1ElementString()`、`parseGs1ElementString()`、`createGs1DigitalLink()`、`parseGs1DigitalLink()` の existing `InvalidGs1Error.code === "INVALID_GS1"` behavior を壊さないこと。
- GS1 QR Code / Digital Link misuse prevention: raw GS1 element string と URL-based Digital Link URI を混同した場合の validation result と docs を確認すること。
- Catalog expansion: AI group を追加するときは metadata、positive / negative validation、Digital Link role、docs、packed package smoke を同じ変更に含めること。
- TypeScript surface: proposed API の return shape と error/warning code literal type を consumer check で固定すること。
- Packed package smoke: new API が installed package root export と `QRCode` static method で動くこと、未公開にした API が漏れていないことを確認すること。

Digital Link full canonicalization と resolver は v2.2.0 以降の design として扱います。v2.1 系では `validateGs1Elements(elements, { context: "digital-link" })` の option surface だけを固定し、v2.2.0 で `validateGs1DigitalLink(uri, options?)` を public validation API として追加しました。

## v2.3.0 Structured Append Parity Helper

v2.3.0 は low-level `structuredAppend` 利用者向けの polish release として、public parity helper を追加します。設計と byte policy は [Structured Append Parity Helper v2.3](./structured-append-parity-v2.3.md) に固定しています。

release gate は次を含めます。

- root export と `QRCode.calculateStructuredAppendParity()` static method が存在すること。
- `string` input は UTF-8 bytes の XOR になること。
- `Uint8Array`、`ArrayBuffer`、`ArrayBufferView`、byte array input が original bytes の XOR になること。
- `ArrayBufferView` は `byteOffset` / `byteLength` を尊重すること。
- empty input は `0` を返すこと。
- invalid input と invalid byte array value は `InvalidInputError` になること。
- `generateStructuredAppend(input).parity` と helper の result が一致すること。
- `mergeStructuredAppendParts()` の parity validation と helper の byte policy が一致すること。
- TypeScript consumer check が helper の return type を `number` として扱えること。
- packed package smoke が root export と static method を installed package から確認すること。

Manual segments 専用 parity helper `calculateStructuredAppendSegmentsParity(segments, options?)` は v2.3.0 の追加 polish として実装済みです。`generateSegmentsStructuredAppend()` と同じ canonical logical message bytes を使い、ECI / FNC1 / GS1 / FNC1 second / low-level `structured-append` segment は reject します。

追加 release gate は次を含めます。

- root export と `QRCode.calculateStructuredAppendSegmentsParity()` static method が存在すること。
- numeric / alphanumeric segment は ASCII bytes の XOR になること。
- byte string segment は UTF-8 bytes、byte binary segment は raw bytes の XOR になること。
- `ArrayBufferView` は `byteOffset` / `byteLength` を尊重すること。
- Kanji segment は `generateSegmentsStructuredAppend()` と同じく original JavaScript string の UTF-8 bytes を使うこと。
- ECI / FNC1 first / FNC1 second / `structured-append` segment を reject すること。
- `generateSegmentsStructuredAppend(segments).parity` と helper の result が一致すること。
- TypeScript consumer check と packed package smoke が helper を確認すること。

## v2.2.0 GS1 Digital Link Validation / Normalization

v2.2.0 の Digital Link polish release は [GS1 Digital Link Validation v2.2 Design](./gs1-digital-link-validation-v2.2.md) に固定した方針を release gate にします。`validateGs1DigitalLink()` と `normalizeGs1DigitalLink()` は実装済みで、2.2.0 stable package の public API として扱います。

- Public export: `validateGs1DigitalLink()` / `QRCode.validateGs1DigitalLink()` と `normalizeGs1DigitalLink()` / `QRCode.normalizeGs1DigitalLink()` が root package と TypeScript declarations で一致すること。
- Validation result: 成功時 `{ ok: true, result, warnings }`、失敗時 `{ ok: false, errors, warnings }` の shape を固定すること。
- Throwing compatibility: `createGs1DigitalLink()` / `parseGs1DigitalLink()` の existing throw behavior と output が変わらないこと。
- Unknown query: default preserve、`unknownQuery: "reject"`、unknown query relative order preservation を確認すること。
- Percent encoding: GS1 AI path / query value の decode / validation / re-encode、invalid percent escape rejection を確認すること。
- URI policy: `http:` warning、`https:` success、other scheme rejection、fragment rejection を確認すること。
- Placement / duplicates: duplicate AI、path に置けない AI、invalid GTIN / SSCC check digit を detail error code で確認すること。
- Normalization: string return、idempotency、GS1 AI query lexical sort、unknown query の non-sorting policy、repeated unknown query key preservation、http を https に変換しない挙動、SpecQR deterministic policy と full canonicalizer の違いを unit / packed package smoke / examples smoke / docs で確認すること。
- Packed package smoke: installed package から new API と `QRCode` static method が動き、docs examples と TypeScript consumer check が通ること。

## v2.4.0 Planning / Diagnostics API

v2.4.0 の planning / diagnostics API は [Planning / Diagnostics API v2.4](./planning-diagnostics-v2.4.md) に実装済み contract として固定しています。新しい QR core math を重複実装せず、既存 planner と diagnostics helper を source of truth にします。

release gate は次を含めます。

- Public export: `estimate()` / `QRCode.estimate()`、`analyzeSegments()` / `QRCode.analyzeSegments()`、`getCapacity()` / `QRCode.getCapacity()` が root package と TypeScript declarations で一致すること。
- Input coverage: `estimate()` が string、`Uint8Array`、`ArrayBuffer`、`ArrayBufferView`、byte array を `generate()` と同じ byte policy で扱うこと。
- Manual segments coverage: `analyzeSegments()` が `numeric` / `alphanumeric` / `byte` / `kanji` / `eci` / `fnc1` / `fnc1-second` / `structured-append` segment の planning fields を `generateSegments()` と一致させること。
- Capacity success: `ok: true` result の `selectedVersion`、`errorCorrectionLevel`、`mode`、`segments`、`dataBitLength`、`capacityBits`、`remainingBits`、`capacityUtilization`、planning warnings が `generate(..., { diagnostics: true })` または `generateSegments(..., { diagnostics: true })` と一致すること。
- Capacity failure: fixed Version と auto range の oversized payload が `DataTooLongError` を throw せず、`{ ok: false, reason: "data-too-long" }`、`overflowBits`、比較可能な `capacityBits` を返すこと。
- Error behavior: invalid version、invalid mode、invalid GS1、invalid ECI、invalid color、invalid input type は既存 error class を投げること。
- `getCapacity()`: Version 1 / 9 / 10 / 26 / 27 / 40、ECC L/M/Q/H、numeric / alphanumeric / byte / kanji の `capacityBits`、`characterCountBits`、`payloadBits`、`maxCharacters` / `maxBytes` を固定すること。
- Warning surface: quiet zone、color contrast、alpha color、capacity near limit、print DPI、scan risk warnings が既存 diagnostics と同じ shape で返ること。Renderer output 依存の `RASTER_SCALE_SMALL` は planning API では返さないこと。
- Non-scope guard: high-level Structured Append splitting estimate、GS1 Digital Link semantic capacity、Micro QR / rMQR、styled modules / logo の API が漏れていないこと。
- TypeScript consumer check: `QREstimateResult` の discriminated union、`QRCapacityInfo`、warning / diagnostics fields を consumer import で検査すること。
- Packed package smoke: local packed package から root export と `QRCode` static variants を確認し、`getCapacity()` と overflow result の代表ケースを実行すること。
- Playground source: planning UI 表示が追加された場合、selected Version / usage ratio / warnings / overflow message が source smoke または browser check で壊れていないこと。

## Decoder Validation

より高い信頼性のため、generated SVG または rasterized output を少なくとも 1 つの独立 decoder で検証します。

### Required Baseline: macOS Vision

macOS では fixture-based Vision validation を実行できます。

```sh
npm run verify:decode
```

fixture set は、URL、numeric、alphanumeric、UTF-8 byte、ECI、auto Kanji、manual segments、manual Kanji segments、fixed version boundaries、error-correction boosting、ASCII binary payloads の SVG / PNG output を覆います。

### Required Independent Decoder: jsQR

release-gate independent decoder check は devDependency の `jsqr` を使います。

```sh
npm run verify:decode:jsqr
```

この script は `jsqr` が import できない場合に失敗し、対応 fixture artifact を decode できない場合も失敗します。すべての decode fixture の generated PNG output を検証します。ImageMagick `magick` が利用できる場合は、generated SVG output を PNG に render して検証します。

現在の jsQR fixture coverage は、URL、numeric、alphanumeric、UTF-8 byte、ECI text、auto Kanji、manual segments、manual Kanji segments、fixed version boundaries、error-correction boosting、ASCII binary payloads を含みます。jsQR は decoded data を text として返すため、arbitrary binary bytes は jsQR assertion の対象にしません。

## Optional Multi-Decoder Validation

追加の decoder validation は optional script として提供します。

```sh
npm run verify:decode:optional
```

この script はすべての decode fixture の PNG output を生成し、ImageMagick `magick` が利用できる場合は SVG output も PNG に render します。そのうえで、ローカル環境で使える decoder を実行します。

- `jsQR`: `jsqr` package が install されている場合。
- `zbarimg`: command が install されている場合。
- ZXing-style CLI commands: `ZXingReader`, `zxing`, `zxing-cpp`, `zxingscan` のいずれかが install されている場合。

これらの decoder は package の hard dependency ではありません。存在しない decoder は `skip` として報告され、script failure にはしません。少なくとも 1 つの optional decoder が利用できる場合、decode mismatch は failure になります。

Optional script は local release checks や decoder environment を制御できる CI job に向いています。portable baseline としては `npm test` と `npm run verify:decode:jsqr` を保ちます。

Structured Append の `index` / `total` / `parity` metadata を検証する prototype は、ZXing Java 向けの任意 script として追加しています。

```sh
npm run verify:structured-append:zxing-java
```

この check は `ZXING_CLASSPATH` に ZXing Java core jar/classes が指定され、`java` と `javac` が利用できる環境だけで実 decode を行います。`generateStructuredAppend()` の 2-symbol / 3-symbol string case、binary input case、`generateSegmentsStructuredAppend()` の segment boundary split / byte segment chunking case、fixed Version / ECC / mask deterministic case の PNG を一時生成し、ZXing Java の `STRUCTURED_APPEND_SEQUENCE` / `STRUCTURED_APPEND_PARITY` metadata から復元した `index` / `total` / `parity` を SpecQR diagnostics と照合します。ZXing Java がない環境や metadata が露出しない環境では skip として成功終了します。詳細は [Structured Append Decoder Metadata Validation](./structured-append-decoder-validation-v2.md) を参照してください。

この lane はまだ required CI gate にしません。既存の `verify:decode:optional` は payload readability 向けに保ち、metadata semantics を見る ZXing Java prototype は独立 script として扱います。

## CI

repository には GitHub Actions workflow `.github/workflows/ci.yml` があります。`package.json` の `engines.node: >=18` を実際の release gate にするため、Node 18 / 20 / 22 / 24 の matrix を使います。すべての Node version で次を実行します。

- `npm ci`
- `npm test`
- `npm run verify:types`
- `npm run examples:smoke`
- `npm run verify:pack`
- `npm ls --omit=dev`

重い / 環境依存 release gate は代表 Node 20 の job で実行します。

- `npm run pages:build`
- `npm run verify:decode`
- `npm run verify:decode:jsqr`
- `npm run verify:reference:nayuki`
- `npm run verify:structured-append:zxing-java`
- `npm pack --dry-run`

代表 Node を 20 にする理由は、v1 / v2 の既存 release lane と同じ比較軸を保ちつつ、Node 18 / 22 / 24 の engines claim は軽量 matrix で別に検証するためです。macOS Vision validation は Swift、Vision、ImageMagick に依存するため、この代表 Node job では macOS runner を使います。

## Examples / Playground

実利用導線の regression check として、Node examples は smoke script で実行します。

```sh
npm run examples:smoke
```

この check は Node PNG 保存 example、GS1 SVG example、GS1 Digital Link example、Structured Append string / binary SVG・PNG output example、TypeScript usage file、browser helper example、playground source files が実行または読み取り可能であることを確認します。

Playground は dependency-free な static files として提供し、local server で確認します。

```sh
npm run playground
```

Open `http://127.0.0.1:4173/playground/`.

GitHub Pages artifact は次で生成します。

```sh
npm run pages:build
```

Deploy は `Deploy Playground` workflow の手動実行で行います。push CI では artifact build までを確認し、外部公開は行いません。

## Published Package Smoke

pack した local package の install / import smoke は push CI と release 前の確認として実行します。

```sh
npm run verify:pack
```

この check は一時ディレクトリに `npm pack` した未公開 tarball を install し、root export から `parseGs1ElementString()` / `QRCode.parseGs1ElementString()`、`getSupportedGs1Ais()`、`getGs1AiInfo()`、`validateGs1Elements()`、`validateGs1ElementString()`、`validateGs1DigitalLink()`、`normalizeGs1DigitalLink()`、GS1 Digital Link helper、FNC1 second、Structured Append API、`specqr/node`、`specqr/browser` を実行します。`{ elements, hasSeparators }` の return shape、Digital Link を含む non-throwing validation result、deterministic normalization result、同梱 `src/index.d.ts` の v2 / v2.3 API surface、npm package contents policy も確認します。

TypeScript declaration regression は別 gate として `npm run verify:types` で確認します。この check は `tests/types/consumer.ts` を TypeScript compiler で `noEmit` 検査し、root / node / browser subpath import、`QRCode.generate()`、`generateSegments()`、GS1 raw parser、GS1 Digital Link helper、Structured Append helpers、FNC1 second option、low-level `structuredAppend` option、Node PNG helper、browser Blob/ImageData/Object URL helper の public type surface を consumer 目線で固定します。

公開済み npm package の install / import smoke は release 前後の確認として実行します。

```sh
npm run verify:published
```

この check は一時ディレクトリで `npm install specqr` と `npm install specqr@next` を実行し、root export、`specqr/node`、`specqr/browser`、GS1 helper が install 後に動くことを確認します。npm registry に依存するため通常 push CI には含めず、`Published Package Smoke` workflow で手動実行できるようにしています。

v2 系では published smoke でも、GS1 raw parser、GS1 Digital Link helper、FNC1 second position、Structured Append API の代表ケースを確認します。`latest` と `next` が同じ stable version を指している期間は、両方が同じ version に解決されることも確認します。
