# 숙박 사실 필드 계약 (supplier-product-fact-ssot)

비교·공개 공통: **대표 숙소명** (+ 가능하면 **성급**). 「상하이 예정 호텔」만 있는 문장은 숙소명이 아님 → scrub → `정보 없음`.
참좋은여행: 호텔/관광지 `HotelInfoList`·`[호텔설명]` → `준특급 출발일 1~2일전 공지` / `{예정호텔} 혹은 동급(추후안내)` (`verygoodtour-hotel-info-ssot`).

## 저장

| 필드 | 의미 |
|------|------|
| `hotelSummaryRaw` | 공급사/등록 원문 보존 |
| `hotelSummaryText` | 표시용 한 줄 — 등록 시 `scrubPublicHotelDisplayLine` |
| day `hotelText` / dayHotelPlans | 일차 숙소 |

## 공개·비교

1. `resolveHotelConsumption` (공급사별)
2. `scrubPublicHotelDisplayLine` — 갤러리·호텔소개·도시+예정호텔·확정안내 문장 제거
3. 비교: `deriveHotelMealFact` — dayHotelPlans/hotelNames/제목에서 대표명 + `extractHotelStarGrade` (`준5성급` 등) 병기  
   예: `상하이 쑤닝 노보텔 호텔 (준5성급)`

## verify

`public-hotel-display-scrub` + `supplier-product-fact-ssot`
