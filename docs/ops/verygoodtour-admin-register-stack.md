# 참좋은여행(verygoodtour) 관리자 등록 스택 (P3)

**범위:** `verygoodtour` 전용. 타 공급사와 **공통 레이어 통합 금지.**

## 파일 역할

| 파일 | 역할 |
|------|------|
| `register-admin-core-verygoodtour.ts` | **공유 조각** — pastedBlocks 4칸·originUrl |
| `register-admin-input-digest-verygoodtour.ts` | SHA-256 input digest |
| `register-admin-input-persist-verygoodtour.ts` | 스냅샷·parseFn |
| `parse-and-register-verygoodtour-handler.ts` | 등록 HTTP 흐름 (orchestration 통합) |

## P3에서 제거한 중복

- handler 내부 `parsePastedBlocksFromBody` / `computePreviewContentDigestForBody` → **core + digest SSOT**

## 관련

- `docs/ops/verygoodtour-lib-inventory.md`
- `docs/body-parser-verygoodtour-ssot.md`, `docs/ops/verygoodtour-parse-contract.md`
