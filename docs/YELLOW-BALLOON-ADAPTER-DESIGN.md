# 노랑풍선(Yellow Balloon) 공급사 어댑터 설계안

**범위**: 설계·스캐폴딩만. selector·API·엔드포인트는 미확정 → 코드에 **TODO**로 남김.  
**비포함**: 하나투어, 참좋은/모두투어 구현 복붙 금지.

---

## 구현 순서 (고정)

1. **식별축**: 화면 상품번호를 곧바로 `originCode`로 확정하지 말고, **URL / 내부 스크립트 / XHR** 기준으로 `originCode` · `supplierGroupId` · `supplierDepartureCode` 를 **분리 판별**한다. ([ID 체크리스트](./YELLOW-BALLOON-ID-CHECKLIST.md))
2. **출발일**: 팝업은 **F12 Network**로 검토하고, **우측 리스트 1행 = `DepartureInput` 1건**. 좌측 달력은 **월 이동·검증용**이다. ([F12 체크리스트](./YELLOW-BALLOON-F12-CHECKLIST.md))
3. **`collectYellowBalloonDepartureInputs`**: VERYGOODTOUR / MODETOUR 와 **분리된 별도 adapter**로 구현한다 (`lib/ybtour/ybtour-adapter.ts`).
4. **일정표**: **일정 탭만** 정본으로 `ItineraryDay` 를 만들고, 핵심포인트·리뷰·요약으로 day를 **임의 생성하지 않는다** (`lib/ybtour/ybtour-itinerary-collector.ts`).

---

## 1) YellowBalloonAdapter 설계안

### 1.1 식별·모듈

| 항목 | 값 |
|------|-----|
| 내부 `originSource` (고정) | `YBTOUR` — 상수 `YBTOUR_SOURCE` (`lib/ybtour/ybtour-adapter.ts`) |
| 핵심 식별 | `originSource` + `originCode` (복합 유니크). `supplierGroupId`는 **보조** 식별값 |
| 모듈 위치 | `lib/ybtour/*` 전용 — `verygoodtour-departures.ts` / `modetour-departures.ts` **수정하지 않음** |

### 1.1a 대표 상품 식별값(`originCode`) 확정

- **화면에 보이는 상품번호를 곧바로 `originCode`로 확정하지 않는다.**
- **상세 URL**, 페이지 **내부 스크립트**, **XHR/fetch 응답** 등을 기준으로, 해당 값이 **대표 상품 식별값(SSOT 후보)**인지 먼저 확인한다.
- **`supplierGroupId`** 또는 출발 행 단위 **`supplierDepartureCode` 후보**는 `originCode`와 **역할이 다를 수 있으므로** 분리해 검토한다 (한 덩어리로 밀어 넣지 않는다).

### 1.2 출발일·가격 기준

- 출발일 팝업에서는 **우측 리스트 1행 = `DepartureInput` 1건**을 **1차 기준**으로 사용한다.
- 좌측 달력은 가격 정답 소스로 단정하지 않고, **월 이동 / 교차검증 / 중복 확인용**으로만 사용한다.

### 1.3 탭 분리 준비

- 타입 수준에서 `YellowBalloonProductInfoCollector` / `YellowBalloonTermsCollector` / `YellowBalloonItineraryCollector` / `YellowBalloonOptionsCollector` 로 구분하고, **실제 구현은 TODO**로 남긴다.
- (선택) 추후 `lib/ybtour/collectors/*.ts` 로 파일 분리.

### 1.3a `ItineraryDay` 정본 범위

- **일정 탭** 또는 **일정 원문 블록**(공급사가 일정으로 제시하는 본문)만 `ItineraryDay` 정본 소스로 삼는다.
- **핵심포인트·상품요약·리뷰** 등 **보조 텍스트만으로 일차를 임의 생성하지 않는다** (추측 일정 금지).
- 일정 탭 수집 실패 시 **`ItineraryDay`가 비어 있을 수 있으며**, 이 경우 **승인 게이트에서 막히는 것이 정상**이다.

### 1.4 옵션·쇼핑·관광

- 구조화 가능한 범위는 `OptionalTour`, `shoppingCount`, `shoppingItems` **후보**로 정리한다.
- **현재 Prisma 스키마에 없는 필드는 임의 추가하지 않는다.**
- 원문은 **raw text** 기준으로 우선 보존한다 (`rawBlock`, `counselingNotes` JSON 슬라이스, `includedText`/`excludedText` 등 기존 필드 활용 후보).

### 1.5 적재 원칙

| 계층 | 내용 |
|------|------|
| 출발일·가격·상태 | `DepartureInput` → `upsertProductDepartures` |
| 일정표 | `ItineraryDayInput` → `upsertItineraryDays` |
| Product | **출발일별** 가격·상태·좌석을 넣지 않는다 (대표 요약 `priceFrom` 등만 기존 정책대로) |

### 1.5a Raw 추적·검증 보조 (`rawRowText`·`rawPayload`·`supplierDepartureCode` 후보)

- 위 값들은 **정규화가 끝난 비즈니스 필드가 아니라**, **추적·검증용 보조 정보**로 다룬다.
- **raw 보존**은 기존 **raw/debug 성격 필드** 또는 **`YellowBalloonCollectMeta` 등 collect meta**를 우선한다.
- **`originCode`·`adultPrice`·`departureDate` 등 핵심 비즈니스 필드를** 추측성 raw 문자열로 **오염시키지 않는다** (임시로 `localPriceText`에 붙일 때도 **접두 한정·길이 제한** 등으로 구분).

### 1.6 mappingStatus 처리

- 모두투어에서 **운영상 중요한 개념**이라는 점은 유지한다.
- 현재 Prisma에 `ProductDeparture.mappingStatus` 컬럼이 **없으면**, 노랑풍선에서는 **DB 컬럼으로 강행 추가하지 않는다** (별도 합의 없이 스키마 변경 금지).
- 필요 시 `YellowBalloonCollectMeta` 또는 raw/debug 메타 수준에서만 보존한다.

### 1.7 스캐폴딩 파일

- `lib/ybtour/ybtour-adapter.ts` — 출발 수집 진입점 + 메타 타입 (빈 구현 + TODO)

---

## 2) 예상 수집 흐름

1. **`originUrl`(노랑풍선 상품 상세) 진입**
   - TODO: 로드·세션·차단 여부 확인
   - TODO: **상세 URL·내부 스크립트·XHR/fetch** 기준으로 대표 상품 식별값(SSOT 후보) 확인 — **화면 상품번호를 `originCode`로 즉시 확정하지 않음**
   - TODO: 필요 시 `supplierGroupId`·`supplierDepartureCode` 후보와 **분리 검토**

2. **출발일 팝업 오픈**
   - TODO: 실제 오픈 트리거, DOM 구조, XHR/fetch 여부 확인

3. **출발일·가격 수집**
   - 좌측 달력으로 월 이동
   - 우측 리스트를 스크롤·페이지 단위로 순회
   - **우측 리스트 행을 기준으로 `DepartureInput` 생성**
   - 좌측 달력은 월 정보 및 리스트 일치 여부 **검증용**으로만 사용

4. **출발 리스트 행 적재**
   - 행 → `DepartureInput`
   - `supplierDepartureCode`·`rawRowText`·`rawPayload` 후보는 **추적·검증용**으로만 다루고, **§1.5a** (meta·raw 필드 우선, 비즈니스 필드 비오염)
   - 공통 upsert로 `ProductDeparture` 적재

5. **상세 탭 수집**
   - Product 기본 정보 수집
   - **`ItineraryDay`**: **일정 탭 또는 일정 원문 블록**만 정본 — 핵심포인트·상품요약·리뷰로 일차 **임의 생성 금지**
   - 포함·불포함·약관, 옵션·쇼핑·관광은 Product raw 보조 필드 후보로 검토
   - **일정 탭 수집 실패 시 `ItineraryDay`가 비어 있을 수 있으며, 승인 게이트에서 막히는 것이 정상**

6. **운영 원칙 유지**
   - 예약은 자동 확정이 아니라 **접수** 구조
   - DAY 이미지 **수동 선택** 정책을 깨지 않음
   - 자동 이미지 주입으로 수동 이미지를 **덮어쓰지 않음**

---

## 3) Product / ProductDeparture / ItineraryDay 매핑 영향

### 3.1 충돌·원칙

- **충돌 없음**
  - Product: `(originSource, originCode)` 유지
  - ProductDeparture: `(productId, departureDate)` 유지
  - ItineraryDay: `(productId, day)` 유지
- **핵심 원칙**
  - Product = 대표·고정 정보
  - ProductDeparture = 출발일별 가격·상태·좌석·변동 정보
  - ItineraryDay = 일정표 원문·일차별 정보

### 3.2 명세 필드 vs 현재 Prisma

`supplierProductNo`, `rawSnapshot`, `mappingStatus`(행 레벨), `dayImageAssetId` 등은 **현재 Prisma 컬럼과 다르거나 없을 수 있음**. 실제 반영은 **아래 대조표** 기준.

### 3.3 사용자 제시 필드명 ↔ **현재 Prisma** (대조표)

**Product**

| 제시 명세 | 현재 스키마 | 비고 |
|-----------|-------------|------|
| `originSource`, `originCode`, `supplierGroupId` | 동일 | **`originCode`는 URL·스크립트·XHR 등으로 대표 식별값 확인 후 확정** — 화면 상품번호 단정 금지. `supplierGroupId`는 보조 |
| `title` | `title` | |
| `categoryMain` | `displayCategory` / `primaryRegion` / `themeTags` | 운영 메타에 분산 — 하나로 고정하지 말 것 |
| `destinationSummary` | `destinationRaw` + `primaryDestination` | |
| `summaryText` | (직접 필드 없음) | `counselingNotes` JSON 또는 추후 필드 |
| `reviewScore`, `reviewCount` | 없음 | TODO: 스킵 또는 `counselingNotes` |
| `mainImageUrl` | `bgImageUrl` | |
| `durationSummary` | `duration` | |
| `airlineSummary` | `airline` | |
| `guideIncluded` | `isGuideFeeIncluded` 등 | |
| `singleChargeAmount`, `localExpenseRaw` | `mandatoryLocalFee` + `mandatoryCurrency` / 텍스트는 `criticalExclusions` 등 | |
| `policyTextRaw`, `inclusionTextRaw`, `exclusionTextRaw`, `benefitsTextRaw` | `includedText`, `excludedText`, `criticalExclusions` | |
| `status` | `registrationStatus` | 공급사 판매상태와 혼동 주의 |
| `rawSnapshot` | 직접 컬럼 없음 | TODO: HTML 스냅샷 필요 시 별도 설계 |

**ProductDeparture**

| 제시 명세 | 현재 스키마 | 비고 |
|-----------|-------------|------|
| `productId`, `departureDate`, 가격·상태·좌석·minPax | 동일 개념 | `childBedPrice`, `childNoBedPrice`, `localPriceText`, `statusRaw`, `seatsStatusRaw`, `minPax` |
| 행 단위 `originSource` 등 | **Product에만** | 추적용 키는 **meta·접두 붙은 `localPriceText`** 등 — **정규화 필드 오염 금지** |
| `supplierDepartureCode` | 없음 | **후보·추적용** — §1.5a. 스키마 추가는 별도 합의 |
| `currency` | 없음 (원화 가정 시 `adultPrice` 정수) | |
| `rawDeparturePayload` | 없음 | TODO: 스키마 또는 로그 |
| `mappingStatus` | **DB 컬럼 없음** | `YellowBalloonCollectMeta` 등 메타만 |
| `collectedAt` / `updatedAt` | `syncedAt` | |

**ItineraryDay**

| 제시 명세 | 현재 스키마 | 비고 |
|-----------|-------------|------|
| `dayNumber` | `day` | |
| `title`, `summary` | `summaryTextRaw` / `city` / `rawBlock` | |
| `visitSpotsRaw` | `poiNamesRaw` | |
| `mealInfoRaw` | `meals` | |
| `hotelInfoRaw` | `accommodation` | |
| `routeTextRaw` | `transport` 또는 `rawBlock` | |
| `rawBlock` | `rawBlock` | |
| `dayImageAssetId` 등 | **현재 없음** | **DAY 이미지 수동 정책**: 어댑터는 **텍스트만** 적재 |
| (정본 소스) | 일정 탭·일정 원문 | **요약·리뷰·핵심포인트로 일차 생성 금지** |

---

## 4) 기존 완료 adapter와의 충돌 여부

| 구분 | 판정 |
|------|------|
| 파일·로직 분리 | `lib/ybtour/` 신규만 추가 — VERYGOODTOUR / MODETOUR **직접 수정 없음** |
| 공통 계약만 공유 | `DepartureInput`, `ItineraryDayInput`, upsert 유틸만 재사용 |
| 파싱 경로 공유 금지 | 참좋은여행 HTML fragment 방식 **재사용 금지** / 모두투어 API형 **가정 금지** / 노랑풍선은 **별도 adapter** |

---

## 5) TODO (미확정 사항)

- 상세 URL / 내부 스크립트 / XHR·fetch 기준 **`originCode`(대표 식별값) 확정 규칙** — 화면 번호 단정 금지
- **`supplierGroupId`·`supplierDepartureCode` 후보**와의 분리·매핑 규칙 확정
- 출발 리스트 row별 **`supplierDepartureCode` 존재 여부** 확인
- 팝업 오픈 트리거 / DOM / XHR 형식 확인
- 우측 리스트 컬럼 의미 / **가상 스크롤** 여부 확인
- 달력 vs 리스트 **동기화·중복 제거** 규칙 확인
- 세션 / 쿠키 / 차단 여부 확인
- 일정 탭이 HTML 정적인지, 비동기 API인지 확인
- 옵션·쇼핑·관광을 `OptionalTour`까지 구조화할지 여부 결정
- `supplier-origin` 정규화에 `YELLOWBALLOON` 추가 **시점** 결정

---

## 6) 위험 포인트

| 위험 | 완화 |
|------|------|
| **가상 스크롤**로 리스트 행이 DOM에 모두 없을 수 있음 | 스크롤·대기·재캡처 전략 TODO |
| 달력만 보고 날짜·가격을 채우면 **실제 리스트와 불일치** | **우측 리스트 행이 1차 소스** |
| 탭 비동기 로딩 실패 시 일정이 비어도 **정상 완료처럼 보임** | 승인 게이트·검수 정책과 연동 |
| 요약·리뷰·핵심포인트에서 **일차를 임의 생성** | `ItineraryDay`는 일정 탭·원문 블록만 — **§1.3a** |
| raw 추적 문자열이 **`originCode`/가격 필드로 스며듦** | **§1.5a** — meta·raw 전용 경로 유지 |
| 자동 이미지 주입이 DAY 이미지 수동 정책을 깸 | 어댑터는 텍스트만 |
| 수집 데이터를 **예약 확정**으로 오인 | 접수 구조 원칙 유지 |
| 화면 상품번호를 **`originCode`로 성급히 고정** | 이후 동기화 꼬임 — 추출 규칙 확정 후 반영 |

---

## 7) 수정·추가 파일

| 파일 | 내용 |
|------|------|
| `docs/YELLOW-BALLOON-ADAPTER-DESIGN.md` | 설계안 전문 / Prisma 대조표 / 위험 / TODO |
| `lib/ybtour/ybtour-adapter.ts` | 상수 / 메타 타입 / collector 타입 / `collectYellowBalloonDepartureInputs` 스텁 |

---

## 8) 남은 TODO (실무)

1. 식별축 실측: `docs/YELLOW-BALLOON-ID-CHECKLIST.md` 로 **originCode / supplierGroupId / supplierDepartureCode** 판별 후, 팝업·리스트 스펙 확정 → `collectYellowBalloonDepartureInputs` 구현
2. `admin-departure-rescrape` 등 라우팅에 `YELLOWBALLOON` 분기 연결은 **별도 커밋**
3. 필요 시 `normalizeOriginSource` 또는 공급사 정규화 유틸에 노랑풍선 브랜드 키 추가
4. 일정 탭 collector가 안정화되면 `ItineraryDayInput` 실제 적재 연결
5. 옵션·쇼핑·관광 raw 보존 필드 반영 필요 시 **스키마 변경 여부 별도 검토**

---

## 9) 관련 문서

- `docs/YELLOW-BALLOON-ID-CHECKLIST.md` — **originCode / supplierGroupId / supplierDepartureCode** 브라우저·네트워크 판별 체크리스트
- `docs/YELLOW-BALLOON-F12-CHECKLIST.md` — **F12 Network·DOM** 실전 검토 (팝업·월 이동·탭·일정)
- `docs/YELLOW-BALLOON-COLLECT-IMPLEMENTATION.md` — **`collectYellowBalloonDepartureInputs`** 의사코드·중복 규칙·식별 반영 위치
- `docs/YELLOW-BALLOON-ITINERARY-COLLECTOR.md` — **일정 탭 → `ItineraryDayInput[]`** (ItineraryCollector 설계)
- `docs/itinerary-policy.md` — ItineraryDay 정본·schedule 관계
- `lib/verygoodtour-departures.ts`, `lib/modetour-departures.ts` — **참고만**, 복제 금지
