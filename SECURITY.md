# Security Policy

SpecQR は dependency-free runtime を維持する QR Code Model 2 generator ですが、生成結果の安全性、DoS につながる入力、package distribution、docs / examples の誤誘導は security issue として扱います。

## Supported Versions

| Version | Status |
| --- | --- |
| `2.x` | Supported |
| `1.x` | Security fixes only when practical |
| prerelease / RC | Stable release への upgrade を推奨 |

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
