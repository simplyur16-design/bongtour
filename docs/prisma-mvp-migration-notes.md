# Prisma MVP 스키마 마이그레이션·호환 안내

`docs/mvp-table-creation-spec.md` 기준으로 반영한 Product / ItineraryDay / ProductDeparture 변경 시 참고.

---

## 기존 Product와의 호환

### 1. originCode 단독 unique → 복합 unique

- **변경**: `originCode @unique` 제거, `@@unique([originSource, originCode])` 추가.
- **영향**: 기존에 `prisma.product.findUnique({ where: { originCode } })` 또는 `findFirst({ where: { originCode } })` 사용처는 **반드시** `originSource`를 함께 사용해야 함.
- **수정 예**:
  - `findUnique({ where: { originCode: code } })`  
    → `findUnique({ where: { originSource_originCode: { originSource, originCode } } })`
  - 또는 `findFirst({ where: { originSource, originCode } })`
- **수정 필요 파일**: `app/api/travel/parse-and-register/route.ts`, `app/api/travel/parse-and-upsert/route.ts` — 둘 다 `prisma.product.findUnique({ where: { originCode } })` 사용. `originSource`(또는 brand/parsed 출처)와 함께 복합 조건으로 변경 필요.
- **마이그레이션 순서**: 기존 DB에 동일한 `originCode`를 가진 row가 서로 다른 `originSource`라면 이미 구분 가능. 다른 공급사가 같은 코드를 쓴 경우에만 복합 유니크 전환 시 충돌 가능성이 있으므로, 마이그레이션 전에 `SELECT originCode, COUNT(*) FROM Product GROUP BY originCode HAVING COUNT(*) > 1` 등으로 중복 여부 확인 권장.

### 2. destination / destinationRaw / primaryDestination

- **추가 필드**: `destinationRaw`, `primaryDestination` 추가. 기존 `destination`은 유지(레거시).
- **호환**: 기존 코드가 `product.destination`을 쓰면 그대로 동작. 신규 수집/노출에서는 `destinationRaw`(원문), `primaryDestination`(정규화) 사용 권장. 필요 시 한 번에 `destination` → `destinationRaw`로 데이터 이관 스크립트 실행 가능.

### 3. priceFrom / priceCurrency / supplierGroupId

- **추가 필드**: 모두 nullable. 기존 데이터에는 null로 두면 됨. API/관리자에서 채우는 쪽으로 점진 반영 가능.

### 4. schedule / Itinerary / ItineraryDay

- **유지**: `Product.schedule`, `Itinerary` 모델은 당장 제거하지 않음. 읽기 시 schedule 우선, 없으면 Itinerary fallback 등 기존 로직 유지 가능.
- **추가**: `ItineraryDay`는 공급사 원문 일정표(itinerary) 정본용. 신규 수집은 ItineraryDay에 쌓고, 기존처럼 schedule JSON을 생성하는 파이프라인은 ItineraryDay 기반으로 만들 수 있음.

### 5. ProductPrice / ProductDeparture

- **유지**: `ProductPrice`는 그대로 두고, 기존 목록/달력이 이걸 쓰면 계속 사용.
- **추가**: `ProductDeparture`는 MVP 스펙의 출발일/가격/상태(B) 동기화용. 신규 달력 수집은 ProductDeparture에 저장하고, 필요 시 ProductPrice와 병행 사용하거나 이후 전환할 수 있음.
- **확장 (항공·미팅)**: `ProductDeparture`에 출발 회차별 `carrierName`, 왕복 항공편/공항/시각(`outbound*` / `inbound*`), `meeting*Raw` 필드가 nullable로 추가됨. 기존 row는 null 유지. 스키마 반영 후 `npx prisma generate` 및 `npx prisma db push`(또는 마이그레이션) 실행.

---

## 마이그레이션 실행 시 주의

1. **SQLite**: `prisma migrate dev`로 마이그레이션 생성 시, 기존 `Product.originCode` unique 인덱스가 있으면 제거되고 `(originSource, originCode)` 복합 유니크로 대체되는 마이그레이션 SQL이 생성됨. 기존 데이터에 `(originSource, originCode)` 중복이 있으면 마이그레이션 적용 시 실패하므로, 사전에 중복 제거 또는 보정 필요.
2. **departureDate**: Prisma에는 Date 타입이 없어 `DateTime` 사용. 날짜만 쓸 경우 00:00:00 UTC 등으로 저장하고, 조회 시 날짜 부분만 사용하도록 일관하면 됨.
3. **adultPrice optional**: ProductDeparture.adultPrice는 nullable. 가격 미노출/문의형 row도 저장 가능.

---

## 다음 단계 추천

1. **마이그레이션 실행**: `npx prisma migrate dev --name mvp_composite_unique_and_new_models` (이름은 임의). 또는 기존 DB가 비어 있거나 개발용이면 `npx prisma db push`로 스키마만 맞춤.
2. **API 반영**: 상품 조회/등록/수정 시 `originSource`+`originCode` 조합 사용, `destinationRaw`/`primaryDestination`/`priceFrom`/`priceCurrency`/`supplierGroupId` 읽기·쓰기 추가. 목록/상세에서 ItineraryDay·ProductDeparture 연동 여부 결정.
3. **시트 헤더 생성**: 수집 파이프라인용 CSV/시트 헤더를 스펙 필드명(Product, ItineraryDay, ProductDeparture)으로 정리하고, 매핑 규칙 문서화.
