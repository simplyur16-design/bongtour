# 노랑풍선(ybtour) 관리자 등록 스택 (P3)

**범위:** `ybtour` 전용. 타 공급사 `register-admin-*-{supplier}` 복제본 유지 — **공통 레이어로 합치지 않음.**

## 파일 역할

| 파일 | 역할 |
|------|------|
| `register-admin-core-ybtour.ts` | **공유 조각** — pastedBlocks 4칸 파싱·originUrl 정규화 |
| `register-admin-input-digest-ybtour.ts` | SHA-256 input digest (preview↔confirm) |
| `register-admin-input-persist-ybtour.ts` | 스냅샷 생성·parseFn 호출 |
| `register-admin-confirm-reuse-ybtour.ts` | confirm 시 분석 행 재사용 |
| `parse-and-register-ybtour-orchestration.ts` | 등록 HTTP 흐름 |

## 호출 흐름

```
parse-and-register-ybtour-handler
  └─ parse-and-register-ybtour-orchestration
       ├─ parseYbtourRegisterPastedBlocksFromBody (core, digest 별칭)
       ├─ computeRegisterInputDigestFromBody (digest)
       └─ parseForRegisterYbtour → register-parse-ybtour
```

## P3에서 제거한 중복

- `parse-and-register-ybtour-orchestration` 내부 `parsePastedBlocksFromBody` / `computePreviewContentDigestForBody` → **core + digest SSOT**

## 관련

- `docs/ops/ybtour-lib-inventory.md`
- `docs/body-parser-ybtour-ssot.md`, `docs/ops/ybtour-parse-contract.md`
