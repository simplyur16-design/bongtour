# 식사 원문 사실 필드 계약 (supplier-product-fact-ssot)

슬롯 문법 공통: [`lib/register-schedule-meal-parse.ts`](../../lib/register-schedule-meal-parse.ts).  
등록 파이프: `applyRegisterPostAugmentSchedulePipeline` → `register-schedule-meal-hotel-merge`가 일차 meal 필드를 채운 뒤 Product.schedule / ItineraryDay에 저장.  
공급사별 **본문→일차 채움**만 분리 (공통 스크래퍼 설정 통합 금지).

## 저장

| 필드 | 의미 |
|------|------|
| `breakfastText` / `lunchText` / `dinnerText` | 슬롯별 내용 (접두 조·중·석 제거된 내용 권장) |
| `mealSummaryText` | 한 줄 요약 원문 |
| `meals` | 레거시 한 줄 |

비어 있음 → 공개 `정보 없음` (비교).  
명시적 불포함만 `불포함` / `식사 - 불포함` (`formatMealDisplay`).

## 공개 vs 비교

| 표면 | 표시 |
|------|------|
| 상세 일차 카드 | `formatMealDisplay` — 일별 종류(호텔식·현지식 등) |
| 비교 체크리스트 | `formatCompareMealSlotsLabel` — **조·중·석 포함·불포함** (`조식 포함 · 중식 불포함 · 석식 포함`) |

비교 한 줄: `deriveHotelMealFact().mealLabel`.

## verify

`register-schedule-meal-parse` + `supplier-product-fact-ssot`
