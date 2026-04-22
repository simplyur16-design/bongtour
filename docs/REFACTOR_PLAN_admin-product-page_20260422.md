# 관리자 상품 페이지 리팩토링 계획

대상 파일: `app/admin/products/[id]/page.tsx` (기준 시점 **3310줄**, `'use client'`)

> 참고: 기본보내기 컴포넌트명은 **`AdminProductDetailPage`** 입니다. (일부 문서에서 `ProductEditPage`로 부르는 경우와 혼동 주의)

---

## 1. 현재 파일 구조

### 1-1. import 블록

- **대략 1–44행** (약 **44줄**).
- React 훅, `next/link`, `next/navigation`, 다수 `@/lib/*` (sanitize, supplier, consumption, flight manual, listing kind, hero upload 등), API 응답 타입 1건.

### 1-2. 타입 / 인터페이스 선언 구간

| 구간 (행) | 이름 |
|-----------|------|
| 46–54 | `ProductPrice` |
| 56–63 | `ScheduleEntry` |
| 65–68 | `PromotionReferencePrices` |
| 70–126 | `Product` |
| 164–177 | `ItineraryDayRow` |
| 180–210 | `DepartureRow` |
| 212–223 | `OptionalTourDraft` |
| 225–230 | `StructuredSectionView` |
| 232–243 | `StructuredSignalsView` |
| 637–646 | `FlightManualFormLegDraft` |
| 648–651 | `FlightManualFormDraft` |

모듈 스코프 **상수** (타입과 인접):

- **144–153행**: `REGISTER_PUBLIC_PAGE_TRACE_BULLETS_BY_MODULE`
- **277행**: `FALLBACK_IMAGE`
- **766–779행**: `HERO_SOURCE_SELECT`

### 1-3. 모듈 스코프 함수·상수 (함수명 + 대략 줄 수)

| 항목 | 시작 행 | 대략 줄 수 |
|------|-----------|------------|
| `fmcModuleForAdminProduct` | 128 | ~15 |
| `registerPublicPageTraceBulletsForProduct` | 155 | ~7 |
| `formatDepartureDt` | 245 | ~5 |
| `adminDepartureText` | 252 | ~4 |
| `hasFlightOrMeeting` | 257 | ~19 |
| `parseSchedule` | 279 | ~22 |
| `parseAirtelHotelInfo` | 300 | ~14 |
| `parseOptionalToursDraft` | 314 | ~30 |
| `parseDetailBodyReviewFromRawMeta` | 343 | ~18 |
| **`parseStructuredSignalsView`** | **361** | **~244** |
| `parseFlightStructuredFromRawMeta` | 606 | ~12 |
| `parseFlatFlightNosFromRawMeta` | 619 | ~17 |
| `emptyFlightManualLegDraft` | 653 | ~12 |
| `emptyFlightManualFormDraft` | 666 | ~6 |
| `trimField` | 673 | ~4 |
| `legFinalFromDraft` | 678 | ~12 |
| `buildFlightManualCorrectionForSave` | 691 | ~28 |
| `draftFromFlightManualCorrection` | 720 | ~31 |

### 1-4. 내부 컴포넌트 (`export default` 바깥)

| 이름 | 행 | 비고 |
|------|-----|------|
| `ScheduleImage` | 752–763 | `useState`로 이미지 깨짐 시 fallback |
| `PrimaryImagePreview` | 781–792 | 동일 패턴 |

**그 외 별도 `function Foo` 형태의 내부 컴포넌트는 없음** (대량 JSX는 모두 `AdminProductDetailPage` 본문).

### 1-5. 메인 컴포넌트 `AdminProductDetailPage`

- **794–3309행** (`export default function AdminProductDetailPage` ~ 파일 끝 직전 `}`).
- **1273–1278행**: `loading || !product` 시 조기 `return` (로딩 UI).
- 그 이후 **1281–1354행**: 파생 값·`savePublicDetailTexts` / `saveOptionalTours` 등 (로딩 완료 후에만 매 렌더 실행되는 블록).
- **1356–3307행**: 본문 `return` JSX (`<div className="min-h-screen …">` … `</main></div>`).

---

## 2. 메인 컴포넌트 내부

### 2-1. `useState` (메인 컴포넌트 내, 803–863행 부근)

이름과 타입/초기값 요지만 정리 (서브컴포넌트 `ScheduleImage` / `PrimaryImagePreview`의 `broken` 상태는 제외).

| state | 타입/형태 요약 |
|--------|----------------|
| `product` | `Product \| null` |
| `loading` | `boolean` |
| `id` | `string \| null` |
| `scheduleEntries` | `ScheduleEntry[]` |
| `scheduleDirty` | `boolean` |
| `savingSchedule` | `boolean` |
| `priceForm` | `{ adult, childBed, childNoBed, infant }` |
| `savingPrice` | `boolean` |
| `registering` | `boolean` |
| `generatingSchedule` | `boolean` |
| `imageReviewSaving` | `boolean` |
| `imageReviewMessage` | `string \| null` |
| `primaryImageUploading` | `boolean` |
| `heroReselectBusy` | `boolean` |
| `primaryImageMessage` | `string \| null` |
| `heroMetaDraft` | `{ source, photographer, sourceUrl, externalId }` |
| `savingHeroMeta` | `boolean` |
| `heroMetaMessage` | `string \| null` |
| `manualHeroUploadPreset` | `AdminManualPrimaryHeroUploadPreset` |
| `manualHeroUploadOtherNote` | `string` |
| `itineraryDays` | `ItineraryDayRow[] \| null` |
| `departures` | `DepartureRow[] \| null` |
| `optionalToursDraft` | `OptionalTourDraft[]` |
| `savingOptionalTours` | `boolean` |
| `optionalToursSnapshot` | `string` (JSON 스냅샷) |
| `publicDetailDraft` | `{ included, excluded }` |
| `savingPublicDetail` | `boolean` |
| `rescraping` | `boolean` |
| `hanatourPickMonthYm` | `string` |
| `rescrapingHanatourMonth` | `boolean` |
| `departureRescrapeReport` | `AdminDeparturesRescrapeResponseBody \| null` |
| `basicDraft` | `{ title, duration, airline, travelScope, listingKind }` |
| `benefitDraft` | `string` |
| `counselingDraft` | `string` |
| `flightAdminDraft` | `string` |
| `savingBasic` / `savingBenefit` / `savingCounseling` / `savingFlightAdmin` | `boolean` |
| `flightManualPanelOpen` | `boolean` |
| `flightManualDraft` | `FlightManualFormDraft` |
| `savingFlightManual` | `boolean` |

### 2-2. `useMemo` / `useCallback`

- `supplierInternal` — `product` 기반 공급사 파생.
- `flightManualContext` — `rawMeta` + `supplierInternal` 기반 항공 자동/수동 컨텍스트.
- `isHanatourAdminProduct` — 하나투어 계열 여부.
- `fetchProduct` — `useCallback`, `id`로 GET 후 `product`·일정·옵션 드래프트 동기화.

### 2-3. `useEffect` (9개, 908–1036행)

| 의존성 (요약) | 역할 |
|----------------|------|
| `[params]` | `params`에서 `id` 추출 → `setId` |
| `[product?.id, includedText, excludedText]` | 공개 포함/불포함 드래프트 동기화 |
| `[product?.id, title, duration, …]` | 기본·혜택·상담·항공 JSON 드래프트 동기화 |
| `[id]` | `itinerary-days` GET |
| `[id]` | `departures` GET |
| `[id, fetchProduct]` | 마운트/ id 변경 시 상품 로드 |
| `[product?.id, loading]` | 해시 `#admin-product-hero-image`일 때 히어로로 스크롤 |
| `[product?.prices]` | 첫 행 가격 → `priceForm` |
| `[product?.id, bgImage*]` | 히어로 메타 드래프트 동기화 |

### 2-4. 이름 있는 핸들러 (요약)

| 이름 | 역할 |
|------|------|
| `fetchProduct` | 상품 GET 및 파생 상태 초기화 |
| `updateScheduleEntry` | 일정표 항목 필드 수정 + dirty |
| `generateScheduleFromItineraries` | 일정 JSON으로 스케줄 생성·PATCH |
| `saveSchedule` | 스케줄 PATCH 저장 |
| `handlePrimaryImageUpload` | 대표 이미지 파일 업로드 |
| `pickScheduleEntryAsHero` | 일정 이미지를 히어로로 채택 |
| `runTravelProcessImagesReselect` | 이미지 재처리/재선택 API |
| `saveHeroImageMeta` | 히어로 출처 메타 PATCH |
| `savePublicDetailTexts` | 포함/불포함 텍스트 PATCH |
| `saveOptionalTours` | 현지옵션 구조화 문자열 PATCH |

이 외 **재스크랩·등록·섹션별 저장·가격 저장·항공 수동 모달 저장** 등은 JSX 안 **인라인 `async` 핸들러**로 다수 존재.

### 2-5. JSX 구조 (탭/섹션)

- **상단 UI**: `hasScheduleImages` 배너, sticky **header** (목록 링크, 제목, 편집 모드 뱃지, 재스크랩/하나투어 월별 수집, 원본·미리보기·등록 버튼 등).
- **`departureRescrapeReport`** 블록.
- **`<main>`** 내부:
  - 요약 카드 (공급사·목적지·프로모션 참고가 등).
  - `isEditMode`일 때 **앵커 네비** (`#ops-basic`, `#ops-benefit`, `#ops-flight`, `#ops-optional`, `#ops-first-price`, `#ops-memo`) 및 안내 문구.
  - `detailBodyReview`, `showRegisterTrace` 트레이스, **`structuredSignalsView`** 진단 섹션.
  - **`<section id="ops-*">`**: 기본정보 → 혜택 → 관리자 항공(+항공 수동 모달) → 상담 메모 → (에어텔 시) 호텔 정보 → 현지옵션 → … (일정/스케줄 이미지/대표 이미지/가격 등 대형 블록) → **`ops-first-price`** → 가격 캘린더 → Itinerary 목록.
- **탭 라이브러리는 없음**; **앵커 ID + 조건부 섹션**으로 운영 화면이 구성됨.

---

## 3. 분리 우선순위

### 레벨 1 (쉬움·안전)

- **타입/인터페이스** → `app/admin/products/[id]/_types.ts` (또는 동등 경로).
- **순수 유틸** (DOM/React 미사용, `parseStructuredSignalsView` **제외** 시 한 묶음) → `_lib/utils.ts` 등.
  - 예: 날짜/문자열 포맷, `parseSchedule`, `parseAirtelHotelInfo`, `parseOptionalToursDraft`, `parseDetailBodyReviewFromRawMeta`, `parseFlightStructuredFromRawMeta`, `parseFlatFlightNosFromRawMeta`, 항공 드래프트 빌더/트림, `fmcModuleForAdminProduct`, `registerPublicPageTraceBulletsForProduct`, 상수 `FALLBACK_IMAGE` / `HERO_SOURCE_SELECT` / `REGISTER_PUBLIC_PAGE_TRACE_BULLETS_BY_MODULE`.
- **`ScheduleImage`**, **`PrimaryImagePreview`** → `_components/` (각 파일 또는 단일 파일). 둘 다 **`'use client'`** 유지 필요.

### 레벨 2 (중간)

- **`parseStructuredSignalsView`** 및 전용 의존성 → `_lib/parsers.ts` (또는 `structured-signals.ts`). 공급사별 `publicConsumption*` 분기가 커서 **단위 테스트·빌드 한 번** 권장.
- **폼/로딩 상태** → `_hooks/useProductForm.ts` 등 (훅 추출 시 조기 `return` 아래의 함수 선언 순서·훅 규칙 재검증 필수).

### 레벨 3 (어려움·나중)

- **`ops-*` 섹션별 프레젠테이션 컴포넌트** 분리, 인라인 `onClick` 핸들러를 props/callback으로 끌어올리기.

---

## 4. Step-by-step 실행 계획 (레벨 1)

권장 **커밋 분리** (예시):

1. **`docs`만** (본 문서) — 이미 존재 시 스킵.
2. **`_types.ts` 추가** + `page.tsx`에서 타입 import로 치환 (동작 동일).
3. **`_lib/utils.ts` 추가** + 모듈 스코프 함수/상수 이전 ( **`parseStructuredSignalsView`는 당분간 `page.tsx`에 잔류** 가능 — 레벨 1 최소 범위).
4. **`_components/schedule-image.tsx`**, **`primary-image-preview.tsx`** (또는 통합 파일) + `page.tsx` import.
5. **`npx next build`** (또는 `next build`)로 타입·린트 포함 검증.

각 커밋 후 빌드 통과 확인. **push는 하지 않음** (승인 후).

---

## 5. 예상 최종 구조 (레벨 1 이후)

```
app/admin/products/[id]/
  page.tsx                 # 메인 페이지만 (대폭 축소 목표)
  _types.ts                # 타입·인터페이스만
  _lib/
    utils.ts               # 순수 함수 + 모듈 상수 (parsers 제외 시)
  _components/
    ScheduleImage.tsx      # 또는 schedule-and-hero-preview.tsx
    PrimaryImagePreview.tsx
```

### 레벨 1에서 **새로 생기는 파일 수**

- 최소 **4개**: `_types.ts`, `_lib/utils.ts`, 컴포넌트 **2개** (분리 방식에 따라 1개 파일로 합치면 3개).

### 예상 줄 수 (대략)

| 파일 | 예상 줄 수 |
|------|------------|
| `_types.ts` | **180–230** |
| `_lib/utils.ts` (parsers 제외) | **380–520** |
| `_components/*` (2컴포넌트) | **40–80** (주석·import 포함) |
| `page.tsx` (레벨 1만) | **약 2,650–2,850** ( `parseStructuredSignalsView` 잔류 시 상한에 가깝게) |

`parseStructuredSignalsView`까지 같은 단계에서 `_lib/parsers.ts`로 빼면 **page.tsx는 추가로 ~200–250줄 감소** (레벨 1 확장 커밋으로 처리 가능).

---

## 6. 리스크

1. **순환 의존**: `_types.ts`가 외부 타입(`FlightManualCorrectionPayload`, `FlightStructured` 등)만 re-export하면 양호; 역으로 `lib`가 admin 경로를 import하면 순환 위험.
2. **`parseStructuredSignalsView`**: `@/lib/public-consumption-*` 다점 참조 — `_lib/parsers.ts`로 옮길 때 **번들 크기·트리 쉐이킹**은 동일하지만, 경로만 깨지지 않게 주의.
3. **조기 `return` 이후 선언**: `savePublicDetailTexts` 등이 로딩 가드 **아래**에 있음. 훅을 `_hooks`로 옮길 때는 **모든 훅을 컴포넌트 최상단**으로 모을 것 — 레벨 2에서 구조 변경 시 회귀 위험.
4. **`'use client'`**: 새 파일이 훅/이벤트를 쓰면 해당 파일에 명시. `page.tsx`는 계속 클라이언트 페이지여야 함.
5. **`export default` 시그니처**: `params: Promise<{ id: string }> | { id: string }` 유지 (Next App Router 규약).

---

## 7. 승인 후 레벨 1 실행 시 체크리스트

- [ ] `refactor/admin-product-page-20260422` 브랜치에서 작업 (또는 동일 계획으로 재브랜치).
- [ ] 각 커밋 후 `npx next build` 성공.
- [ ] `/admin/products/[id]` 및 `/admin/products/[id]/edit` 수동 스모크 (로딩·저장·재스크랩·히어로).
- [ ] push는 **사용자 승인 후**만.

---

## Level 2 Hooks Analysis

> 기준: `AdminProductDetailPage` 내 **useState 약 40개** + **useEffect 9개** (레벨 1 이후 기준; 정확 개수는 `page.tsx` grep으로 확인).

### 2-1. useState 분류 (기능 축)

| 그룹 | 상태 예시 |
|------|-----------|
| **코어 / 라우팅** | `product`, `loading`, ~~`id`~~ → `useProductIdFromParams`로 분리됨 |
| **일정·스크래핑** | `scheduleEntries`, `scheduleDirty`, `savingSchedule`, `generatingSchedule`, ~~`itineraryDays`~~ → `useItineraryDays`로 분리됨, `departures`, `rescraping`, `hanatourPickMonthYm`, `rescrapingHanatourMonth`, `departureRescrapeReport` |
| **가격** | `priceForm`, `savingPrice` |
| **이미지·히어로** | `imageReviewSaving`, `imageReviewMessage`, `primaryImageUploading`, `heroReselectBusy`, `primaryImageMessage`, `heroMetaDraft`, `savingHeroMeta`, `heroMetaMessage`, `manualHeroUploadPreset`, `manualHeroUploadOtherNote` |
| **현지옵션·공개문구** | `optionalToursDraft`, `savingOptionalTours`, `optionalToursSnapshot`, `publicDetailDraft`, `savingPublicDetail` |
| **기본·혜택·메모·항공** | `basicDraft`, `benefitDraft`, `counselingDraft`, `flightAdminDraft`, `savingBasic`, `savingBenefit`, `savingCounseling`, `savingFlightAdmin` |
| **항공 수동 보정** | `flightManualPanelOpen`, `flightManualDraft`, `savingFlightManual` |
| **등록·기타** | `registering` |

### 2-2. 제안 훅 후보

| 훅 | 담당 | 비고 |
|----|------|------|
| `useProductIdFromParams` | `params` → `id` | **구현 완료** — 외부 상태 없음, 최상단 호출 안전 |
| `useItineraryDays` | `id` → itinerary GET | **구현 완료** — `setItineraryDays`를 페이지 밖에서만 사용하던 패턴과 동일 |
| `useProductDepartures` | `id` → departures GET + 재스크랩 후 `setDepartures` | 다음 후보; 다수 핸들러가 `setDepartures` 호출 → 훅에서 `refetch` 콜백 노출 필요 |
| `useProductBasicDrafts` | `basicDraft` / `benefitDraft` / `counselingDraft` / `flightAdminDraft` + product 동기화 effect | `product` 의존 강함 |
| `useProductHeroMeta` | 히어로 메타 draft + 관련 saving/message | 이미지 업로드 핸들러와 강결합 |
| `useProductOptionalTours` | optional draft + snapshot + saving | `fetchProduct`와 PATCH 흐름과 결합 |
| `useProductUI` | `loading`, 패널 열림 등 | 범위가 넓으면 오히려 복잡도 증가 |

### 2-3. 의존성·결합

- **`product` ↔ 거의 모든 draft·saving**: 한 번에 `useProductForm`으로 몰면 거대 훅이 됨 → 축별로 쪼개되, **`setProduct`를 여러 훅에 넘기면** 업데이트 순서·stale closure 주의.
- **`id` ↔ `fetchProduct` ↔ `scheduleEntries` / optional snapshot**: `fetchProduct`가 일정·옵션까지 초기화 — `useProductLoad` 단일화가 장기적으로 유리하나 **한 번에 옮기면 회귀 면적 큼**.
- **`departures`**: 초기 fetch + 재스크랩 버튼에서 동시 갱신 → `useDepartures(productId, { refetchKey })` 또는 `refetch()` 반환이 안전.

### 2-4. 추천 분리 순서 (안전 → 고위험)

1. ~~`useProductIdFromParams`~~ (완료)
2. ~~`useItineraryDays`~~ (완료)
3. **`useDepartures` 또는 `useProductSideData(id)`** — itinerary와 대칭; `refetch` API만 정리하면 됨
4. **`useHeroMetaDraft(product)`** — hero meta effect + draft state만 (저장 핸들러는 props로 주입)
5. **`useOptionalToursState`** — dirty 스냅샷 로직 분리
6. **`useProductLoad(id)`** — `fetchProduct` + loading + 초기 파생 상태 (대형, 마지막 단계 권장)
