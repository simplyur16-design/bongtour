# 봉투어(BongTour) 아키텍처 원칙 및 MVP 헤더표

이 문서는 봉투어의 **공급사 상품 수집/저장/운영** 구조를 설계·수정할 때 반드시 따라야 하는 상위 지침과, **모두투어 기준 MVP**용 테이블 헤더 정의를 담는다.

Prisma 런타임/생성 규칙(직접 연결, alias, Windows 잠금 대응)은 `docs/PRISMA-RUNTIME-POLICY.md`를 기준으로 운영한다.

---

## 1) 용어 고정 요약

| 용어 | 정의 | 사용처 |
|------|------|--------|
| **itinerary** | 공급사 원문 일정표의 **구조화 데이터**. 일차·날짜·도시·방문지·식사·숙박·현지교통·유의사항·원문 블록 등 **정본 계층**. | DB 테이블·수집 스펙·API 필드명. 한글 UI/문서에서는 **일정표**로 표기. |
| **schedule** | 앱/프론트 **렌더링용** 일정 JSON 또는 표시용 가공 구조. itinerary를 바탕으로 화면 표시용으로 정리한 **결과물**. | 기존 코드의 `Product.schedule` 등. 신규 설계에서는 itinerary와 역할을 분리해 문서화. |
| **일정표** | 한글 사용자 표현. 영어 라벨은 **itinerary**. | 화면·문서. |

**금지**: “supply detail raw itinerary”와 “render-ready schedule”을 같은 뜻으로 혼용하지 않는다. 기존 `schedule` 필드는 유지 가능하나, 신규 설계·문서는 **itinerary(원문 보존)** 와 **schedule(표시용)** 을 구분해 진행한다.

**일정 데이터 3계층 정책**(Product.schedule / 레거시 Itinerary / ItineraryDay) 및 경로별 사용 방식은 **[일정 데이터 계층 정책](itinerary-policy.md)** 에 정리되어 있다.

---

## 2) MVP 헤더표 작성 원칙

- **상세 수집(A)** 와 **달력/가격 수집(B)** 를 같은 표·같은 테이블로 뭉뚱그리지 않는다.
- **등록용 1회 저장 데이터**와 **주기 동기화 데이터**를 분리한다.
- **공급사 원문**은 수정·재작성·AI 보완하지 않는다. 그대로 보존·매핑만 한다.
- **후기 본문**은 수집·활용 대상에서 제외. 평점/리뷰 수는 내부 참고용 검토만.
- MVP 헤더는 **products / itinerary_days / product_departures** 세 개 중심으로만 정의한다.
- 모두투어를 **첫 기준 공급사**로 두고, 상단 요약·탭형 상세(일정표, 호텔&관광, 선택관광, 쇼핑, 여행후기 제외)·출발일 변경 달력 구조를 전제로 한다.

---

## 3) products 헤더표

상품 **대표/고정 정보** + **대표 가격 요약** + **봉투어 내부 운영 메타**. 날짜별 세부 가격·출발확정·좌석은 넣지 않으며 `product_departures`로 분리한다.

| 필드(영문) | 한글 설명 | 수집 구분 | 비고 |
|------------|-----------|-----------|------|
| id | 내부 PK | 운영 메타 | cuid 등 |
| originSource | 공급사 표시명 | A 상세 | 모두투어, 하나투어 등 |
| originCode | 상품코드(공급사 부여) | A 상세 | 동기화 키, unique |
| originUrl | 공급사 상세 페이지 URL | A 상세 | 추적·중복체크·재수집 |
| title | 상품명 | A 상세 | 원문 유지 |
| destinationRaw | 목적지 표기 원문 | A 상세 | 공급사 표기 그대로 보존 |
| primaryDestination | 대표 목적지(정규화/대표값) | 운영 메타 | 검수·노출·필터용, 원문 아님 |
| duration | 여행기간(N박N일) | A 상세 | 원문 유지 |
| airline | 항공사 요약 | A 상세 | 원문 유지 |
| supplierGroupId | 공급사 단체번호/운영번호 | A 상세 | originCode(상품코드)와 역할 구분, 공급사에 있을 경우만 |
| includedText | 포함 내역 전체 텍스트 | A 상세 | 원문 유지 |
| excludedText | 불포함 내역 전체 텍스트 | A 상세 | 원문 유지 |
| criticalExclusions | 상담용 불포함 요약 | A 상세 | 가이드비·유류 등 핵심만 |
| isFuelIncluded | 유류할증료 포함 여부 | A 상세 | boolean |
| isGuideFeeIncluded | 가이드/기사 경비 포함 여부 | A 상세 | boolean |
| mandatoryLocalFee | 현지 필수 지불액(숫자) | A 상세 | 가이드비 등 |
| mandatoryCurrency | 현지 화폐(USD, EUR 등) | A 상세 | |
| priceFrom | 대표 최저가(숫자) | A 상세 | 목록/상세 노출용, 날짜별 아님 |
| priceCurrency | 대표 가격 통화(KRW 등) | A 상세 | priceFrom과 쌍 |
| shoppingCount | 쇼핑 방문 횟수 | A 상세 | 0이면 노쇼핑 |
| shoppingItems | 쇼핑 품목 요약 | A 상세 | 쉼표 등 |
| brandId | 봉투어 브랜드(여행사) FK | 운영 메타 | |
| registrationStatus | 등록대기/등록완료/보류/반려 | 운영 메타 | |
| rejectReason / rejectedAt | 반려 시 사유·시각 | 운영 메타 | |
| primaryRegion | 대표 지역 | 운영 메타 | 검수 시 확정 |
| displayCategory | 노출 카테고리 | 운영 메타 | |
| themeTags | 테마 태그 | 운영 메타 | |
| targetAudience | 타깃 고객 | 운영 메타 | |
| counselingNotes | 정밀 메모(JSON 등) | 운영 메타 | |
| bgImageUrl | 대표 이미지 URL | 운영 메타 | |
| bgImageSource | 이미지 출처(pexels, gemini 등) | 운영 메타 | |
| bgImagePhotographer | 이미지 작가명 | 운영 메타 | |
| bgImageSourceUrl / bgImageExternalId | 이미지 원본 URL/외부 ID | 운영 메타 | |
| needsImageReview | 이미지 보강 검수 대상 플래그 | 운영 메타 | |
| imageReviewRequestedAt | 보강 요청 시각 | 운영 메타 | |
| createdAt / updatedAt | 생성/수정 시각 | 운영 메타 | |

**제외**: 출발일별 가격·출발확정·잔여좌석·예약 가능 여부 → `product_departures` 로 분리.  
**목적지**: 원문은 `destinationRaw`, 정규화/대표값은 `primaryDestination`. (후속: cityTextRaw, countryTextRaw, cityListNormalized는 확장 시 검토.)

---

## 4) itinerary_days 헤더표

공급사 **원문 일정표** 구조. 일차별 row, **원문 보존** 중심. 요약/방문지/식사/숙박/교통/노트를 구분해 필드명이 오해되지 않게 정의한다. 렌더용 가공(schedule)은 별도 계층.

| 필드(영문) | 한글 설명 | 수집 구분 | 비고 |
|------------|-----------|-----------|------|
| id | 내부 PK | 운영 메타 | |
| productId | 상품 FK | 운영 메타 | |
| day | 일차(1, 2, 3…) | A 상세 | |
| dateText | 해당 일 날짜 표기(원문) | A 상세 | 공급사 표기 그대로 |
| city | 도시/지역(원문) | A 상세 | 원문 유지 |
| summaryTextRaw | 해당 일 일정 요약 문장(원문) | A 상세 | 한 줄 요약 등, 원문 그대로 |
| poiNamesRaw | 방문지/POI 이름 나열(원문) | A 상세 | 쉼표·줄바꿈 등 공급사 표기 그대로 |
| meals | 식사(조/중/석)(원문) | A 상세 | 원문 유지 |
| accommodation | 숙박(원문) | A 상세 | 원문 유지 |
| transport | 현지 교통(원문) | A 상세 | 원문 유지 |
| notes | 유의사항/특이사항(원문) | A 상세 | 원문 유지 |
| rawBlock | 해당 일 원문 블록 전체(텍스트 또는 JSON) | A 상세 | 보존용, 선택 |

**역할**: 공급사 일정표 정본. 화면 표시용 가공은 `schedule`(JSON) 등 별도 파이프라인에서 itinerary_days 기반으로 생성.  
**명명**: 요약문은 `summaryTextRaw`, 방문지 나열은 `poiNamesRaw`로 구분해 “요약 vs POI 리스트” 혼동 방지.

---

## 5) product_departures 헤더표

**출발일/달력/가격/상태** 동기화. **주기 갱신**용. 상세 1회 수집(A)과 분리. MVP에서는 **원문 보존(raw)** 우선, 파생 플래그는 선택.

| 필드(영문) | 한글 설명 | 수집 구분 | 비고 |
|------------|-----------|-----------|------|
| id | 내부 PK | 운영 메타 | |
| productId | 상품 FK | 운영 메타 | |
| departureDate | 출발일(date) | B 달력/가격 | |
| adultPrice | 성인 요금(숫자) | B 달력/가격 | |
| childBedPrice | 아동(베드) 요금(숫자) | B 달력/가격 | |
| childNoBedPrice | 아동(노베드) 요금(숫자) | B 달력/가격 | |
| infantPrice | 유아 요금(숫자) | B 달력/가격 | |
| localPriceText | 현지 지불액 표기(원문) | B 달력/가격 | 예: $60, 원문 유지 |
| priceGap | 전일 대비 차액(숫자) | B 달력/가격 | 선택 |
| statusRaw | 해당 출발일 상태 표기(원문) | B 달력/가격 | 공급사 문자열 그대로 보존 |
| seatsStatusRaw | 잔여 좌석/예약 관련 표기(원문) | B 달력/가격 | 공급사 제공 시 원문 유지 |
| isConfirmed | 출발확정 여부(파생) | B 달력/가격 | statusRaw 기반 추출 가능 시 boolean |
| isBookable | 예약 가능 여부(파생) | B 달력/가격 | seatsStatusRaw 등 기반 추출 가능 시 boolean |
| minPax | 최소 출발 인원(숫자) | B 달력/가격 | 공급사 제공 시 |
| syncedAt | 동기화 시각 | 운영 메타 | 주기 수집 시 갱신 |

**역할**: 상품(products)의 “언제 출발하고 그날 얼마인지·상태”만 담음. 상품명·일정표·포함불포함은 products / itinerary_days 에만 둠.  
**원칙**: `statusRaw`·`seatsStatusRaw`로 원문 보존을 우선하고, `isConfirmed`·`isBookable`은 파생 가능할 때만 채운다.

---

## 6) 후속 확장 헤더 (선택)

MVP 이후, 공급사별로 필요 시 아래 테이블을 추가할 수 있다. 모두 **A 상세 수집** 범주(등록용 1회 저장).

| 테이블 | 용도 | 주요 필드 예시 |
|--------|------|----------------|
| **product_hotels** | 호텔 정보 | productId, day, hotelName, grade, region, rawText |
| **product_optional_tours** | 선택관광 | productId, name, priceUsd, duration, waitPlaceIfNotJoined |
| **product_shopping_info** | 쇼핑 정보 상세 | productId, count, itemsJson 또는 rawText |
| **product_supplier_meta** | 공급사 raw 보존 | productId, metaKey, metaValue 또는 rawJson |

- **여행후기 본문**은 수집·저장·노출 대상에서 제외.
- **평점/리뷰 수**는 내부 참고용으로만 검토하며, 고객 노출은 별도 정책 없이 보류.

---

## 참고: 수집 구조 3분리

- **A. 공급사별 기본 상세 정보 수집** — 등록용, 비교적 고정. products / itinerary_days / (선택) product_hotels 등.
- **B. 공급사별 달력/가격/좌석 동기화 수집** — 가격 관제용, 주기 갱신. product_departures.
- **C. 봉투어 내부 운영 메타** — 대표 이미지, 이미지 출처, needsImageReview, originUrl 중복 경고, registrationStatus 등. products 등에 컬럼으로 존재.

이 문서는 **모두투어**를 첫 기준 공급사로 한 **최종 MVP 헤더 보정판**이다. 다른 공급사 확장 시 동일 원칙으로 헤더를 추가·매핑한다.

---

## 이번 보정 포인트 요약

- **A. products 가격 요약**  
  상품목록/상세/상담 기초가 되는 대표 가격을 products에 명시. `priceFrom`(대표 최저가 숫자), `priceCurrency`(대표 가격 통화) 추가. 날짜별 세부는 계속 `product_departures`에만 둠.
- **B. itinerary_days 필드명 명확화**  
  모호한 `highlights` 제거. `summaryTextRaw`(해당 일 일정 요약 문장 원문), `poiNamesRaw`(방문지/POI 이름 나열 원문)로 역할 분리. 식사/숙박/교통/노트와 구분되게 원문 보존 관점으로 명명.
- **C. product_departures 상태 필드 보정**  
  원문 보존 우선으로 `statusRaw`, `seatsStatusRaw` 추가. 파생 플래그 `isConfirmed`, `isBookable`은 추출 가능 시에만 채우도록 명시. raw와 파생을 구분해 구현 시 혼동 방지.
- **D. destination 원문/정규화 분리**  
  `destination` 단일 필드를 `destinationRaw`(공급사 목적지 표기 원문)와 `primaryDestination`(대표 목적지, 정규화/검수·노출용)로 분리. MVP에서 cityTextRaw, countryTextRaw, cityListNormalized는 후속 확장으로 두고 문서에만 언급.

---

## 개발자 참고: 핵심 원칙 5개

1. **itinerary(원문 일정표 정본)와 schedule(렌더용 가공)을 혼용하지 않는다.**  
   DB·수집·API는 itinerary 계열로 원문 보존; 화면 표시는 schedule 등 별도 파이프라인.
2. **상세 수집(A)와 달력/가격 수집(B)를 한 테이블·한 표에 섞지 않는다.**  
   products / itinerary_days = 등록·고정 정보. product_departures = 주기 동기화.
3. **공급사 원문은 수정·재작성·AI 보완하지 않는다.**  
   Raw 필드(`*Raw`, `rawBlock` 등)는 그대로 보존·매핑만. 정규화/대표값은 별도 필드(`primaryDestination` 등).
4. **대표 가격 요약은 products에, 날짜별 가격·상태는 product_departures에만 둔다.**  
   products: priceFrom, priceCurrency. product_departures: adultPrice, statusRaw, seatsStatusRaw 등.
5. **상태·목적지 등은 “원문 필드”와 “정규화/파생 필드”를 문서·스키마에서 분리해 둔다.**  
   destinationRaw vs primaryDestination. statusRaw/seatsStatusRaw vs isConfirmed/isBookable.
