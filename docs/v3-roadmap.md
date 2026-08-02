# SpecQR v3 Roadmap

Status: **Phase 1 published as 3.0.0-rc.1; 3.0.0-rc.2 correction candidate is unpublished.**

Phase 2 以降は未実装です。RC 2 は RC 1 と runtime / type / export behavior が
同一の release-correction candidate であり、Phase 2 以降の変更を追加しません。

v3 候補を一つの変更へ混ぜず、互換性判断と rollback を独立させるための順序です。

1. [Structured Append Diagnostics Contract](./v3-structured-append-diagnostics.md)
   - `diagnostics.splitUnits` を standard/full へ分離する。
   - Current memory hardening と public type gate が前提。
   - Dirty working tree で runtime/types/unit/fuzz/memory/packed/3-engine
     browser coverage まで実装済み。
   - Package metadata、CHANGELOG、migration、single-artifact release pipeline を
     `3.0.0-rc.1` へ統合し、npm `next`、tag、GitHub prerelease へ公開済み。
   - `3.0.0-rc.2` は RC 1 の不正確な warning claim を訂正する。2.4.0 との
     observable correctness change は、overflow planning result から
     `CAPACITY_NEAR_LIMIT` を除いた AUD-05 修正だけである。
2. Option policy
   - unknown own key、`null` / array、inherited property、alias、specialized API
     ownership を全 API で統一するか判断する。
   - Structured Append diagnostics nested object の新規 schema 以外は、Phase 1 と同じ
     implementation change へ混ぜない。
3. GS1 metadata mutation/type contract
   - deeply readonly type へ寄せるか、mutable defensive copy へ寄せるかを決める。
   - Structured Append diagnostics とは runtime/type migration が独立しているため、
     別 goal、別 release note で扱う。

この順序は優先度と依存関係だけを示します。Phase 1 は prerelease であり、stable
support claim ではありません。Unknown option rejection と GS1 readonly は RC 2 に
含めず、引き続き将来の独立 decision candidate です。
