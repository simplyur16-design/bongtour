# 모두투어 전용 플래그·분기 목록 (P1 잔여)

**규칙:** 아래 항목은 **modetour 확정 경로에서만** 켜거나 해석한다. 타 공급사·공통 레이어로 승격·통합하지 않는다.  
**계약:** `docs/ops/modetour-parse-contract.md`

---

## A. 공개 상세 런타임 (`product-detail-view.tsx`)

| 플래그/변수 | 타입 | 설정 조건 | 효과 | 금지 |
|-------------|------|-----------|------|------|
| `useModetourDirectedParse` | `boolean` | `brand.brandKey === 'modetour'` **또는** `flightStructured.debug.supplierBrandKey === 'modetour'` | directed 표시·가격·leg 경로 진입 | 본문만 보고 true |
| `useModetourPriceMergeContext` | `boolean` | `useModetourDirectedParse`와 동일 | 본문 가격표 → 달력 행 병합 | hanatour/ybtour에 동일 옵션 전달 |
| `modetourDirectedDisplay` | object \| null | 위 조건 | `buildModetourDirectedDisplayFromStructuredBody` 등 | — |
| `modetourPersistedFlightStructured` | `FlightStructured` | rawMeta 저장본 | leg 폴백 스냅샷 | 공개 DTO에 debug 전체 노출 |
| `modetourStickyLocalPayLine` | `string \| null` | modetour 가격 병합 컨텍스트 + 현지 경비 문구 | 히어로·견적 카드 1인당 현지비 | 다른 공급사 prop 이름 재사용만 UI 수준은 허용 |

### `FlightStructuredBody` (공개 props)

| 필드 | 설정 | 소비 |
|------|------|------|
| `useModetourStructuredFlightLegs` | `useModetourDirectedParse`일 때만 `true` | `departure-key-facts` → `tryModetourDepartureLegCards*` |
| `modetourPersistedFlightStructured` | modetour일 때 persisted leg | 일정 하단 항공 폴백·leg enrich |
| `detailBodyNormalizedRaw` | 등록 시 저장 | structuredBody 재파싱 보조 |

### 가격 merge 옵션

| 옵션 | 전달 위치 | 의미 |
|------|-----------|------|
| `modetourVaryingAdultChildLinkage: true` | `mergeProductPriceRowsWithBodyPriceTable(..., opts)` | 성인가가 출발일마다 다를 때 아동·유아를 본문 표와 연동 |

정의: `lib/product-departure-to-price-rows-modetour.ts` · 호출: `app/products/[idOrSlug]/product-detail-view.tsx` (modetour 분기만).

---

## B. 등록·파싱 파이프라인

| 플래그/정책 | 위치 | 설명 |
|-------------|------|------|
| `resolveDirectedFlightLines` **필수** | `parseForRegisterLlmModetour` | null 폴백 제거 — `register-parse-modetour`가 `resolveModetourDirectedDepartureReturnLines` 주입 |
| `presetDetailBody` **필수** | 동일 | handler 외 직접 호출 금지 |
| LLM 항공·옵션·쇼핑·`prices[]` | `register-from-llm-modetour` 프롬프트 | **추출 금지** — pastedBlocks / E2E SSOT |
| `modetourClearLlmWhenDedicatedPasteEmpty` | 등록 후처리 | 전용 칸 비었으면 LLM 해당 축 제거 |
| `deterministicParserSucceeded` | `flightStructured.debug.modetourParseTrace` | 결정적 파서 성공 여부 — directed-only 경로 |
| `supplierBrandKey: 'modetour'` | `FlightStructured.debug` | 파서가 남기는 브랜드 힌트 (brand 행 비어 있어도 공개 분기) |
| `fourSlot` 검증 | `admin-register-verification-meta-modetour` | modetour 4칸 paste 검증 슬롯 |
| `publicConsumptionModuleKey === 'modetour'` | `product-detail-view` | 쇼핑·옵션·호텔 `public-consumption-modetour` |

---

## C. 출발일별 항공·달력 정렬

| 항목 | 모듈 | modetour 전용 여부 |
|------|------|-------------------|
| `calendarAlignedDepartureFacts` | `alignDepartureKeyFactsToSelectedCalendarDate` | 공용 함수, modetour leg 데이터에 적용 |
| 히어로 `formatFlightLegTwoLines` | `TravelProductDetail` | 공용 포맷, facts는 modetour leg |
| 일정 하단 `departureKeyFactsToHeroSsotItineraryFlightDisplay` | `ItineraryViewPackageMain` | 히어로와 동일 SSOT |
| `applyFlightManualCorrectionToDepartureKeyFacts` (modetour) | `flight-manual-correction-modetour` | origin modetour + overlay 플래그 시 |

---

## D. structuredSignals / rawMeta (저장 키)

| 키 | 용도 |
|----|------|
| `structuredSignals.flightStructured` | 등록 항공 스냅샷 |
| `structuredSignals.flightManualCorrection` | FMC outbound/inbound final·auto |
| `structuredSignals.productPriceTable` | 본문 연령별 단가 |
| `flightRaw` | directed·재파싱 원문 |

---

## E. 환경·토큰 (modetour 등록 LLM)

| 변수 | 기본 | 비고 |
|------|------|------|
| `GEMINI_REGISTER_FULL_MAX_OUTPUT_TOKENS` | 65536 (상한 clamp) | `register-from-llm-modetour` 풀 등록만 — 타 공급사 파일에 복사 금지 |

---

## F. UI·표시 전용 (modetour 분기)

| 항목 | 위치 |
|------|------|
| 옵션 표 제목 「현지옵션」 | `ItineraryExtraInfoBoxes`, `modetourPublicOptionalSummaryText` |
| `[선택관광]`·`#` 제거 | `lib/modetour-optional-tour-name.ts` |
| imageKeyword 허브·스팟 | `modetour-schedule-image-keyword.ts` (한글·라틴 routeText, 랜드마크 우선) + `register-schedule-image-keyword-ssot.ts` |
| `isModetourPlaceholderImageKeyword` | placeholder·공항 키워드 배제 |

---

## G. 의도적으로 공용인 것 (modetour 플래그 **아님**)

| 모듈 | 이유 |
|------|------|
| `flight-preferred-legs-kr-out-in.ts` | 출발/도착 한 줄 — ybtour 등 공유 |
| `alignDepartureKeyFactsToSelectedCalendarDate` | 달력 정렬 알고리즘 공용, modetour leg에만 적용 |
| `formatFlightLegTwoLines` | 표시 포맷 공용 |

---

## H. 변경 시 체크

1. 새 `useModetour*` / `modetour*` 분기 추가 시 **이 문서에 한 줄 추가**.
2. `product-detail-view` 외 경로에서 `useModetourStructuredFlightLegs` 설정 금지 여부 확인.
3. `npm run verify:modetour-avp603` + 공개 상세 회귀 URL (`modetour-regression-baseline.md`).
