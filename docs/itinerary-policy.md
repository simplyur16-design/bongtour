# 일정 데이터 계층 정책 (Schedule / Itinerary / ItineraryDay)

이 문서는 봉투어에서 **일정 관련 데이터**가 세 계층으로 나뉘어 있으며, 각각의 역할과 경로별 사용 방식을 명시한다. 구조 변경이 아니라 **정책 명시**가 목적이다.

**관련 문서**: [봉투어 아키텍처 및 MVP 헤더](bongtour-architecture-and-mvp-headers.md).  
**구분**: ProductDeparture는 **출발일/가격/상태** 계층이므로 일정 계층(schedule / Itinerary / ItineraryDay)과 혼동하지 않는다.

---

## 1. 용어와 역할 정의

아래 세 가지를 같은 뜻으로 쓰지 않는다.

### A. `Product.schedule`

| 항목 | 내용 |
|------|------|
| **역할** | 현재 앱/프론트 **렌더링용** 일정 JSON |
| **특징** | UI 친화적 가공 구조. day, title, description, imageUrl 등 |
| **원문** | **아님**. 가공·표시용 결과물 |
| **유지 이유** | 기존 화면/흐름과의 호환. 당분간 제거하지 않음 |

### B. 레거시 `Itinerary`

| 항목 | 내용 |
|------|------|
| **역할** | 과거 일정 저장 계층 (Product 1:N, day + description) |
| **현황** | 일부 경로에서 여전히 createMany 등으로 유지됨 |
| **제거** | 즉시 제거 대상 아님 |
| **목적** | 호환성 유지용 레거시 계층. 읽기 시 schedule 우선, Itinerary는 fallback |

### C. `ItineraryDay`

| 항목 | 내용 |
|------|------|
| **역할** | **공급사 원문 일정표 정본** |
| **특징** | 원문 보존 우선. (productId, day) 유니크, deleteMany 후 createMany로 갱신 |
| **위치** | **신규 확장의 기준축** |
| **용도** | 원문 검증 / 적재 / 운영 확인의 기준 계층. 관리자 "원문 일정표" 조회 소스 |

---

## 2. 경로별 사용 정책

아래 표는 **실제 코드 흐름**에 맞춘 것이다.

| 경로 | Product.schedule | 레거시 Itinerary | ItineraryDay 적재 | 입력 소스 예시 |
|------|------------------|------------------|-------------------|----------------|
| **parse** (`POST /api/travel/parse`) | ✅ 사용 | ❌ 미사용 | ✅ 사용 | `data.schedule` → `scheduleWithImages` |
| **parse-and-register-*** (모두·참좋은·하나·노랑 전용 + 잔여 `POST /api/travel/parse-and-register`) | ✅ 사용 | ✅ 사용 | ✅ 사용 | `parsed.schedule` → `scheduleWithImages` |
| **parse-and-upsert** (`POST /api/travel/parse-and-upsert`) | ✅ 사용 | ✅ 사용 | ✅ 사용 | `parsed.itineraries` → schedule JSON / Itinerary createMany / `parsedItinerariesToDayInputs` |
| **admin/products** (POST 상품 저장) | ✅ 사용 | ✅ 사용 | ✅ 사용 | `parsed.itineraries` 또는 `product.itinerary`(ExtractedProduct) → `extractedItineraryToDayInputs` / `parsedItinerariesToDayInputs` |
| **admin/products** (상세 화면) | ✅ 읽기·편집 | — | ✅ 조회 전용 (API `GET .../itinerary-days`) | Product.schedule 편집 시 PATCH만 반영, Itinerary/ItineraryDay 별도 적재 없음 |

**중요**:

- **parse** 경로는 **Product.schedule + ItineraryDay**만 사용하고, **레거시 Itinerary를 쓰지 않는다.** 이는 오류가 아니라, ItineraryDay 중심 전환 흐름의 일부로 해석한다.
- admin 상세에서 "일차별 일정(schedule)" 저장은 **Product.schedule**만 갱신하며, ItineraryDay는 parse 계열 경로를 통해서만 적재된다.

---

## 3. 권장 정책 문구

- **Product.schedule**는 당분간 유지한다. 기존 UI가 schedule을 써도 괜찮다.
- **레거시 Itinerary**는 즉시 제거하지 않는다. 호환성 유지 목적.
- **ItineraryDay**는 공급사 원문 일정표 정본으로 간주한다. 원문 검증/보존 기준은 ItineraryDay다.
- **신규 개발/확장**은 가능하면 **ItineraryDay 중심**으로 한다.
- parse 경로에서 레거시 Itinerary를 생략하는 것은 **허용**되며, 구조 정리 과정의 일부로 본다.
- **ProductDeparture**는 일정 계층이 아니라 **출발일/가격/상태** 계층이므로 schedule / Itinerary / ItineraryDay와 혼동하지 않는다.

---

## 4. 이번 턴에서 하지 않는 일

- Product.schedule 제거
- 레거시 Itinerary 제거
- ItineraryDay 구조 변경
- 고객용 UI 개편
- ProductDeparture 정책까지 과도하게 확장
- POI 매핑, 일정 편집 기능 추가
