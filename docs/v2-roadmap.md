# SpecQR v2.0.0 Roadmap

この文書は SpecQR `1.0.0` の公開後に、v2.0.0 で何を強化し、何を意図的に入れないかを固定するための計画です。v2.0.0 は新しい QR family を一気に増やす release ではなく、通常 QR Code Model 2 core の上に、GS1 syntax、QR control segments、Structured Append、検証体系を厚くする release として扱います。

v2 planning の対象は roadmap であり、現時点の runtime behavior や public API の約束ではありません。実装済み範囲は [Conformance Matrix](./conformance.md) と [Specification Scope](./spec-scope.md) を参照してください。

## v2.0.0 の目的

- GS1/FNC1 first position に留まっている v1 の GS1 helper を、より厳密な GS1 syntax layer へ進める。
- GS1 Digital Link URI と FNC1 first position の GS1 element string を API と docs で明確に分ける。
- ECI、FNC1 first、FNC1 second、Structured Append を内部的に扱いやすい control segment model として整理する。
- FNC1 second position と Structured Append を通常 QR Code Model 2 の optional feature として追加する。
- v2 で増える control feature に対して、golden fixtures、decoder validation、reference comparison の限界を明記した検証体系を用意する。

## v1.0.0 からの自然な拡張点

SpecQR v1.0.0 は、通常 QR Code Model 2 generation、Kanji、ECI、FNC1 first position、限定 GS1 helper、renderer、diagnostics、Nayuki reference comparison を持っています。v2.0.0 ではこの土台を壊さず、既存の `generate()` / `generateSegments()` / helper API と互換性を保ちながら次の領域を伸ばします。

- v1 の partial GS1 helper を、AI catalog driven な parser / validator へ広げる。
- v1 で未対応だった GS1 Digital Link helper を追加する。
- v1 で個別処理されている ECI / FNC1 first を、今後の FNC1 second / Structured Append と同じ control segment 設計へ寄せる。
- v1 で対象外としていた Structured Append を、low-level header encoding から high-level splitting API へ段階的に追加する。

## v2.0.0 に含めるもの

| 領域 | v2.0.0 の到達点 |
| --- | --- |
| GS1 syntax layer | GS1 Application Identifier catalog、strict parser、fixed / variable length validation、GTIN / SSCC / representative AI validation の拡張。 |
| GS1 Digital Link | element data と Digital Link URI の変換 helper。Digital Link は通常 URL QR、GS1 element string は FNC1 first QR として区別する。 |
| Control segment model | ECI、FNC1 first、FNC1 second、Structured Append の ordering、capacity accounting、diagnostics を整理する内部 model。 |
| FNC1 second position | application indicator validation、encoding、diagnostics、golden / negative tests。 |
| Structured Append | low-level header encoding、manual chunks、high-level `generateStructuredAppend()` 相当の automatic splitting、最大 16 symbols の validation。 |
| Validation expansion | v2 feature 向け golden fixtures、bitstream / matrix checks、decoder validation の限界説明、reference comparison の対象外領域の明記。 |
| Docs / examples / playground | GS1 QR、GS1 Digital Link、FNC1 second、Structured Append を誤用しにくい examples と docs。 |

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
4. **GS1 Digital Link helpers**: Digital Link URI と GS1 element data の相互変換を追加し、FNC1 first QR と通常 URL QR の違いを docs で固定する。
5. **Control segment model refactor**: ECI / FNC1 first の挙動を保ったまま、FNC1 second / Structured Append を載せられる internal model に整理する。
6. **FNC1 second position**: API、validation、diagnostics、golden fixtures、negative tests を追加する。
7. **Structured Append low-level**: header encoding、sequence / total / parity、manual chunks を golden fixtures で固定する。
8. **Structured Append high-level**: automatic splitting API、capacity handling、diagnostics、failure modes を追加する。
9. **v2 validation expansion**: golden、decoder、optional external validation、reference comparison docs を v2 features に合わせて更新する。
10. **v2 examples / playground / docs**: GS1 strict validation、Digital Link、FNC1 second、Structured Append の利用導線を整える。

## Progress Notes

- 2026-05-22: GS1 module refactor completed. `src/gs1.js` は互換 entrypoint として残し、内部実装を `src/gs1/` 配下の AI metadata、parser、element string builder、check digit helper に分割しました。public API と runtime behavior は v1.0.0 互換を維持します。

## Release Gate

v2.0.0 の正式 release では、少なくとも次を通すことを release gate とします。

- `npm test`
- `npm run examples:smoke`
- `npm run pages:build`
- `npm run verify:decode:jsqr`
- `npm run verify:reference:nayuki`
- macOS release machine で `npm run verify:decode`
- `npm pack --dry-run`
- v2 feature 向け golden fixtures
- published package smoke
- GitHub Actions green

Structured Append や FNC1 second は decoder によって露出方法が異なる可能性があるため、decoder validation だけを唯一の根拠にしません。control segment bit length、matrix / codeword golden fixtures、diagnostics、negative tests を組み合わせて release gate とします。

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

SpecQR は ISO/IEC 18004:2024 の全文に対する完全準拠をここでは主張しません。通常 QR Code Model 2 generation の実装・検証範囲を明確にし、Structured Append、FNC1 second position、Micro QR、rMQR などの未対応領域を段階的に扱います。ISO 本文や仕様表は repository にコピーしません。
