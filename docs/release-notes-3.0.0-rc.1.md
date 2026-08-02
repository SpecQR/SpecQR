# SpecQR 3.0.0-rc.1 Release Notes

SpecQR 3.0.0-rc.1 is a focused release candidate for compact manual
Structured Append diagnostics. Full v2 split-unit detail remains available
through an explicit opt-in.

SpecQR 3.0.0-rc.1 は、
`generateSegmentsStructuredAppend()` の diagnostics contract だけを変更する
release candidate です。

RC 1 は release freeze 状態です。この文書に記載した breaking change 以外の
runtime、type、export 変更は追加しません。

> **2026-08-02 訂正:** 下記「互換性」のうち、warnings が 2.4.0 から不変という
> 記述は不正確でした。AUD-05 により、`ok: false` かつ negative `remainingBits` の
> overflow planning result から success-only の `CAPACITY_NEAR_LIMIT` を除いています。
> Successful near-limit result の warning は維持します。API shape の breaking
> change は manual Structured Append diagnostics だけです。詳細は
> [SpecQR 3.0.0-rc.2 Release Notes](./release-notes-3.0.0-rc.2.md) を参照してください。

## 主な変更

- Standard diagnostics は `splitUnitsDetail: "summary"` と
  `splitUnitCount` を返します。
- Standard result は `splitUnits` own property を持ちません。
- Full detail は `diagnostics: { splitUnits: "full" }` で明示的に要求します。
- `symbolResults: "output" | "diagnostics"` で各 symbol の return shape を
  選択できます。
- Literal options に応じて TypeScript return type が narrow されます。
- Standard path では full split-unit materialization を行いません。

## 互換性

次は 2.4.0 から変更していません。ただし warnings については上記訂正を参照して
ください。

- QR matrix、codewords、SVG/PNG bytes
- Version / ECC / mask selection
- Structured Append split 位置、parity、per-symbol diagnostics
- Errors、warnings、resource budgets
- Root / `specqr/node` / `specqr/browser` exports
- Runtime dependency 0、ESM-first、Node.js `>=18`

Full opt-in で返る `splitUnits` array は、v2 と同じ内容、順序、offset、
JSON property order、plain-object mutability を維持します。

## 移行

```js
// v2
generateSegmentsStructuredAppend(segments, {
  diagnostics: true
}).diagnostics.splitUnits;

// v3
generateSegmentsStructuredAppend(segments, {
  diagnostics: { splitUnits: "full" }
}).diagnostics.splitUnits;
```

詳細は [v3 Migration Guide](./v3-migration.md) を参照してください。

## RC verification

公開予定の単一 tarball について、次を検証します。

- Node 18 / 20 / 22 / 24 consumer install
- Root / node / browser runtime exports
- NodeNext / Bundler TypeScript resolution
- Chromium / Firefox / WebKit
- ZXing Java Structured Append metadata
- Tarball SHA-256、全 file content manifest、再 pack content reproducibility
- npm package allow/deny policy
- `npm publish --dry-run --tag next`

Conformance Lab は公開済み 2.4.0 を対象としており、この未公開 RC の検証証拠としては
扱いません。

## 公開 channel

3.0.0-rc.1 を公開する場合は npm の `next` tag を使います。`latest` は公開済み stable
2.4.0 向けの channel として維持します。この文書作成時点では 3.0.0-rc.1 を npm へ
公開していません。

## RC 1 に含めないもの

- Unknown top-level option rejection
- GS1 metadata readonly / freeze
- 新しい inspection API
- GS1 catalog 拡張
- Micro QR、rMQR、logo overlay、styled modules

これらは RC 1 の breaking change 評価と混ぜず、将来 candidate として扱います。

## 公開前に残る作業

1. freeze 済み working tree を commit / push する。
2. hosted GitHub Actions の required jobs を確認する。
3. manifest で検証した canonical tarball を npm の `next` へ publish する。
4. `specqr@3.0.0-rc.1` と `specqr@next` の exact version、metadata、exports、
   types、v3 contract を検証する。
