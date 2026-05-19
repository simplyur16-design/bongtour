# 하나투어 상품 데이터 판독 — 운영 요약 (SSOT 링크)

> **유지보수 1급 SSOT는 아래 문서입니다.** 이 파일은 예전 “Prisma 등록용 매뉴얼”을 **짧은 체크리스트 + 링크**로만 남긴 것입니다.  
> 섹션 앵커·항공·옵션·쇼핑 구조화·등록 파이프 상세는 **중복 서술하지 않습니다.**

| 주제 | 1급 SSOT |
|------|----------|
| 본문 섹션·앵커·슬라이스 | [`docs/body-parser-hanatour-ssot.md`](./body-parser-hanatour-ssot.md) |
| 항공 `출발 :`/`도착 :`·directed·LLM 금지 | [`docs/ops/hanatour-parse-contract.md`](./ops/hanatour-parse-contract.md) |
| 등록 입력·정형칸 우선 | [`docs/admin-register-supplier-precise-spec.md`](./admin-register-supplier-precise-spec.md) §3, [`docs/register-supplier-extraction-spec.md`](./register-supplier-extraction-spec.md) |
| 일정 표현·`schedule` 저장 | [`docs/register_schedule_expression_ssot.md`](./register_schedule_expression_ssot.md) |
| 화면 회귀·스크린 경로 | [`docs/ops/hanatour-regression-baseline.md`](./ops/hanatour-regression-baseline.md) |
| 결정론 fixture | `scripts/fixtures/hanatour-atp207260601twj.fixture.ts` · `npm run verify:hanatour-atp207` |

---

## 빠른 체크리스트 (붙여넣기 본문에서)

| 필드 | 규칙 |
|------|------|
| **originSource** | canonical `"hanatour"` (API·등록 body) |
| **originCode** | `상품코드` 옆 **ATP…** 코드 |
| **쇼핑** | 「쇼핑없음」/「쇼핑 N회」→ `shoppingVisitCount` (**LLM**). 쇼핑 **목록 행 수**와 동일 의미 아님 → [`supplier-shopping-visit-count.md`](./ops/supplier-shopping-visit-count.md) |
| **가이드비** | `가이드경비` USD 등 → 불포함·`isGuideFeeIncluded` 판단에 반영 |
| **선택관광** | 표·전용 칸 SSOT; LLM `optionalTours[]` 행 추출 없음 |
| **항공** | 전용 칸 또는 `출발 :`/`도착 :` 줄; LLM 항공 필드 없음 |
| **호텔 성급** | 「N성급」 등은 제목·`includedText` 보강용 메모 |

---

## 레거시 Prisma 필드 메모

등록 payload는 `RegisterParsed` / `register-llm-schema-hanatour` 기준으로 조립됩니다.  
과거 `Product` 직접 create 예시(`bgImageUrl` 등)는 **사용하지 않습니다.**
