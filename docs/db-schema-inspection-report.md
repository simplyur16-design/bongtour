# prisma/dev.db vs schema.prisma 점검 보고서

**점검 일시:** 2026-03 기준 (스크립트 `scripts/inspect-db-schema.ts` 실행 결과 기반)

**최종 동기화:** `prisma db push` 실행 후 재점검 완료. 아래 "동기화 후 상태" 섹션 참고.

---

## 1) 점검 대상 DB 파일

| 항목 | 결과 |
|------|------|
| **파일** | `prisma/dev.db` (SQLite) |
| **존재** | 존재함 |
| **접근** | `DATABASE_URL=file:./prisma/dev.db` (프로젝트 루트 기준) 또는 절대 경로로 접근 가능 |

---

## 2) Product 실제 컬럼/유니크 상태

### 2-1. 요청한 컬럼 존재 여부

| 컬럼 | schema.prisma | dev.db 실제 | 비고 |
|------|----------------|-------------|------|
| originSource | O | **존재** | TEXT, notnull |
| originCode | O | **존재** | TEXT, notnull |
| destinationRaw | O | **없음** | schema에만 있음 |
| primaryDestination | O | **없음** | schema에만 있음 |
| supplierGroupId | O | **없음** | schema에만 있음 |
| priceFrom | O | **없음** | schema에만 있음 |
| priceCurrency | O | **없음** | schema에만 있음 |
| needsImageReview | O | **존재** | BOOLEAN, notnull, default false |
| imageReviewRequestedAt | O | **존재** | DATETIME, nullable |

### 2-2. Product 유니크/인덱스 상태 (실제 조회 결과)

| 항목 | schema 기대 | dev.db 실제 |
|------|-------------|-------------|
| **(originSource, originCode) 복합 유니크** | `@@unique([originSource, originCode])` | **없음** |
| **originCode 단독 unique** | 사용 안 함 (제거됨) | **존재함** — `Product_originCode_key` (unique, originCode 단일 컬럼) |
| **originUrl 인덱스** | 없음 (스키마에도 없음) | **없음** |

- 현재 DB에는 **과거 스키마** 기준 `originCode` 단독 unique만 있고,  
  스키마에 반영된 **복합 유니크 (originSource, originCode)** 는 적용되어 있지 않음.
- `sqlite_autoindex_Product_1`는 PK(id)용 자동 인덱스.

---

## 3) ItineraryDay 실제 생성 여부

| 항목 | 결과 |
|------|------|
| **테이블 존재** | **없음** |
| **근거** | `sqlite_master` 테이블 목록에 `ItineraryDay` 없음. `PRAGMA table_info(ItineraryDay)` 결과 컬럼 0개. |
| **schema 기대** | (productId, day) 복합 유니크 포함 테이블, 일정 원문용 컬럼 등 |

---

## 4) ProductDeparture 실제 생성 여부

| 항목 | 결과 |
|------|------|
| **테이블 존재** | **없음** |
| **근거** | `sqlite_master` 테이블 목록에 `ProductDeparture` 없음. `PRAGMA table_info(ProductDeparture)` 결과 컬럼 0개. |
| **schema 기대** | (productId, departureDate) 복합 유니크, adultPrice(nullable), departureDate(DateTime) 등 |

*(departureDate 타입, adultPrice nullable 등은 테이블 생성 후 PRAGMA로 확인 가능 — 현재는 테이블 미존재로 미확인)*

---

## 5) schema와 dev.db 불일치 여부

### 5-1. schema에는 있는데 dev.db에 없는 것

| 구분 | 항목 |
|------|------|
| **Product 컬럼** | destinationRaw, primaryDestination, supplierGroupId, priceFrom, priceCurrency |
| **Product 제약** | (originSource, originCode) 복합 유니크 |
| **테이블** | ItineraryDay, ProductDeparture |

### 5-2. dev.db에 있는데 schema와 다른 것

| 구분 | 항목 |
|------|------|
| **Product 인덱스** | `Product_originCode_key` — originCode **단독** unique. 현재 schema는 해당 단독 unique를 제거한 상태이므로, DB만 예전 구조 유지. |

### 5-3. 일치하는 부분

- Product: id, originSource, originCode, originUrl, title, destination, duration, airline, bgImage* 관련, counselingNotes, schedule, isFuelIncluded, isGuideFeeIncluded, mandatoryLocalFee/Currency, includedText, excludedText, criticalExclusions, shoppingCount/Items, registrationStatus, rejectReason, rejectedAt, **needsImageReview**, **imageReviewRequestedAt**, primaryRegion, themeTags, displayCategory, targetAudience, brandId, createdAt, updatedAt.
- Itinerary, ProductPrice, Booking, Brand, User, Account, Session 등 그 외 테이블은 목록에 존재 (개별 컬럼은 미점검).

---

## 6) 지금 바로 필요한 조치

1. **`prisma db push` 실행 권장**  
   - 목적: Product 누락 컬럼 5개 추가, originCode 단독 unique 제거 후 (originSource, originCode) 복합 유니크 적용, ItineraryDay/ProductDeparture 테이블 생성.
2. **push 전 확인**  
   - 동일한 `originCode`를 서로 다른 `originSource`로 가진 행이 이미 있으면, 복합 유니크 추가 시 제약 위반으로 push가 실패할 수 있음.  
   - 필요 시: `SELECT originCode, originSource, COUNT(*) FROM Product GROUP BY originCode HAVING COUNT(*) > 1` 등으로 중복 여부 확인 후, 중복 제거 또는 데이터 보정 후 push.
3. **백업**  
   - `prisma db push` 전에 `prisma/dev.db` 복사본 저장 권장.

---

## 7) 다음 작업 추천

1. **db push 실행 후 재점검**  
   - `scripts/inspect-db-schema.ts` 다시 실행해 Product 컬럼/인덱스, ItineraryDay/ProductDeparture 테이블·인덱스가 schema와 일치하는지 확인.
2. **마이그레이션 전략 검토**  
   - 향후 스키마 변경을 버전 관리하려면 `prisma migrate dev` 도입 검토 (현재는 migration 미사용).
3. **API/코드와의 일치**  
   - Product 복합 유니크 기준 조회/업서트는 이미 코드 반영됨. ItineraryDay·ProductDeparture 사용 코드는 별도 점검 권장.

---

## 동기화 후 상태 (db push 실행 후 재점검)

- **백업:** `prisma/dev.backup-before-db-push.db` 생성됨.
- **Product:** destinationRaw, primaryDestination, supplierGroupId, priceFrom, priceCurrency 컬럼 추가됨. originCode 단독 unique 제거, `Product_originSource_originCode_key` (originSource, originCode) 복합 유니크 적용됨.
- **ItineraryDay:** 테이블 생성됨. (productId, day) 복합 유니크 `ItineraryDay_productId_day_key` 존재.
- **ProductDeparture:** 테이블 생성됨. (productId, departureDate) 복합 유니크 `ProductDeparture_productId_departureDate_key` 존재. adultPrice INTEGER nullable, departureDate DATETIME.
- **불일치:** 없음. schema와 dev.db 일치.
