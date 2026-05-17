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
- Kanji mode が Shift_JIS `TextDecoder` のない環境で明確に fallback / reject すること。
- Diagnostics が capacity、mask/version selection reasons、quiet-zone status、contrast、print hints、warnings を出すこと。
- Node helpers が PNG buffers を返し、PNG file を書き出すこと。
- Browser helpers が platform support のある環境で Blob/ImageData/Object URL output を返すこと。
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

現在の golden coverage は、numeric、alphanumeric、byte URL、UTF-8 byte text、QR Kanji mode、manual mixed segments、ECI-prefixed UTF-8 byte text、ECI-prefixed auto mixed exact-fit fixture、GS1/FNC1 first-position exact-fit fixture、raw binary byte data、version information modules を使う version 7 symbol、version 10 / version 27 の exact-fit boundary fixtures を含みます。

Version boundary conformance は `tests/version-boundaries.test.js` でも検証します。この test は 1-9、10-26、27-40 の version ranges で numeric、alphanumeric、byte、Kanji mode の payload bit length を独立に計算し、automatic input と manual segments の両方を確認します。そのうえで fixed-version max payloads と max+1 `DataTooLongError` failure を検証します。

`tests/eci-mixed-capacity.test.js` と `tests/mask-penalty.test.js` は、ECI bit accounting、mixed-segment boundaries、individual mask penalty rules、auto/fixed mask diagnostics consistency を固定します。

GS1/FNC1 first-position coverage は `tests/gs1.test.js` にあります。raw element strings、manual FNC1 segments、supported human-readable parser cases、fixed/variable AI validation、separator insertion、invalid-input rejection を検証します。decoder によって FNC1 control mode や symbology identifier の露出方法が異なるため、GS1 semantics の唯一の根拠を decoder validation には置きません。

snapshot は QR construction change を意図的に受け入れる場合だけ再生成します。

```sh
npm run fixtures:golden
npm test
```

Golden tests は、すべての scanner が output image を受け入れることを証明しません。下記の Vision / jsQR decode checks と併せて解釈します。

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
- `npm run verify:decode:jsqr`
- `npm pack --dry-run`

macOS Vision validation は Swift、Vision、ImageMagick に依存するため、local/macOS release check として扱います。
