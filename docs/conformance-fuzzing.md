# Deterministic Conformance / Fuzzing

この文書は、SpecQR core の deterministic conformance / property / differential gate の設計、再現方法、検証範囲を説明します。目的は広い入力空間を無作為に「試す」ことではなく、同じ seed から常に同じ case 集合を生成し、将来の変更で contract が崩れたときに一件だけ再実行できる状態を保つことです。

ISO/IEC 18004 や GS1 の制限付き仕様本文を test vector として転載していません。QR matrix の独立比較には既存 devDependency の `nayuki-qr-code-generator@1.8.0` を使い、GS1 / Digital Link / Structured Append の SpecQR 固有 contract は metamorphic property として検証します。

## Commands

通常 CI と release gate が使う bounded suite:

```sh
npm run verify:conformance:fuzz
```

既定値は次の通りです。

- seed: `0x5eedc0de`
- property case 数: 1 property あたり 32
- Nayuki differential: 1280 fixed-condition cases
- 合計: 1536 cases

ローカルで property case 数を増やす extended mode:

```sh
npm run verify:conformance:fuzz -- --extended
```

`--extended` は 1 property あたり 256 cases、合計 2048 property cases を実行します。Nayuki の 1280 組は bounded / extended で共通です。

seed と case 数を明示する場合:

```sh
npm run verify:conformance:fuzz -- --seed 0x12345678 --cases 128
```

`--cases` は各 metamorphic property の case 数です。Version / ECC / mask の differential coverage は常に全 1280 組を維持します。

Nayuki comparison だけを実行する既存 entry point も、同じ共有 engine を使います。

```sh
npm run verify:reference:nayuki
```

## Seed Policy

case generation は `tools/lib/deterministic-conformance.js` に集約しています。

- `Math.random()` を使いません。
- 現在時刻、timezone、locale、filesystem enumeration order を case selection に使いません。
- top-level seed と `suite + case index` から case seed を個別に導出します。
- 別 property の追加や実行順変更で、既存 case の内容は変わりません。
- timing は結果報告にだけ使い、case generation には使いません。

既定 seed は repository 内で固定します。既定 seed を変更する場合は coverage change として review し、旧 seed を再現可能な形で release note または test plan に残します。

## Failure Replay

failure message は次を含みます。

- top-level seed
- case ID
- property / comparison suite
- input と options の serializable descriptor
- exact replay command
- 利用可能な場合は最小化した input

例:

```sh
npm run verify:conformance:fuzz -- \
  --seed 0x5eedc0de \
  --cases 32 \
  --case property:auto-mask:0003
```

Nayuki case の例:

```sh
npm run verify:conformance:fuzz -- \
  --seed 0x5eedc0de \
  --cases 32 \
  --case nayuki:v10:q:m3:alphanumeric
```

`--case` は exact match です。存在しない ID を指定した場合は成功扱いにせず、明示的に失敗します。

共通 helper は string、array、`Uint8Array` の削除ベース最小化を提供します。現在、自動最小化を接続している property は determinism case の一部です。最小化に失敗しても元の failure を隠さず、replay command と original descriptor を必ず残します。

## Nayuki Differential Coverage

`tools/lib/nayuki-differential.js` は次の直積を一回ずつ比較します。

- Version: 1..40
- ECC: L / M / Q / H
- mask: 0..7
- total: `40 * 4 * 8 = 1280`

case taxonomy は numeric、alphanumeric、byte text、raw binary、manual mixed segments、ECI 26 + byte です。各 taxonomy が Version 1-9、10-26、27-40 の全 range に現れることを gate 自身が確認します。

各 case で比較する項目:

- full matrix の全 module
- Version と matrix size
- fixed mask
- ECC
- segment data bit length
- data capacity / remaining bits
- data / ECC / total codeword counts

一件を比較したら matrix を破棄し、1280 件の matrix を同時に memory へ保持しません。

### Differential Non-Claims

次は Nayuki と semantic equivalence を主張しません。

- Kanji mode: 利用している npm reference surface では同じ Kanji segment を直接構築しません。
- auto segmentation: 合法な segmentation policy が実装ごとに異なり得ます。
- auto mask: SpecQR 内では 8 fixed candidates との property で確認します。
- GS1 / FNC1 semantics: domain validation と decoder metadata の扱いが参照 matrix comparison だけでは決まりません。
- Digital Link: URL construction / normalization policy は SpecQR の public contract です。
- Structured Append high-level split / merge policy: reference matrix の責務外です。
- renderer、browser helper、scanner compatibility。

これらを differential failure へ無理に変換せず、unit / golden / decoder / metamorphic tests に分けます。

## Metamorphic Properties

bounded suite は次の 8 property を各 32 cases 実行します。

| Property | Contract |
| --- | --- |
| `determinism` | 同じ input / options が同じ matrix、mask、diagnostics、SVG を返す。 |
| `auto-version` | auto Version は指定 range の最小 fit であり、それ以前の fixed Version は `DataTooLongError`、選択 Version の fixed output は同じ matrix になる。 |
| `auto-mask` | auto mask は 8 fixed mask の最小 penalty を選び、`maskPenalties`、`maskPenalty`、matrix が一致する。tie は最初の最小 mask を選ぶ現在の contract を確認する。 |
| `planning-input` | `estimate()` の成功結果と `generate()` diagnostics の planning-compatible fields が一致する。 |
| `planning-segments` | `analyzeSegments()` と `generateSegments()` diagnostics が data/control segments で一致する。 |
| `manual-equivalence` | fixed condition の単一 manual segment と等価な `generate()` input が同じ matrix / bit accounting になる。 |
| `gs1-digital-link` | GS1 builder/parser/validator が round-trip し、Digital Link normalization が idempotent で parse result と unknown query を保持する。 |
| `structured-append` | parity helper、split metadata、symbol control diagnostics、順序を入れ替えた parts の merge が元 payload と一致する。manual-segment parity byte policy に加え、v3 candidate の standard/full、output/diagnostic symbol matrix、split-unit count/array invariant も確認する。 |

## Generated Case Taxonomy

case generator は小さく bounded な payload を使い、次を分散して含めます。

- numeric / alphanumeric / byte / Kanji / auto mixed text
- UTF-8 multi-byte text と ECI
- `0x00` / `0xff` を含む binary
- `ArrayBuffer` / `ArrayBufferView` の offset / length
- Version 1、9、10、26、27、40
- character-count indicator range 1-9 / 10-26 / 27-40
- fixed-capacity exact-fit 近傍
- manual ECI / FNC1 second / low-level Structured Append control segments
- GS1 variable-length separator
- Digital Link unknown query preservation
- string / binary Structured Append

巨大 input、巨大 `scale` / `margin`、PNG / ImageData / SVG allocation stress はこの gate に含めません。これらは `docs/correctness-contract-audit.md` の AUD-01〜05 を修正する resource-safety goal で、明示的な上限と failure contract を定めてから専用 regression test にします。

## CI Placement

`npm test` は軽量な unit / golden suite のままです。GitHub Actions の Node 18 / 20 / 22 / 24 engine matrix には deterministic fuzz gate を重複配置しません。

`verify:conformance:fuzz` は代表 Node 20 の `release-gates` job で一回実行します。この gate が内部で全 1280 Nayuki comparison を行うため、同じ job では `verify:reference:nayuki` を別に実行しません。独立 entry point はローカル調査と release checklist の個別確認用に維持します。

## Coverage Limits

この gate は Model 2 core と現在の public contract の回帰検出を強化しますが、次を証明しません。

- ISO/IEC 18004:2024 全文への認証済み完全準拠
- 全 scanner / camera / print condition での可読性
- full GS1 AI catalog や業界別 GS1 validation
- browser の実 DOM / ImageData / Object URL / download behavior。この fuzz gate の対象外であり、別の required [Browser E2E](./browser-e2e.md) が担当します。
- Structured Append metadata を返す全 decoder との互換性
- resource exhaustion に対する安全な上限
- Micro QR / rMQR / decoder implementation

実 decoder validation、golden fixtures、packed package smoke、Conformance Lab は別の責務を持ち、この gate の代替ではありません。
