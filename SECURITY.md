# Security Policy

SpecQR は dependency-free runtime を維持する QR Code Model 2 generator ですが、生成結果の安全性、DoS につながる入力、package distribution、docs / examples の誤誘導は security issue として扱います。

## Supported Versions

| Version | Status |
| --- | --- |
| `2.x` | 対応中 |
| `1.x` | 実用上可能な範囲で security fix |
| `3.0.0-rc.1` | 公開済み prerelease。評価用途で、stable support の対象外 |
| `3.0.0-rc.2` | 未公開の release-correction candidate。RC 1 と同じ runtime / type surface |
| その他 prerelease / RC | stable release への upgrade を推奨 |

## Reporting a Vulnerability

脆弱性や公開前に扱うべき問題は、可能であれば GitHub Security Advisory から報告してください。

https://github.com/SpecQR/SpecQR/security/advisories/new

Security Advisory が使えない場合は、詳細を公開せずに GitHub issue で連絡方法だけを相談してください。再現 payload、影響範囲、実行環境、期待される挙動、実際の挙動があると調査しやすくなります。

## Scope

次のような問題を受け付けます。

- 特定入力で process が極端に遅くなる、または memory を過剰に使う。
- QR matrix / codeword / control segment が不正になり、scan 結果が予期せず変わる。
- GS1 / Structured Append helper が docs と異なる危険な payload を生成する。
- npm package contents、exports、types、examples が利用者を危険な使い方に誘導する。
- Published package と repository source の不一致。

次の項目は通常 security issue ではなく feature request / bug として扱います。

- Micro QR、rMQR、logo overlay、styled modules など未対応機能の追加要望。
- 特定 scanner / decoder の表示差。
- GS1 full AI catalog や業界別 validation の未対応範囲。

## Dependency Policy

SpecQR の runtime dependency は 0 を維持します。`jsqr`、`nayuki-qr-code-generator`、TypeScript などは devDependency / validation 用です。依存追加が必要な場合は、runtime package に入れる前に security / maintenance / bundle impact を確認します。

実ブラウザと Structured Append metadata の重い検証は root dependency から分離します。`e2e/zxing-java/` は Maven Wrapper 3.3.4 / Maven 3.9.16 / ZXing core + javase 3.5.4 を exact pin し、Maven distribution を SHA-256 で検証します。JAR、Maven cache、compiled class、fixture PNG、report は vendor せず、npm package にも含めません。取得元、license、upgrade 手順は [Structured Append ZXing Java Verification](./docs/structured-append-zxing-java.md) と `e2e/zxing-java/NOTICE.md` に記録します。

Release candidate では、一度だけ生成した npm tarball の SHA-256 と全 file
content manifest を記録し、Node engine matrix、browser、ZXing Java へ同じ
artifact を渡します。Repeated pack の expanded-content 一致、package allow/deny
policy、repository metadata、runtime dependency 0 も検証します。Manifest、
tarball、temporary install、browser/JDK/Maven artifacts は repository や npm
package へ含めません。詳細は
[Release Artifact Verification](./docs/release-artifact.md) を参照してください。

`3.0.0-rc.2` は release-correction freeze 状態です。RC 1 の runtime、types、
exports、error / warning message、QR output bytes、resource budget を変更せず、
AUD-05 overflow warning の release claim だけを訂正します。

## Resource Limits

Renderer は cross-runtime deterministic な pixel / byte / serialized-output budget を allocation 前に検証し、超過時は `InvalidInputError` で失敗します。Single-symbol generation は収容不能を証明できる input を segment optimization 前に `DataTooLongError` で reject します。具体的な上限、低 heap gate、non-goals は [Resource Safety / Correctness Hardening](./docs/resource-safety.md) に記載しています。
