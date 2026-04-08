# 일정 SSOT 비교 및 추천

## 0. 단기 SSOT 정책 (확정)

- **표시 SSOT**: `Product.schedule` (JSON 문자열).
- **읽기 우선순위**: 1) `Product.schedule` 파싱 → 2) `Itinerary` 테이블 fallback → 3) 빈 배열.  
  구현: `getScheduleFromProduct(product)` 한 경로만 사용.
- **schedule JSON 항목**  
  - 필수: `day` (number), `description` (string).  
  - 선택: `title`, `imageKeyword`, `imageUrl` (process-images가 채움).
- **Itinerary 역할**: 병행 기록(보조). 쓰기 시 schedule과 동시에 createMany 유지. 읽기는 schedule 없을 때만 fallback. 향후 schedule 단일 SSOT로 갈 경우 Itinerary 쓰기/fallback 제거 가능.

---

## 1. 현재 코드 계약 기준 비교

| 기준 | Product.schedule (JSON 문자열) | Itinerary 테이블 |
|------|--------------------------------|-------------------|
| **쓰기 주체** | parse-and-upsert (productToUpdateData), parse-and-register 계열 전용·공용 route (scheduleJson), parse (route), admin products [id] PATCH (body.schedule), process-images (이미지 반영 시 schedule JSON 덮어씀) | parse-and-upsert (createMany), parse-and-register 계열 (createMany), parse (가격만, 일정은 schedule만), admin products route (itineraries createMany), v2 (itineraries createMany) |
| **읽기 주체** | getScheduleFromProduct (우선), products/[id], pending (photosReady), process-images/recent, process-images (parseSchedule), featured, gallery, TravelProductDetail (schedule 우선) | getScheduleFromProduct (fallback), admin products [id] GET, gallery (dayCount), products list (countScheduleDays는 schedule 기반) |
| **포함 정보량** | day, title, description, imageKeyword, imageUrl, (확장 가능) | id, productId, day, description 만. 정규화된 3필드. |
| **화면 친화성** | 일정 탭에서 day+description+imageUrl 한 번에 사용. process-images가 imageUrl 채움. | description만 있어서 이미지/메타는 schedule에서 보강 필요. |
| **DB 정규화** | 단일 JSON 컬럼. 인덱스/일차별 쿼리 불가. | 정규 테이블. productId+day 기준 쿼리·인덱스 가능. |
| **향후 유지보수** | 스키마 변경 없이 필드 추가 용이. 파싱/검증은 앱 레이어. | 스키마 변경 필요. 마이그레이션 필요. |

## 2. 실질 쓰기/읽기 흐름 요약

- **쓰기**: 두 저장 경로(parse-and-upsert, parse-and-register **계열** — 모두/참좋은/하나/노랑 전용 및 잔여 공용) 모두 **동시에** schedule JSON과 Itinerary createMany 수행. 단일 소스(parsed.itineraries / parsed.schedule)에서 둘 다 파생.
- **읽기**: 상세·갤러리·featured 등은 **schedule JSON**을 직접 파싱하거나 getScheduleFromProduct(schedule 우선) 사용. Itinerary는 getScheduleFromProduct의 fallback, admin [id] 조회, gallery dayCount 등에서만 사용.
- **이미지**: process-images는 **Product.schedule** JSON을 파싱해 imageUrl 채운 뒤 같은 필드를 update. Itinerary에는 imageUrl 없음.

## 3. 단기 SSOT 추천: Product.schedule

- **이유**  
  - 이미지(일정별 imageUrl)가 schedule JSON에만 있고, process-images·갤러리·featured가 schedule 기준으로 동작함.  
  - 읽기 경로가 대부분 schedule 우선이며, getScheduleFromProduct도 schedule 우선.  
  - UI에 필요한 메타(title, imageKeyword, imageUrl)를 한 덩어리로 다루기 좋음.  
- **적용 방식**  
  - 단기에는 **현 구조 유지**. 쓰기 시 schedule과 Itinerary 이중 기록 계속하되, **읽기는 schedule 우선**만 사용(getScheduleFromProduct 유지).  
  - 새 기능·수정 시 schedule JSON을 “진실 소스”로 두고, Itinerary는 호환/보조용으로만 유지.

## 4. 중기 전환 전략

- **안 A: schedule 단일 SSOT (권장)**  
  - 일정 변경/이미지 반영은 모두 Product.schedule JSON 덮어쓰기로만 수행.  
  - Itinerary createMany는 점진적으로 제거(또는 “캐시/검색용”으로만 선택 생성).  
  - 읽기는 이미 getScheduleFromProduct(schedule 우선)로 통일되어 있으므로, Itinerary 제거 시 fallback만 제거하면 됨.

- **안 B: Itinerary 단일 SSOT**  
  - 일정 변경을 Itinerary CRUD로만 수행.  
  - Product.schedule은 “캐시”로만 두고, 읽기 시 Itinerary에서 JSON 생성하거나, process-images 등이 Itinerary 기반으로 동작하도록 변경.  
  - 이미지 메타 저장 시 Itinerary에 컬럼 추가 또는 별도 ScheduleImage 테이블 필요. 마이그레이션·수정 범위 큼.

- **권장**: 단기는 **schedule 우선 읽기 + 이중 기록 유지**. 중기는 **안 A**로 Itinerary 쓰기 제거·fallback 제거하여 schedule 단일 SSOT로 정리.

---

## 5. Itinerary 의존 지점 (향후 축소 시 수정 대상)

### 5.1 지점별 분류 (코드 검증 기준)

| 위치 | 용도 | 분류 | 이유 |
|------|------|------|------|
| lib/schedule-from-product.ts | Itinerary fallback 읽기 | **회귀 확인 후 축소** | schedule 없고 itineraries만 있는 기존 상품이 있으면 일정이 빈 배열로 나옴. DB 확인 후 fallback 제거. |
| app/products/[id]/page.tsx | include itineraries | **회귀 확인 후 축소** | getScheduleFromProduct가 fallback으로 itineraries 사용. §5.1 schedule-from-product fallback 제거 후 include 제거. |
| app/api/admin/products/[id]/route.ts | GET/PATCH 응답에 itineraries | **아직 유지 필요** | admin/products/[id] UI가 itineraries 표시·"Itinerary에서 일정 생성"에 사용. schedule만 편집하도록 UI 전환 전까지 유지. |
| app/api/admin/products/route.ts | createMany(itineraries) | **아직 유지 필요** | Itinerary 쓰기 제거는 별도 단계. 선행 조건 충족 후 제거. |
| app/api/admin/products/v2/route.ts | itineraries createMany | **아직 유지 필요** | Product.create에 schedule 미포함. v2는 itinerary만 저장. schedule 저장 추가 후 쓰기 제거 검토. |
| app/api/travel/parse-and-upsert/route.ts | itinerary createMany | **아직 유지 필요** | 쓰기 제거는 선행 조건 후 수행. |
| app/api/travel/parse-and-register/route.ts 및 `parse-and-register-*` 전용 route들 | itinerary createMany | **아직 유지 필요** | 등록 confirm 경로마다 동일 패턴이면 핸들러별로 존재. |
| app/api/gallery/route.ts | dayCount | **즉시 축소 적용됨** | dayCount = schedule 파싱 길이 우선, 없을 때만 itineraries.length. 읽기 우선순위만 통일(include 유지). |
| app/admin/products/[id]/page.tsx | Itinerary 표시·"일정 생성" 버튼 | **아직 유지 필요** | UI가 itineraries 의존. schedule만 편집하도록 전환 후 제거. |
| app/components/travel/TravelProductDetail.tsx | 일정표 탭 | **즉시 축소 적용됨** | product.schedule만 사용. 빈 경우 "등록된 일정이 없습니다"만 표시. itineraries 분기 제거. |

### 5.2 축소 시 조치 (참고)

| 위치 | 축소 시 조치 |
|------|--------------|
| lib/schedule-from-product.ts | fallback 분기 제거. schedule만 파싱. |
| app/products/[id]/page.tsx | include itineraries 제거. getScheduleFromProduct에 schedule만 넘김. |
| app/api/admin/products/[id]/route.ts | 응답에서 itineraries 제거 또는 schedule만 반환. (UI 전환 후) |
| app/api/admin/products/route.ts | Itinerary createMany 제거. |
| app/api/admin/products/v2/route.ts | schedule 필드 저장 추가 후 createMany 제거. |
| app/api/travel/parse-and-upsert/route.ts | itinerary createMany 제거. |
| app/api/travel/parse-and-register/route.ts 및 전용 등록 route들 | itinerary createMany 제거(정책 변경 시 각 핸들러 정합). |
| app/api/gallery/route.ts | ✅ 적용: dayCount = schedule 길이 우선. (선택: include itineraries 제거는 fallback 제거 후) |
| app/admin/products/[id]/page.tsx | schedule만 편집하도록 UI 전환. Itinerary 섹션·버튼 제거. |
| app/components/travel/TravelProductDetail.tsx | ✅ 적용: schedule만 사용. |

### 5.3 회귀 확인 체크리스트 (회귀 확인 후 축소 시)

- [ ] **DB**: `schedule IS NULL AND (SELECT COUNT(*) FROM Itinerary WHERE Itinerary.productId = Product.id) > 0` 인 Product가 0건인지 확인. 1건이라도 있으면 fallback 제거 시 해당 상품 상세에서 일정이 비어 보임.
- [ ] **schedule-from-product**: 위 조건 0건 확인 후 fallback 분기 제거 → 배포 후 상세·갤러리에서 해당 조건 상품 없으므로 회귀 없음.
- [ ] **products/[id]/page**: fallback 제거 후 `include: { itineraries }` 제거. getScheduleFromProduct에 itineraries 없이 넘겨도 동일 결과.

### 5.4 Itinerary 쓰기(createMany) 제거 전 선행 조건

1. **쓰기 경로가 모두 Product.schedule을 채우도록 보장**
   - admin/products v2: Product.create 시 `schedule` 필드 설정 추가(parsed itineraries → JSON). 기존에는 schedule 없이 itinerary만 createMany.
   - parse-and-upsert, parse-and-register(전용·공용), admin/products POST: 이미 schedule 씀. 유지.
2. **읽기 fallback 제거 완료**
   - schedule-from-product에서 Itinerary fallback 제거.
   - products/[id] include itineraries 제거.
   - (갤러리 dayCount는 이미 schedule 우선 적용됨.)
3. **Admin UI 전환**
   - admin/products/[id]에서 "Itinerary에서 일정 생성" 제거 또는 schedule 편집만 남김.
   - GET /api/admin/products/[id] 응답에서 itineraries 제거 가능(UI가 schedule만 쓰도록 변경 후).
4. **위 완료 후**  
   - app/api/admin/products/route.ts, v2/route.ts, parse-and-upsert, parse-and-register(전용·공용)에서 itinerary createMany 제거.
   - (선택) Itinerary 테이블/모델은 이후 단계에서 deprecated 또는 삭제 검토.
