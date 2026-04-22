# 리팩토링 분석 리포트

작성일: 2026-04-22  
대상: `app/admin/products/[id]/page.tsx`, `lib/register-from-llm-*.ts` (운영 4종)  
분석 방법: 소스 정적 구조·검색·부분 구간 열람, 줄 수는 Node `fs.readFileSync` 기준(개행 포함).

---

## 1. 관리자 상품 페이지 (3309줄)

**실측 줄 수:** `page.tsx` **3310줄**(마지막에 빈 줄 1줄 포함 가능). 사용자가 인용한 3309줄과 동일 규모로 간주하면 됨.

### 1.1 현재 구조

#### import 섹션

- **1행:** `'use client'` — App Router에서 클라이언트 전용 페이지.
- **3~43행 부근:** React(`useState`, `useEffect`, `useCallback`, `useMemo`, `Fragment`), `next/link`, `next/navigation`(`usePathname`, `useSearchParams`), 도메인 라이브러리 다수.
- **성격:** 공급사별 `public-consumption-*`, `flight-manual-correction-*`, `admin-register-verification-meta-*`, 상품 메타(`product-listing-kind`, `sanitize-text`, `admin-manual-primary-hero-upload` 등)가 한 파일에 집결.

#### 타입 / 인터페이스 선언

- **파일 상단(대략 46~243행):** `ProductPrice`, `ScheduleEntry`, `PromotionReferencePrices`, `Product`(대형), `ItineraryDayRow`, `DepartureRow`, `OptionalTourDraft`, `StructuredSectionView`, `StructuredSignalsView`.
- **중간(637행 부근):** `FlightManualFormLegDraft`, `FlightManualFormDraft` — 수동 항공 보정 폼용.
- **시작 키워드만 `type`/`interface`인 블록:** 10개 선언(다줄 블록으로 실제 줄 수는 더 큼. `Product` 타입만 수십 줄).

#### 컴포넌트 선언

| 구분 | 이름 | 역할 |
|------|------|------|
| 메인 | `export default function AdminProductDetailPage` | 상품 단건 조회·다수 섹션 편집·API `fetch` 연동 전부 |
| 내부 | `ScheduleImage` | 일정 썸네일 + `onError` 시 플레이스홀더, `useState` 1개 |
| 내부 | `PrimaryImagePreview` | 대표 이미지 미리보기 + `useState` 1개 |

그 외 **별도 `function Foo` 형태의 UI 컴포넌트는 없음** — 거대한 단일 `return` JSX가 본문을 차지.

#### 모듈 레벨 함수·상수 (메인 컴포넌트 밖)

- **공급사 라우팅:** `fmcModuleForAdminProduct`, `registerPublicPageTraceBulletsForProduct`, `REGISTER_PUBLIC_PAGE_TRACE_BULLETS_BY_MODULE`.
- **표시/파싱:** `formatDepartureDt`, `adminDepartureText`, `hasFlightOrMeeting`, `parseSchedule`, `parseAirtelHotelInfo`, `parseOptionalToursDraft`, `parseDetailBodyReviewFromRawMeta`, **`parseStructuredSignalsView`(대형, 약 361~605행 구간)**, `parseFlightStructuredFromRawMeta`, `parseFlatFlightNosFromRawMeta`, 항공 수동 보정 관련 `emptyFlightManualLegDraft` ~ `draftFromFlightManualCorrection` 등.
- **상수:** `FALLBACK_IMAGE`, `HERO_SOURCE_SELECT`.

#### 상태 관리 (메인 + 소형 컴포넌트)

- **`useReducer` / `react-hook-form`:** 사용 없음.
- **`useState`:** 파일 전체 **33회** 매칭 — 메인에 집중(상품 본문, 일정, 요금, 대표 이미지, 옵션투어, 공개 포함/불포함, 출발일 재스크랩, 기본/혜택/상담/항공 JSON, 항공 수동 패널 등). 소형 컴포넌트 2곳에 각 1개.
- **`useMemo`:** 3회 — `supplierInternal`, `flightManualContext`, `isHanatourAdminProduct`.
- **`useEffect`:** **9회** — `params`→`id`, `product` 동기화(포함/불포함·기본 드래프트·가격 폼·히어로 메타), `fetchProduct` 트리거, 히어로 스크롤 등.
- **`useCallback`:** `fetchProduct` 등 최소 사용.

#### 이벤트 핸들러

- **이름 붙은 비동기 핸들러(메인):** `generateScheduleFromItineraries`, `saveSchedule`, `handlePrimaryImageUpload`, `pickScheduleEntryAsHero`, `runTravelProcessImagesReselect`, `saveHeroImageMeta`, `savePublicDetailTexts`, `saveOptionalTours` 등.
- **JSX 내부:** `onClick={async () => { ... }}` 패턴 다수(출발일 재스크랩, 하나투어 월별, 등록, 기본 저장 등). `onClick` 계열 매칭 **24건 이상**(일부는 동기 람다).

#### 렌더링 JSX

- **로딩 분기:** `if (loading || !product)` 시 짧은 전체 화면 메시지.
- **본문:** 단일 대형 `<div>` → sticky **헤더**(목록 링크, 제목, 편집 모드, 출발일/등록/스크랩 버튼군) + `<main>` 아래 **`<h2>` 기준 15개 이상의 논리 섹션**(기본 정보, 혜택, flightAdminJson, 상담 메모, 에어텔 호텔, 현지옵션, 대표 이미지·출처, 일정 schedule, ItineraryDay, 구조화 신호/검증, 포함·불포함, 정제 미리보기, 첫 출발일 요금, 가격 캘린더, Itinerary 목록 등).

### 1.2 줄 수 기준 분포 (근사치)

정밀 자동 분류(중첩 JSX·인라인 핸들러)는 의미가 흐려지므로, **구간 경계(행 번호) 기준**으로 합리적 근사를 제시함.

| 구분 | 줄 수(근사) | 비고 |
|------|-------------|------|
| **import + `'use client'`** | **~44** | 첫 `type ProductPrice` 직전까지(공백 포함) |
| **타입 선언(`type`/`interface` 블록 전체)** | **~190~230** | 10개 선언; `Product` 등 다줄 블록 비중 큼 |
| **모듈 레벨 함수·상수·소형 컴포넌트** | **~520~560** | `parseStructuredSignalsView`만 ~245줄 수준 |
| **메인: 상태·훅·effect·pathname 등** | **~470~520** | 대략 794~1272행 구간(로딩 `return` 직전까지) |
| **메인: 파생 변수 + `savePublic*` 등 짧은 async** | **~70~90** | `sanitizedIncluded` ~ `saveOptionalTours` |
| **JSX(로딩 분기 + 본문 `return`)** | **~1,950~2,000** | 대략 1273~3308행 |

**요약:** 사용자 요청 5분류에 맞추면 다음처럼 **재라벨**하는 것이 타당함.

- **import:** ~44  
- **타입 선언:** ~200(순수 타입) + 나머지 모듈 로직은 “유틸/파서”로 별도 버킷 권장 (~550)  
- **상태/hooks:** 메인·소형 컴포넌트 합쳐 **~480~520**  
- **핸들러 함수:** 이름 있는 함수 몸통 **~300~400** + JSX 인라인 async는 **JSX 쪽에 수백 줄** 추가로 존재  
- **JSX:** **~1,950~2,000**

### 1.3 분리 가능한 단위 제안

#### 별도 컴포넌트로 뺄 수 있는 JSX 블록

- **헤더 액션 바:** 출발일 재스크랩, 하나투어 월별 스크랩, 등록 버튼 등 — `product`/`id`/다수 `busy` 상태 의존.
- **섹션 단위(제목 기준):** 기본 정보, 혜택·flightAdmin, 상담 메모, 에어텔 호텔, 현지옵션 테이블, 대표 이미지·수동 업로드·출처 메타, `schedule` 편집 그리드, ItineraryDay 테이블, 구조화 신호/트레이스(`registerTrace`), 포함·불포함 편집, 가격/캘린더.
- **공급사별 조건부 UI:** `isHanatourAdminProduct`, `supplierInternal`, `publicConsumption*` 분기 블록.

#### 별도 훅으로 뺄 수 있는 로직

- **`useAdminProduct(id)`:** `fetchProduct`, `loading`, `product`, `setProduct`, 관련 `useEffect`.
- **`useScheduleEditor`:** `scheduleEntries`, dirty, `saveSchedule`, `generateScheduleFromItineraries`, `updateScheduleEntry`.
- **`usePrimaryHero`:** 업로드, 재선정, 메타 PATCH, 메시지·busy 상태.
- **`useDeparturesRescrape`:** `departures`, POST `/departures`, 하나투어 월별, `departureRescrapeReport`.
- **`useOptionalToursDraft`:** draft/snapshot/dirty, `saveOptionalTours`.
- **`useFlightManualPanel`:** `flightManualDraft`, `flightManualContext`, 저장.

#### 별도 유틸로 뺄 수 있는 함수

- **`parseStructuredSignalsView` 및 rawMeta 파싱 일체** → `lib/admin-product-structured-signals.ts` 등(이미 `lib/detail-body-parser` 등과 역할 정리 필요).
- **일정/가격 표 포맷:** `formatDepartureDt`, `parseSchedule`, `parseOptionalToursDraft`.
- **항공 수동 보정 draft 변환** → `lib/admin-flight-manual-form.ts` (기존 `flight-manual-correction-*`와 경계 명확화).

#### 별도 파일로 뺄 수 있는 타입

- **`Product`, `ProductPrice`, API row 타입** → `types/admin-product-detail.ts` 또는 기존 API 타입과 통합.
- **폼 전용 draft 타입**(`OptionalTourDraft`, `FlightManualFormDraft` 등)은 해당 훅/컴포넌트 파일에 동반 가능.

### 1.4 예상 분리 후 구조 (주관적 근사)

| 항목 | 예상 |
|------|------|
| **메인 `page.tsx`** | **약 180~350줄** — 섹션 조립 + Provider(선택) + 데이터 훅 연결만 남기는 경우 |
| **신규 파일 수** | **약 12~20개**(훅 4~6 + 섹션 컴포넌트 6~10 + 타입/유틸 2~4). 팀 컨벤션에 따라 ± |
| **신규 파일당 줄 수** | 섹션 컴포넌트 **150~400줄**, 훅 **80~250줄**, 공유 타입 **80~200줄**, 파서 추출 시 **200~350줄** 단일 파일 가능 |

### 1.5 위험 요소

- **상태 공유:** `product` 단일 소스가 거의 모든 섹션과 PATCH 응답 갱신에 연결됨. 분리 시 **갱신 경로(`setProduct`)** 불일치로 UI 드리프트 위험.
- **props drilling:** 섹션 분리 시 `id`, `product`, `setProduct`, 공급사 파생값(`supplierInternal`, `brandForInternal`)이 반복 전달될 수 있음 → **React Context(관리자 상품 한정)** 또는 훅에서 `useCallback`으로 안정화된 액션만 노출하는 편이 유리.
- **App Router 경계:** 파일 전체가 `'use client'`이므로 분리 파일도 **기본적으로 Client Component**. Server Component로 내리기는 이 페이지 성격상 이득이 제한적(훅·이벤트 다수).
- **인라인 `fetch` + JSON 파싱:** 오류 처리·부분 성공 패턴이 섹션마다 미세하게 다름 → 공통 `patchAdminProduct` 유틸 도입 시 **회귀 범위 큼**.
- **`parseStructuredSignalsView`:** 공급사 모듈 키·레거시 DB 필드·메타 JSON에 강하게 결합 — 분리 시 **동작 동등성 검증**이 핵심.

### 1.6 추천 우선순위

1. **모듈 레벨 파서·타입** 외부 파일 이동(렌더 무관, 회귀는 단위 테스트로 상대적으로 통제 가능).  
2. **`ScheduleImage` / `PrimaryImagePreview` 확장 패턴**으로 작은 블록부터 JSX 슬라이스.  
3. **`fetchProduct` + 로딩** 훅 분리.  
4. 대형 섹션(일정·출발·대표 이미지) 훅+컴포넌트 병행 분리.  
5. 헤더 버튼군(등록·스크랩) — 비즈니스 임팩트 크므로 **E2E 또는 수동 시나리오** 후반에 배치.

---

## 2. LLM 파서 4개 파일

### 2.0 `ls` / glob으로 확인한 정확한 파일명

**프로젝트 `lib/` 기준 4개(요청 범위):**

1. `lib/register-from-llm-hanatour.ts`  
2. `lib/register-from-llm-modetour.ts`  
3. `lib/register-from-llm-verygoodtour.ts`  
4. `lib/register-from-llm-ybtour.ts`  

**참고:** `DEV/lib/register-from-llm-hanjintour.ts`가 glob 상 추가로 존재하나, 본 리포트의 “4개”는 운영 `lib/` 4종을 의미함.

### 2.1 각 파일 줄 수

| 파일 | 줄 수 |
|------|------|
| `lib/register-from-llm-hanatour.ts` | **2587** |
| `lib/register-from-llm-modetour.ts` | **2378** |
| `lib/register-from-llm-verygoodtour.ts` | **2553** |
| `lib/register-from-llm-ybtour.ts` | **2311** |

### 2.2 공통 패턴

- **엔트리 시그니처 통일:** `export async function parseForRegisterLlm{Supplier}(rawText, originSource = '직접입력', options?: RegisterLlmParseOptionsCommon): Promise<RegisterParsed>`  
  - 공급사마다 타입은 `register-llm-schema-{supplier}`로 **별도 파일**이지만, 옵션/반환 개념은 동형.
- **필수 전제:** `options.presetDetailBody` 없으면 **즉시 throw** — `register-parse-{supplier}` 및 전용 API만 사용하라는 메시지로 통일.
- **Gemini 클라이언트:** `getGenAI()`, `getGenerativeModel({ model: getModelName() })`, `geminiTimeoutOpts` 동일 계열.
- **토큰·붙여넣기 상한:** `REGISTER_FULL_MAX_OUTPUT_TOKENS`(환경변수 동일 로직), `REGISTER_PASTE_MAX_CHARS = 32000`, `MAX_SHOPPING_STOPS = 15`, `REGISTER_BRAND` 상수만 공급사 문자열 변경.
- **스케줄 1차 추출:** `register-schedule-extract-common`의 `inferExpectedScheduleDayCountFromPaste`, `mergeScheduleWithFirstPassPreferExtractRows`, `runScheduleExtractLlm` 등 동일 import 묶음.
- **프롬프트 SSOT:** `bongtour-tone-manner-llm-ssot`의 `BONGTOUR_TONE_MANNER_LLM_BLOCK`, `LLM_JSON_OUTPUT_DISCIPLINE_BLOCK`, `REGISTER_PREVIEW_MINIMAL_TONE_BLOCK`, `REGISTER_PROMPT_SCHEDULE_FIELDS_SUPPLIER_ONLY_BLOCK` 등 **동일 블록 재사용**(하나투어는 역할 소개 문구에 **전용 컴팩트 블록** 추가).
- **JSON 파싱:** `parseLlmJsonObject` (`llm-json-extract`).
- **섹션 단위 Gemini repair:** `decideSectionRepairPolicy` → `runDetailSectionGeminiRepair` 루프 — **호텔/항공/옵션/쇼핑**에 대해 `pastedBlocks`가 있으면 repair 스킵하는 조건까지 **거의 동일한 복붙 구조**.
- **후처리 공통 축:** `flight-leg-heuristics`, `mergeInfantPriceIntoProductPriceTable`, `extractProductPriceTableByLabels` / `mergeProductPriceTableWithLabelExtract`, `extractMinimumDepartureMeta` / `buildDepartureStatusDisplay`, `must-know-web-supplement`, `register-destination-coherence`, `gemini-repair-chain`, `buildOptionalToursStructuredForRegisterJson`, `shoppingStructuredRowToPersistStop` 등.

### 2.3 공급사별 차이점

| 영역 | 차이 |
|------|------|
| **스키마/타입** | `RegisterParsed`, `RegisterGeminiLlmJson`, `RegisterLlmParseError` 등이 `register-llm-schema-{supplier}`로 **파일 분리** — 필드·감사 구조가 완전 동일하지 않음. |
| **구조화 신호** | `structured-tour-signals-{supplier}`, `register-llm-blocks-{supplier}`, `optional-tour-row-gate-{supplier}`, `review-policy-{supplier}`, `day-hotel-plans-{supplier}`, `price-promotion-{supplier}` 등 **접미사 모듈 스왑**. |
| **하나투어 전용** | `REGISTER_LLM_ROLE_DATA_AUDITOR_HANATOUR_COMPACT_INTRO`, 쇼핑 방문 횟수(`register-hanatour-shopping`), `detail-body-parser-hanatour` 연계, 일정 폴리시(`parse-and-register-hanatour-schedule` 등) — **파이프라인이 가장 무겁고 분기 많음**. |
| **참좋은(verygood)** | 붙여넣기 클립/정규화(`verygoodtour-schedule-recovery-clip`, `verygoodtour-paste-normalize-for-register-verygoodtour`), 일정 블록 병합·폴리시·트레이스(`verygoodtour-schedule-*`), `registerScheduleToDayInputs`, `extractVerygoodGuideFeeLinesFromPriceBlob`, `buildVerygoodDepartureArrivalDisplayRawFromFlight` 등 **별도 서브파이프라인**. |
| **모두/노랑** | `buildRegisterSignalsHaystack` 유사 주석·역할(옵션/쇼핑 별도 블록 합성) — 구현 유사도 높음. |
| **노랑풍선** | `extractYbtourVerbatimListingTitle` 등 **기본 메타 추출** 전용 모듈. |
| **감사/소스 메타** | verygood 파일 내 `source: 'register-from-llm-verygoodtour'` 같은 **추적 문자열**이 파일별로 상이할 수 있음. |

### 2.4 공통 유틸 추출 제안

| 후보 함수/모듈 | 책임 |
|----------------|------|
| `runRegisterDetailSectionRepairs(detailBody, model, options)` | `presetDetailBody` 이후 공통 repair 루프 + `repairLog` 갱신 + `pastedBlocks` 스킵 규칙 |
| `resolveRegisterFullMaxOutputTokens()` | `REGISTER_FULL_MAX_OUTPUT_TOKENS` 단일화 |
| `assertPresetDetailBody(options, supplierLabel)` | throw 메시지 패턴 통일 |
| `buildRegisterPastePlaceholder()` | `EMPTY_PASTE_PLACEHOLDER` 동일 문자열 중복 제거 |
| **제네릭/팩토리는 비권장 영역** | `RegisterParsed`가 스키마 파일마다 다르면 TypeScript 제네릭으로 묶기 어렵고, **런타임 동작 차이**가 큼 → “절차 공통화” 수준에서 멈추는 것이 안전 |

### 2.5 위험 요소

- **미묘한 공급사별 로직:** 동일해 보이는 repair 루프라도 **이후 `detailBody` 가공·스케줄 병합**이 파일 하단에서 갈림 — 공통화 시 **한 공급사만 다른 순서**로 바뀌어도 등록 결과가 달라짐.
- **테스트:** 순수 함수 단위는 일부 추출 가능하나, **Gemini 호출·웹 보강**이 섞여 **완전 자동 회귀 테스트 비용**이 큼. 최소한 **골든 JSON 스냅샷**(비LLM 단계) + 통합 테스트 소수 권장.
- **현재 사용 경로(건드리면 위험):** 각 파일은 **`lib/register-parse-{supplier}.ts`에서만 직접 import**되는 형태로 보이며, 이는 곧 **관리자/여행 등록 API 파이프라인의 심장부**. 특히 `presetDetailBody` 가드, `RegisterLlmParseError` throw 지점, 가격·일정 병합 순서는 **프로덕션 데이터 무결성**과 직결.

---

## 3. 작업 순서 추천

### 3.1 Phase 1 (안전, 즉시 가능)

- **`page.tsx`:** 타입·모듈 레벨 파서(`parseStructuredSignalsView` 등)를 **동작 변경 없이** 별도 `lib/` 파일로 이동 + import만 교체.  
- **`register-from-llm-*`:** `REGISTER_FULL_MAX_OUTPUT_TOKENS`, placeholder 문자열, `assertPresetDetailBody` 수준의 **완전 동일 코드**만 공통 모듈로 추출.

### 3.2 Phase 2 (검토 필요)

- **관리자 페이지:** 훅 분리(`useAdminProduct`, `useScheduleEditor` 등) + 섹션 컴포넌트화; **Context**로 `product`/`setProduct` 전달 설계 검토.  
- **LLM 파서:** `runRegisterDetailSectionRepairs` 추출 시 **4파일 diff를 한 커밋으로** 맞추고, 공급사별 `onTiming`·metrics만 옵션으로 유지.

### 3.3 Phase 3 (리스크 있음)

- **스키마 통합 시도**(`register-llm-schema-*` 단일화) — 타입 파급이 전역.  
- **관리자 페이지** 전면 컴포넌트 트리 재구성 + 인라인 `fetch` 전역 유틸화 — 회귀 범위 최대.  
- **LLM 파서** “한 파일 추상 팩토리”화 — 공급사별 예외가 계속 누수하면 오히려 가독성·디버깅 악화.

---

*본 문서는 코드 변경 없이 분석 목적으로만 작성됨.*
