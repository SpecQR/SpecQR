# Project Language Policy

この文書は、SpecQR v2.0.0 以降の公開文書・開発記録の言語方針を固定します。

SpecQR は日本語メインで設計・実装・検証の意思決定を残します。一方で、npm / GitHub での発見性、API 検索性、海外利用者向けの最低限の導線は英語で維持します。

この文書は runtime behavior、public API、package version、package exports を変更しません。

## Default Language

次の文書・記録は日本語メインにします。

- `README.md`
- `docs/*`
- `CHANGELOG.md`
- GitHub Release notes
- commit messages
- PR-style summaries
- Codex final reports / implementation summaries

技術識別子は無理に訳しません。API 名、option 名、error class 名、script 名、file path、package 名、standard / decoder 名は英語のまま使います。

## English That Should Remain

次の英語は維持します。

- `package.json` の `description`
- `package.json` の `keywords`
- npm 検索向けの short summary
- README 冒頭の 1-2 文の English summary
- badges
- install commands
- code examples
- API names / option names / type names / error class names
- decoder / library / standard の正式名称

README の最初に短い English summary を置く理由は、npm / GitHub で最初に表示されたときに、非日本語話者にも package の用途が伝わるようにするためです。詳細な設計意図、検証範囲、release notes は日本語メインで構いません。

## Commit Messages

commit message は日本語メインでよいです。必要に応じて、検索性や GitHub UI での分類のために短い conventional prefix を使います。

推奨例:

```text
Structured Append の検証方針を整理
docs: Structured Append の検証方針を整理
GS1 Digital Link の canonical 方針を文書化
test: GS1 raw parser の packed smoke を追加
```

避けるもの:

- 意味の薄い英語だけの message。
- 実装内容と違う conventional prefix。
- release notes に転記したとき、何をしたか分からない短すぎる message。

英語 prefix は必須ではありません。`docs:`, `test:`, `fix:` などは、変更種別が明確になる場合だけ使います。

## Release Notes

GitHub Release notes と `CHANGELOG.md` は日本語メインにします。

ただし、次は英語のまま残します。

- version / tag
- npm install command
- API name
- script name
- file path
- package metadata
- external decoder / reference implementation name

release note の構成は、利用者が「何が増えたか」「何をまだ期待してはいけないか」「どう検証したか」をすぐ読める形にします。

## PR-Style Summaries And Codex Final Reports

PR-style summary と Codex final report は日本語メインにします。

推奨構成:

- 変更内容
- 検証
- 変更しなかったこと
- 残リスク
- 次に進むべき `/goal`

英語の API 名や source citation はそのまま残します。無理に訳すより、検索できる識別子を保持します。

## Docs Style

docs は日本語本文を基本にし、次の方針で揃えます。

- code block は英語識別子をそのまま使う。
- section heading は日本語でも英語でもよいが、既存 doc の流れに合わせる。
- API shape や return shape は TypeScript 風の表記で固定する。
- "supported", "partial", "not supported" など status label は既存 matrix と揃えるため英語を許容する。
- 仕様・decoder・package 名は正式名称を優先する。

## npm / GitHub Discovery

npm と GitHub の一覧で見える短い情報は英語中心にします。

- `package.json` `description` は英語。
- `package.json` `keywords` は英語中心。
- README 冒頭の English summary は維持。
- README の詳細本文は日本語メイン。

これにより、日本語で意思決定を丁寧に残しつつ、検索・導入・API 利用の入口は広く保ちます。
