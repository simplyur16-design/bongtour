# 모두투어 관리자 등록 스택 (P3)

**범위:** `modetour` 전용. hanatour/ybtour 등은 각자 `register-admin-*-{supplier}` 복제본 유지 — **공통 레이어로 합치지 않음.**

## 파일 역할

| 파일 | 역할 |
|------|------|
| `register-admin-core-modetour.ts` | **공유 조각** — pastedBlocks 4칸 파싱·originUrl 정규화 |
| `register-admin-audit-status-modetour.ts` | 스냅샷·분석 행 status 상수 |
| `register-admin-retention-modetour.ts` | `retentionExpiresAt*` · env 일수 |
| `register-admin-analysis-store-modetour.ts` | Prisma 스냅샷/분석 CRUD·clip |
| `register-admin-input-digest-modetour.ts` | SHA-256 input digest (preview↔confirm) |
| `register-admin-input-persist-modetour.ts` | 스냅샷 생성·parseFn 호출·정규화 저장 |
| `register-admin-confirm-reuse-modetour.ts` | confirm 시 분석 행 재사용(LLM 생략) |
| `register-preview-content-fingerprint-modetour.ts` | canonical 문자열(클라이언트 호환) |
| `register-preview-ssot-modetour.ts` | 미리보기 SSOT 배지·메타 정책 |
| `register-preview-payload-modetour.ts` | `RegisterPreviewProductDraft` 타입 |
| `admin-register-verification-meta-modetour.ts` | 미리보기/confirm 검증 JSON |

## 호출 흐름

```
parse-and-register-modetour-handler
  ├─ parseModetourRegisterPastedBlocksFromBody (core)
  ├─ computeRegisterInputDigestFromBody (digest)
  ├─ resolveOrCreateRegisterAdminInputSnapshot (input-persist)
  ├─ invokeRegisterParsePersistAnalysisAttempt (input-persist → parseForRegisterModetour)
  ├─ tryLoadRegisterParsedForConfirmReuse (confirm-reuse)
  ├─ buildRegisterPreviewSsotMeta (preview-ssot)
  └─ buildRegisterVerificationBundle (verification-meta)
```

## P3에서 제거한 중복

- `parse-and-register-modetour-handler` 내부 `parsePastedBlocksFromBody` / `computePreviewContentDigestForBody` → **core + digest SSOT**

## 관련

- `docs/ops/modetour-lib-inventory.md`
- `docs/ops/modetour-regression-baseline.md` (관리자 미리보기 회귀)
