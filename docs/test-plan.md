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

v2.0.0 の計画範囲は [SpecQR v2.0.0 Roadmap](./v2-roadmap.md) にまとめています。v2 では GS1 syntax layer、GS1 Digital Link、Structured Append、control segment model を追加する予定のため、次の検証カテゴリを release gate に加える方針です。FNC1 second position と Structured Append low-level header の基本 encoding / diagnostics / golden coverage は実装済みです。

- GS1 strict validation: current supported AI に限定して AI metadata、fixed / variable length、numeric / text constraints、separator insertion、GTIN / SSCC check digit、unsupported AI rejection を確認する。Supported AI metadata を広げる場合は、AI group ごとに validation と negative tests を追加する。
- GS1 Digital Link conversion: `createGs1DigitalLink()` の URL construction、baseUrl validation、dictionary role metadata based path/query placement、invalid path placement rejection、invalid GS1 value rejection、`parseGs1DigitalLink()` の path/query parsing、unknown query preservation、percent-decoding、round-trip を確認する。FNC1 first の raw GS1 element string と URL-based QR を混同しないことを固定する。現在の output は deterministic builder であり、full canonicalization は未対応として docs に固定する。詳細な API proposal と validation policy は [GS1 Digital Link v2 Design](./gs1-digital-link-v2.md) を参照する。
- GS1 Digital Link future tests: full AI catalog metadata、canonicalization、resolver integration、compression、broader percent-encoding cases、industry-specific validation を確認する。Canonicalization を実装する場合は既存 builder output との互換性 test と migration test を追加する。
- Control segment ordering: ECI、FNC1 first、FNC1 second、Structured Append low-level header の内部 model は実装済み。新しい control mode を追加するときは、併用可否、ordering、capacity accounting、diagnostics を同じ model に載せ、既存 output が変わらないことを golden / regression tests で確認する。
- FNC1 second position: application indicator validation、bit length、encoding、diagnostics、negative cases は unit / golden tests で確認済み。今後は decoder ごとの symbology identifier 表示差を optional validation として整理する。
- Structured Append low-level: header encoding、sequence number、total count、parity、manual chunks は unit / golden fixtures で固定済み。
- Structured Append high-level: [Structured Append v2 API Design](./structured-append-v2.md) に固定した `generateStructuredAppend()` に従い、automatic splitting、最大 16 symbols、split failure、symbol diagnostics、original payload byte parity consistency、fixed version / ECC / mask golden fixture、packed package smoke を確認する。public parity helper は初期実装では非スコープ。
- Structured Append manual segments: [Structured Append Manual Segments v2 API Design](./structured-append-segments-v2.md) に固定した proposal に従い、実装時は segment-boundary split、byte segment chunking、numeric / alphanumeric / kanji atomic behavior、control segment rejection、canonical parity、per-symbol diagnostics、golden fixture、packed package smoke を確認する。
- Golden fixtures: decoder 表示に依存しすぎず、matrix / codeword / diagnostics / control metadata を固定する。
- Decoder validation limits: FNC1 や Structured Append は decoder によって露出方法が異なるため、decode 成功だけを唯一の根拠にしない。
- Reference comparison limits: Nayuki comparison は fixed-condition matrix regression に使い、GS1 semantics、Digital Link conversion、Structured Append API shape の検証は unit / golden tests に分ける。

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

## CI

repository には minimal GitHub Actions workflow `.github/workflows/ci.yml` があります。実行内容は次の通りです。

- `npm ci`
- `npm test`
- `npm run examples:smoke`
- `npm run pages:build`
- `npm run verify:decode:jsqr`
- `npm run verify:reference:nayuki`
- `npm run verify:pack`
- `npm pack --dry-run`

macOS Vision validation は Swift、Vision、ImageMagick に依存するため、local/macOS release check として扱います。

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

この check は一時ディレクトリに `npm pack` した tarball を install し、root export から `parseGs1ElementString()` と `QRCode.parseGs1ElementString()` を実行します。`validateGs1ElementString()` が public export されていないこと、`{ elements, hasSeparators }` の return shape、invalid raw GS1 payload の `InvalidGs1Error`、同梱 `src/index.d.ts` の GS1 raw parser surface も確認します。TypeScript compiler pipeline は package の runtime / dev workflow を重くしないため導入せず、配布物に含まれる declaration text の軽量検査に留めています。

公開済み npm package の install / import smoke は release 前後の確認として実行します。

```sh
npm run verify:published
```

この check は一時ディレクトリで `npm install specqr` と `npm install specqr@next` を実行し、root export、`specqr/node`、`specqr/browser`、GS1 helper が install 後に動くことを確認します。npm registry に依存するため通常 push CI には含めず、`Published Package Smoke` workflow で手動実行できるようにしています。
