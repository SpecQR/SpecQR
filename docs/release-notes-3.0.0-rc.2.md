# SpecQR 3.0.0-rc.2 Release Notes

SpecQR 3.0.0-rc.2 is a release-correction candidate. It does not change
runtime code, TypeScript declarations, or public exports from 3.0.0-rc.1; it
corrects the documented Planning overflow-warning behavior.

SpecQR 3.0.0-rc.2 は、immutable な RC 1 を置き換えず、release documentation の
不正確な warning claim を訂正する candidate です。RC 2 はこの文書作成時点で未公開で、
npm の `next` は `3.0.0-rc.1`、`latest` は `2.4.0` を指しています。

## Release scope

- v3 の唯一の意図的な API shape breaking change は、manual segments 版
  `generateSegmentsStructuredAppend()` の diagnostics contract です。
- `diagnostics: true` の standard summary は `splitUnits` own property を持たず、
  `splitUnitsDetail: "summary"` と `splitUnitCount` を返します。
- v2 互換の full detail は `diagnostics: { splitUnits: "full" }` で要求します。
- RC 2 は RC 1 から runtime、TypeScript declarations、public exports、QR bytes、
  warning implementation、resource budget、dependency を変更しません。

## Observable correctness change

2.4.0 から RC 1 までの間には、API shape breaking change とは別に、AUD-05 で実施した
observable correctness change があります。

`estimate()` / `analyzeSegments()` が `{ ok: false, reason: "data-too-long" }` を返し、
`remainingBits < 0` になる場合、`CAPACITY_NEAR_LIMIT` は返しません。容量超過は成功に
近い状態ではなく失敗 result なので、success-only warning を付けない現行動作を正と
します。

収容に成功した near-limit result では warning を維持します。Version 1-L、numeric
41 桁、`remainingBits: 1` の case は RC 1 でも
`CAPACITY_NEAR_LIMIT` を返します。

## Conformance Lab の 3 vector

Registry から別々の一時ディレクトリへ `specqr@2.4.0` と
`specqr@3.0.0-rc.1` を install し、Lab の exact input で再現しました。

| Vector ID | `remainingBits` | 2.4.0 | RC 1 / RC 2 candidate |
| --- | ---: | --- | --- |
| `core.estimate.data-too-long-reject` | `-381` | `CAPACITY_NEAR_LIMIT` あり | warning なし |
| `planning.estimate.data-too-long-v1-h` | `-340` | `CAPACITY_NEAR_LIMIT` あり | warning なし |
| `planning.analyze-segments.data-too-long-v1-h` | `-340` | `CAPACITY_NEAR_LIMIT` あり | warning なし |

3 件とも `ok: false`、`reason: "data-too-long"`、negative `remainingBits`、positive
`overflowBits` は共通です。差は planning result と diagnostics 内の warning array から
`CAPACITY_NEAR_LIMIT` が除かれたことだけです。

Lab の strict common comparison は 455 results を比較し、この 3 normalized result
以外の差を検出しませんでした。Exact RC 1 と `specqr@next` の差は 0 件、v3 contract
は両方で 35 required checks を通過しました。

## RC 1 erratum

RC 1 の CHANGELOG / release notes にあった「error / warning semantics は 2.4.0 から
変更していない」という claim は不正確でした。正しくは次のとおりです。

1. Manual Structured Append diagnostics が唯一の API shape breaking change です。
2. Overflow planning result から success-only warning を除く correctness change が
   あります。
3. RC 1 と RC 2 の runtime / type / export behavior は同一です。

RC 1 の npm package、tag、GitHub Release は immutable な公開記録として保持し、削除、
上書き、deprecate は行いません。

## Runtime / type invariants

RC 1 registry package と RC 2 candidate checkout の `src/**/*.js` と
`src/**/*.d.ts`、合計 43 files を path / size / SHA-256 で比較しました。

- Source/type content manifest SHA-256:
  `02eec15aa08b2b5f66bfe62a702001333186ec223beb0f13fb5fca9c10d4a60d`
- Root export: `specqr`
- Subpath exports: `specqr/node`、`specqr/browser`
- Runtime dependency: 0

RC 2 canonical artifact の tarball / expanded-content SHA-256、file count、packed /
unpacked size は、公開前の hosted CI artifact 検証後に固定します。

## RC 2 に含めないもの

- Overflow result への `CAPACITY_NEAR_LIMIT` 復活
- Unknown top-level option rejection
- GS1 metadata readonly / freeze
- 新しい inspection API
- GS1 catalog 拡張、Micro QR、rMQR、styled modules、logo overlay

## 公開前に残る作業

1. RC 2 canonical artifact と manifest を local / hosted CI で一致させる。
2. Exact commit の required hosted jobs を green にする。
3. 明示的な公開承認後、canonical tarball を npm の `next` へ publish する。
4. `specqr@3.0.0-rc.2` と `specqr@next` の registry artifact を検証する。

RC 2 tag、GitHub prerelease、Pages deploy は publish 検証後の別作業です。
