# 레거시 사용처 및 일정 SSOT 정리

## 1. 레거시 정리 결과 (적용됨)

| 파일 | 분류 | 조치 | 비고 |
|------|------|------|------|
| **lib/product.ts** | 즉시 삭제 가능 | ✅ 삭제 완료 | 사용처 0. 상세는 Prisma 단일 경로만 사용. |
| **app/data/productDetail.ts** | 일부 축소 | ✅ 미사용 상수 제거 | plannedHotels, optionalTours, itineraryDays, DISCLAIMER_FLIGHT 제거. 타입(PlannedHotel, OptionalTour, ItineraryDay) 및 DISCLAIMER_ITINERARY 유지. |
| **app/data/travelProducts.ts** | 즉시 삭제 가능 | ✅ 삭제 완료 | TravelCard/RealTimeRankingWidget 삭제로 참조 0. |
| **app/components/TravelCard.tsx** | 즉시 삭제 가능 | ✅ 삭제 완료 | 앱에서 렌더되는 곳 없음. |
| **app/components/RealTimeRankingWidget.tsx** | 즉시 삭제 가능 | ✅ 삭제 완료 | 앱에서 렌더되는 곳 없음. |

## 2. 레거시 파일 사용처 (정리 후)

| 파일 | 사용 여부 | 사용처 |
|------|-----------|--------|
| **app/data/productDetail.ts** | 사용 중 | OptionalToursFactSheet, ItinerarySection, LocalExpenseChecklist, HotelGradeSection → 타입 OptionalTour, ItineraryDay, PlannedHotel 및 DISCLAIMER_ITINERARY |

## 3. Itinerary 역할 (단기 정책)

- **역할**: 보조/병행 기록. schedule과 동시에 쓰기 유지. 읽기는 `getScheduleFromProduct`에서 schedule 없을 때만 fallback.
- **정책 상세**: docs/SCHEDULE-SSOT-DECISION.md §0, §5 참고.

---

## 4. 일정 쓰기 흐름 비교

| 구분 | parse-and-upsert | parse-and-register |
|------|------------------|---------------------|
| **Product.schedule** | ✅ 씀. `productToUpdateData()` 에서 `parsed.itineraries` → JSON 문자열 (day, title, description, imageKeyword, imageUrl: null) | ✅ 씀. `scheduleJson = JSON.stringify(scheduleWithImages)` (imageUrl 포함) |
| **Itinerary 테이블** | ✅ 씀. `parsed.itineraries` → createMany(day, description) | ✅ 씀. scheduleWithImages → createMany(day, description = title+description 합침) |
| **쓰기 순서** | updateData 에 schedule 포함 → Product update/create 후, 별도 itinerary createMany | productData.schedule = scheduleJson → Product update/create 후, 별도 itinerary createMany |
| **소스** | ParsedProductForDB.itineraries (day, description) | parseForRegister → schedule (day, title, description, imageUrl) → JSON과 Itinerary 둘 다 채움 |

**실질 SSOT**  
- **쓰기**: 두 API 모두 “입력 소스(parsed itineraries / schedule)”를 기준으로 **동시에** Product.schedule(JSON) 과 Itinerary 테이블을 채움. 단일 SSOT는 없고 **이중 기록**.
- **읽기**: 상세는 `getScheduleFromProduct()` 로 schedule JSON 우선, 없으면 itineraries 변환 → 읽기 쪽은 이미 통합됨.

## 5. 단기/중기 전략

- **단기**: 쓰기 경로는 유지. 읽기만 `getScheduleFromProduct` 로 통일된 상태 유지. schedule/Itinerary 불일치 시 읽기가 schedule 우선이므로, 이미지 등은 schedule JSON에 맞춰 두는 것이 안전.
- **중기 SSOT 선택**  
  - **안 A (Itinerary SSOT)**: 모든 일정 변경을 Itinerary CRUD로만 수행. Product.schedule 은 읽기 시 Itinerary에서 파생해 캐시하거나, 점진적으로 제거.  
  - **안 B (Product.schedule SSOT)**: 모든 일정 변경을 schedule JSON 덮어쓰기로만 수행. Itinerary는 deprecated 또는 동기화용 보조로만 유지.  
- 현재는 **이중 기록**이므로, 한쪽만 수정하는 코드가 생기지 않도록 주의하고, 장기적으로 한쪽을 주 소스로 정한 뒤 다른 쪽을 파생/보조로 줄이는 것이 좋음.

## 6. 삭제/정리 후보 목록

| 대상 | 조치 | 우선순위 |
|------|------|----------|
| lib/product.ts | 삭제 또는 “레거시/외부용” 주석 후 유지 | P2 (사용처 0) |
| app/data/productDetail.ts 내 plannedHotels, optionalTours, itineraryDays, DISCLAIMER_FLIGHT | 상수/배열 제거. 타입·DISCLAIMER_ITINERARY 유지 | P2 |
| app/data/travelProducts.ts 의 travelProducts 배열 | 배열만 제거하거나, 타입만 남기고 파일 축소 | P2 |
| TravelCard, RealTimeRankingWidget | 사용처 없음. 삭제 또는 “예정 UI” 로 보류 | P2 |

## 7. 이번 턴에서 실제 수정한 파일

- **app/api/admin/products/[id]/sync/route.ts**  
  - `parseInt(id, 10)` 제거, `id` 를 string 으로 trim 해서 그대로 사용.  
  - `findUnique({ where: { id: productId } })`, 응답 `productId` 문자열로 반환.
