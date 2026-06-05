# 모두투어 등록 상품명 계약 (SSOT)

**버전:** `lib/modetour-register-product-title-ssot.ts` → `MODETOUR_REGISTER_TITLE_SSOT_VERSION`

## 금지 (회귀 시 CI 실패)

- `register-from-llm-modetour.ts`에 붙여넣기 제목 추출·선택 로직 **인라인 복제 금지**
- 출발일 구간(`2026.12.12~2026.12.14 2박 3일` 등)을 `Product.title`로 저장 **금지**
- confirm 저장 시 baseline(h1) 없이 부적절 제목으로 persist **금지** (422)

## SSOT 모듈

| 모듈 | 역할 |
|------|------|
| `lib/modetour-listing-title-from-paste.ts` | 붙여넣기 상단 원문 한 줄 추출 |
| `lib/modetour-departures.ts` | baseline h1·weak/departure-window 판별 |
| `lib/modetour-register-product-title-ssot.ts` | paste/LLM/baseline **단일 해석·저장 게이트** |

## 해석 순서

### preview (parse)

1. 붙여넣기 `#`·`[]` 리스트 제목 (출발 구간 줄 스킵)
2. LLM JSON `title` (부적절이면 스킵)
3. 둘 다 부적절 → `unacceptable` + 미리보기 fieldIssue

### confirm (저장)

1. 상세 URL HTML baseline `h1` (acceptable일 때 **최우선**)
2. preview에서 넘어온 `parsed.title`
3. `modetourRegisterTitleBlocksConfirmSave` — 표시·원본 모두 부적절하고 baseline 없으면 **422**

## 검증

```bash
npm run verify:modetour-register-title   # 런타임 + 정적 가드
npm run test -- lib/modetour-listing-title-from-paste.test.ts
```

`prebuild`에 `verify:modetour-register-title` 포함 — 배포 전 자동 실행.
