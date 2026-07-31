# SpecQR v3 Roadmap

Status: **Phase 1 integrated as 3.0.0-rc.1 candidate / unpublished.**

Phase 2 以降は未実装です。RC 1 は release freeze 状態であり、Phase 2 以降の変更を
追加しません。

v3 候補を一つの変更へ混ぜず、互換性判断と rollback を独立させるための順序です。

1. [Structured Append Diagnostics Contract](./v3-structured-append-diagnostics.md)
   - `diagnostics.splitUnits` を standard/full へ分離する。
   - Current memory hardening と public type gate が前提。
   - Dirty working tree で runtime/types/unit/fuzz/memory/packed/3-engine
     browser coverage まで実装済み。
   - Package metadata、CHANGELOG、migration、single-artifact release pipeline を
     `3.0.0-rc.1` へ統合済み。npm publish、tag、GitHub Release、Pages deploy は
     未実施。
2. Option policy
   - unknown own key、`null` / array、inherited property、alias、specialized API
     ownership を全 API で統一するか判断する。
   - Structured Append diagnostics nested object の新規 schema 以外は、Phase 1 と同じ
     implementation change へ混ぜない。
3. GS1 metadata mutation/type contract
   - deeply readonly type へ寄せるか、mutable defensive copy へ寄せるかを決める。
   - Structured Append diagnostics とは runtime/type migration が独立しているため、
     別 goal、別 release note で扱う。

この順序は優先度と依存関係だけを示します。Phase 1 は未公開 RC candidate であり、
stable support claim ではありません。Unknown option rejection と GS1 readonly は
RC 1 に含めず、引き続き将来の独立 decision candidate です。
