# 하나투어 관리자 등록 스택 (P3)

**범위:** `hanatour` 전용. modetour/ybtour 등은 각자 `register-admin-*-{supplier}` 복제본 유지 — **공통 레이어로 합치지 않음.**

## 파일 역할

| 파일 | 역할 |
|------|------|
| `register-admin-core-hanatour.ts` | **공유 조각** — pastedBlocks 4칸 파싱·originUrl 정규화 |
| `register-admin-audit-status-hanatour.ts` | 스냅샷·분석 행 status 상수 |
| `register-admin-retention-hanatour.ts` | `retentionExpiresAt*` · env 일수 |
| `register-admin-analysis-store-hanatour.ts` | Prisma 스냅샷/분석 CRUD·clip |
| `register-admin-input-digest-hanatour.ts` | SHA-256 input digest (preview↔confirm) |
| `register-admin-input-persist-hanatour.ts` | 스냅샷 생성·parseFn 호출·정규화 저장 |
| `register-admin-confirm-reuse-hanatour.ts` | confirm 시 분석 행 재사용(LLM 생략) |
| `register-preview-content-fingerprint-hanatour.ts` | canonical 문자열(클라이언트 호환) |
| `register-preview-ssot-hanatour.ts` | 미리보기 SSOT 배지·메타 정책 |
| `register-preview-payload-hanatour.ts` | `RegisterPreviewProductDraft` 타입 |
| `admin-register-verification-meta-hanatour.ts` | 미리보기/confirm 검증 JSON |

## 호출 흐름

```
parse-and-register-hanatour-handler (얇은 래퍼)
  └─ parse-and-register-hanatour-orchestration
       ├─ parseHanatourRegisterPastedBlocksFromBody (core)
       ├─ computeRegisterInputDigestFromBody (digest)
       ├─ resolveOrCreateRegisterAdminInputSnapshot (input-persist)
       ├─ invokeRegisterParsePersistAnalysisAttempt (input-persist → parseForRegisterHanatour)
       ├─ tryLoadRegisterParsedForConfirmReuse (confirm-reuse)
       ├─ buildRegisterPreviewSsotMeta (preview-ssot)
       └─ buildRegisterVerificationBundle (verification-meta)
```

## P3에서 제거한 중복

- `parse-and-register-hanatour-orchestration` 내부 `parsePastedBlocksFromBody` / `computePreviewContentDigestForBody` → **core + digest SSOT**

## 관련

- `docs/ops/hanatour-lib-inventory.md`
- `docs/body-parser-hanatour-ssot.md`, `docs/ops/hanatour-parse-contract.md`, `docs/PARSING_MANUAL_HANATOUR.md`
