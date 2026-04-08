# 봉투어 MVP 테이블 생성 스펙

`docs/bongtour-architecture-and-mvp-headers.md`를 기준으로 한 **실제 구현용 테이블 스펙**이다.  
SQL/Prisma 코드는 생성하지 않고, **최종 테이블 스펙 표**만 정리한다.  
itinerary/schedule 분리, A/B/운영 메타 분리, 원문 vs 정규화·파생 필드 구분 원칙을 유지한다.

---

## 1) 이번 턴 목표 요약

- **products** / **itinerary_days** / **product_departures** 3개 MVP 테이블에 대해, 스키마 설계에 바로 쓸 수 있는 **필드명·타입·null·기본값·인덱스·source** 정의.
- 상품 대표/고정 정보, 대표 가격 요약, destinationRaw·primaryDestination 구분, 운영 메타를 products에서 명확히 구분.
- itinerary_days는 원문 유지 필드와 productId+day 유니크 검토.
- product_departures는 출발일·가격·statusRaw/seatsStatusRaw·파생 플래그·syncedAt 및 productId+departureDate 유니크 검토.
- product_hotels, product_optional_tours, product_shopping_info 등 확장 테이블은 이번 턴에서 제외하고 후속으로만 명시.

---

## 2) products 생성안 표

**테이블 목적**: 상품 대표/고정 정보(A 상세) + 대표 가격 요약(A) + 봉투어 내부 운영 메타(C).  
날짜별 가격·출발확정·좌석은 product_departures로 분리.  
**상품목록/상세/고객 노출에서 직접 사용하는 필드**: id, originCode, title, destinationRaw 또는 primaryDestination, duration, airline, priceFrom, priceCurrency, mandatoryLocalFee, mandatoryCurrency, bgImageUrl, registrationStatus, primaryRegion, displayCategory, themeTags.

| 필드명 | 타입 제안 | NULL | 기본값 | Source | 비고 |
|--------|-----------|------|--------|--------|------|
| id | String | N | cuid | 운영 메타 | PK |
| originSource | String | N | — | A 상세 | 공급사 표시명 |
| originCode | String | N | — | A 상세 | 공급사 상품코드, (originSource, originCode) 복합 유니크 |
| originUrl | String | Y | — | A 상세 | 추적·중복체크, 유니크 강제하지 않음 |
| title | String | N | — | A 상세 | 원문 유지 |
| destinationRaw | String | Y | — | A 상세 | 목적지 원문 보존 |
| primaryDestination | String | Y | — | 운영 메타 | 정규화/대표값, 노출·필터 |
| duration | String | Y | — | A 상세 | N박N일 원문 |
| airline | String | Y | — | A 상세 | 원문 유지 |
| supplierGroupId | String | Y | — | A 상세 | 공급사 단체번호/운영번호(originCode와 역할 구분) |
| includedText | String | Y | — | A 상세 | 원문, 텍스트 길면 text |
| excludedText | String | Y | — | A 상세 | 원문, 텍스트 길면 text |
| criticalExclusions | String | Y | — | A 상세 | 상담용 요약 |
| isFuelIncluded | Boolean | Y | — | A 상세 | |
| isGuideFeeIncluded | Boolean | Y | — | A 상세 | |
| mandatoryLocalFee | Float | Y | — | A 상세 | 현지 필수 금액 |
| mandatoryCurrency | String | Y | — | A 상세 | USD, EUR 등 |
| priceFrom | Int | Y | — | A 상세 | 대표 최저가(원 단위 권장) |
| priceCurrency | String | Y | — | A 상세 | KRW 등, priceFrom과 쌍 |
| shoppingCount | Int | Y | — | A 상세 | 0=노쇼핑 |
| shoppingItems | String | Y | — | A 상세 | 품목 요약 |
| brandId | String | Y | — | 운영 메타 | Brand FK |
| registrationStatus | String | Y | 'pending' | 운영 메타 | pending/registered/on_hold/rejected |
| rejectReason | String | Y | — | 운영 메타 | |
| rejectedAt | DateTime | Y | — | 운영 메타 | |
| primaryRegion | String | Y | — | 운영 메타 | 검수 시 확정 |
| displayCategory | String | Y | — | 운영 메타 | |
| themeTags | String | Y | — | 운영 메타 | |
| targetAudience | String | Y | — | 운영 메타 | |
| counselingNotes | String | Y | — | 운영 메타 | JSON 등 |
| bgImageUrl | String | Y | — | 운영 메타 | |
| bgImageSource | String | Y | — | 운영 메타 | pexels, gemini 등 |
| bgImagePhotographer | String | Y | — | 운영 메타 | |
| bgImageSourceUrl | String | Y | — | 운영 메타 | |
| bgImageExternalId | String | Y | — | 운영 메타 | |
| needsImageReview | Boolean | N | false | 운영 메타 | |
| imageReviewRequestedAt | DateTime | Y | — | 운영 메타 | |
| createdAt | DateTime | N | now() | 운영 메타 | |
| updatedAt | DateTime | N | now() | 운영 메타 | 갱신 시 업데이트 |

**유니크**: **(originSource, originCode)** — 공급사별 상품코드만으로는 전 공급사 통합 시 충돌 가능하므로 복합 유니크. originCode 단독 unique 사용하지 않음.  
**인덱스 후보**: (originSource, originCode) unique, originUrl(중복체크용, 유니크 아님), brandId, supplierGroupId(보조), registrationStatus, primaryDestination, updatedAt(목록 정렬).

---

## 3) itinerary_days 생성안 표

**테이블 목적**: 공급사 원문 일정표(itinerary) 정본. 일차별 1 row.  
원문 유지용 필드: dateText, city, summaryTextRaw, poiNamesRaw, meals, accommodation, transport, notes, rawBlock.  
바로 렌더 가능한 필드: day, dateText, city, summaryTextRaw, poiNamesRaw, meals, accommodation, transport, notes는 그대로 표시 가능하나, “렌더용 가공”은 schedule 계층에서 수행 권장.

| 필드명 | 타입 제안 | NULL | 기본값 | Source | 비고 |
|--------|-----------|------|--------|--------|------|
| id | String | N | cuid | 운영 메타 | PK |
| productId | String | N | — | 운영 메타 | Product FK |
| day | Int | N | — | A 상세 | 일차 1,2,3… |
| dateText | String | Y | — | A 상세 | 해당 일 날짜 표기 원문 |
| city | String | Y | — | A 상세 | 도시/지역 원문 |
| summaryTextRaw | String | Y | — | A 상세 | 해당 일 일정 요약 문장 원문 |
| poiNamesRaw | String | Y | — | A 상세 | 방문지/POI 나열 원문 |
| meals | String | Y | — | A 상세 | 식사 원문 |
| accommodation | String | Y | — | A 상세 | 숙박 원문 |
| transport | String | Y | — | A 상세 | 현지 교통 원문 |
| notes | String | Y | — | A 상세 | 유의사항 원문 |
| rawBlock | String | Y | — | A 상세 | 해당 일 원문 블록 전체(text/JSON) |

**유니크**: (productId, day) — 상품당 일차당 1 row.  
**인덱스 후보**: productId, (productId, day) unique.

---

## 4) product_departures 생성안 표

**테이블 목적**: 출발일/달력/가격/상태 동기화(B). 주기 갱신용.  
원문 보존: statusRaw, seatsStatusRaw, localPriceText.  
파생: isConfirmed, isBookable(추출 가능 시에만 채움).  
MVP 핵심: 날짜·가격·상태·수집시각(syncedAt). 시각(시간) 정보는 별도 항공 상세/상품 대표 정보 계층에서 관리.

| 필드명 | 타입 제안 | NULL | 기본값 | Source | 비고 |
|--------|-----------|------|--------|--------|------|
| id | String | N | cuid | 운영 메타 | PK |
| productId | String | N | — | 운영 메타 | Product FK |
| departureDate | **Date** | N | — | B 달력/가격 | 출발일(날짜만). MVP는 날짜 단위 동기화, 시각은 별도 계층 |
| adultPrice | Int | **Y** | — | B 달력/가격 | 원 단위. 가격 미노출/문의형/파싱 실패 시에도 row 저장 가능 |
| childBedPrice | Int | Y | — | B 달력/가격 | |
| childNoBedPrice | Int | Y | — | B 달력/가격 | |
| infantPrice | Int | Y | — | B 달력/가격 | |
| localPriceText | String | Y | — | B 달력/가격 | 현지 지불 표기 원문 |
| statusRaw | String | Y | — | B 달력/가격 | 출발일 상태 표기 원문 |
| seatsStatusRaw | String | Y | — | B 달력/가격 | 잔여/예약 표기 원문 |
| isConfirmed | Boolean | Y | — | B 달력/가격 | 파생, statusRaw 기반 |
| isBookable | Boolean | Y | — | B 달력/가격 | 파생, seatsStatusRaw 등 기반 |
| minPax | Int | Y | — | B 달력/가격 | 최소 출발 인원 |
| syncedAt | DateTime | Y | — | 운영 메타 | 주기 수집 시 갱신 |

**유니크**: (productId, departureDate) — 상품당 출발일당 1 row.  
**인덱스 후보**: productId, (productId, departureDate) unique, departureDate(달력 조회).

---

## 5) 인덱스/유니크 후보 정리

| 테이블 | 유니크 | 인덱스 후보 |
|--------|--------|-------------|
| products | **(originSource, originCode)** | (originSource, originCode) unique, originUrl, brandId, supplierGroupId, registrationStatus, primaryDestination, updatedAt |
| itinerary_days | (productId, day) | productId, (productId, day) unique |
| product_departures | (productId, departureDate) | productId, (productId, departureDate) unique, departureDate |

---

## 6) 지금은 제외하고 후속으로 남길 테이블·필드

**테이블**
- **product_hotels** — 호텔 정보(A 상세)
- **product_optional_tours** — 선택관광(A 상세)
- **product_shopping_info** — 쇼핑 상세(A 상세)
- **product_supplier_meta** — 공급사 raw 메타 보존

**필드(후속 계산/확장)**  
- **product_departures.priceGap** — 전일 대비 차액 등 기준 정의가 모호하므로 MVP 본문 스펙에서는 제외. 후속에서 “전일 대비 / 직전 수집 대비 / 직전 출발일 대비” 등 정의 확정 후 계산·분석 필드로 추가 검토.

후기 본문, 평점/리뷰 수 고객 노출은 제외.  
이번 턴에서는 위 테이블·priceGap 스키마 정의하지 않음.

---

## 7) 다음 턴에서 바로 이어질 작업 추천

1. **Prisma 스키마 반영**  
   이 스펙을 바탕으로 `prisma/schema.prisma`에 Product(이름 유지 또는 products), ItineraryDay(itinerary_days), ProductDeparture(product_departures) 모델 추가/수정.  
   기존 Product/ProductPrice/Itinerary와의 마이그레이션·호환 전략 결정 후 적용.

2. **마이그레이션 전략**  
   기존 Product 테이블이 있으면, destination→destinationRaw/primaryDestination, priceFrom/priceCurrency 추가, ProductPrice→product_departures 전환 여부 및 단계별 마이그레이션 계획 수립.

3. **시트/CSV 헤더 생성**  
   수집 파이프라인에서 채울 컬럼과 매핑 규칙을, 이 스펙의 필드명을 헤더로 한 시트 또는 CSV 템플릿으로 정리.

4. **API/관리자 화면 필드 매핑**  
   목록/상세 API와 관리자 UI가 사용할 필드 목록을 이 스펙의 “상품목록/상세/고객 노출에서 직접 사용” 필드와 맞춰 문서화.

---

## 이번 보정 반영 사항

1. **originCode 단독 UNIQUE 제거, 복합 유니크로 변경**  
   products 유니크를 **(originSource, originCode)** 로 변경. 공급사별 코드 체계 차이·우연 충돌 방지. originUrl은 유니크 강제하지 않고 인덱스 후보만. supplierGroupId 인덱스 후보 명시.

2. **product_departures.departureDate 타입 보정**  
   DateTime → **Date**. MVP는 출발일 단위 가격/상태 수집용이며, 시각 정밀도는 별도 항공·상품 계층에서 관리한다는 비고 추가.

3. **product_departures.adultPrice NOT NULL 완화**  
   adultPrice를 **nullable** 허용. 가격 미노출/문의형/파싱 실패 시에도 statusRaw·localPriceText·isBookable 등과 함께 row 단위 보존 가능하도록 함.

4. **priceGap MVP 본문에서 제외**  
   priceGap는 기준 정의 모호(전일 대비/직전 수집/직전 출발일 대비)하므로 MVP product_departures 표에서 제거. 후속·확장 필드 섹션에만 “후속 계산 필드”로 명시.

5. **groupCode → supplierGroupId 용어 통일**  
   문서 전체에서 공급사 단체번호/운영번호 계열을 **supplierGroupId**로 통일. **originCode** = 공급사 상품코드, **supplierGroupId** = 공급사 단체번호/운영번호로 역할 명시.
