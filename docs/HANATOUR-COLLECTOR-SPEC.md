# 하나투어 수집기 스펙·구현 보고

**정책:** E2E 스크립트의 `*DEV*` 분리(`calendar_e2e_scraper_hanatourDEV` 등)는 **하나투어에만** 적용한다. 다른 공급사는 실전 원본 디렉터리만 유지하고 동일한 DEV 복제본을 추가하지 않는다.

## 1. 수정/추가한 파일 목록

- `prisma/schema.prisma` — `Product` 확장 필드, `ProductDeparture` 확장 필드, `HanatourMonthlyBenefit` 모델
- `lib/hanatour-types.ts` — 쇼핑/선택관광/월혜택 구조 타입
- `lib/hanatour-normalize.ts` — 제목 정규화, 항공사 추출, 매칭 키, 상태 라벨 JSON 파싱·파생 boolean
- `lib/hanatour-monthly-benefit.ts` — `upsertHanatourMonthlyBenefit`
- `lib/hanatour-departures.ts` — Python CLI 연동·`DepartureInput` 매핑
- `lib/upsert-product-departures.ts` — `DepartureInput`·upsert 확장
- `lib/admin-departure-rescrape.ts` — 하나투어 전용 어댑터 우선 시도 후 기존 `calendar_price_scraper` 폴백
- `scripts/calendar_e2e_scraper_hanatour/` — 달력·출발 모달 E2E
- `docs/HANATOUR-COLLECTOR-SPEC.md` — 본 문서

(DB는 `prisma db push`로 로컬 동기화됨; 마이그레이션 파일은 별도 생성하지 않음.)

## 2. Product 저장필드 적용 요약

상품 코어만: `rawTitle`, `normalizedBaseTitle`, `supplierProductCode`, `productType`, `summary`, `benefitSummary`, `airline`(기존), `duration`(기존), `tripNights`, `tripDays`, 쇼핑(`shoppingVisitCountTotal`, 통지 원문 3종, `shoppingShopOptions` JSON 문자열), 선택관광(`hasOptionalTours`, `optionalTourSummaryRaw`, `optionalToursStructured` JSON 문자열), 카드 혜택 요약·월 연결(`cardBenefitSummaryShort`, `benefitMonthRef`, `hasMonthlyCardBenefit`), 라벨·요약(`themeLabelsRaw`, `promotionLabelsRaw`, `insuranceSummaryRaw`, `hotelSummaryRaw`, `foodSummaryRaw`, `reservationNoticeRaw`), 가이드(`guideTypeRaw`, `tourLeaderTypeRaw`), `detailStatusLabelsRaw`, `meetingInfoRaw`(기존), 포함/불포함(기존 `includedText`/`excludedText`/`criticalExclusions`), `rawMeta` JSON 문자열.

출발일별 가격·좌석·상태·항공편은 **Product에 넣지 않음**.

## 3. ProductDeparture 저장필드 적용 요약

`departureDate`, 가격(`adultPrice`, `childBedPrice`, `childNoBedPrice`, `infantPrice`), `localPriceText`, `statusRaw`, `seatsStatusRaw`, `statusLabelsRaw`(JSON 배열 문자열), `minPax`, `reservationCount`, `seatCount`, 항공·미팅(기존 carrier/flight/airport/datetime + `meetingDateRaw` 등), `fuelSurchargeIncluded`, `taxIncluded`, 파생 확정 플래그 5종, `supplierDepartureCodeCandidate`, `matchingTraceRaw`, 레거시 `isConfirmed`/`isBookable`.

## 4. ItineraryDay 저장필드 적용 요약

기존 스키마(`day`, `dateText`, `city`, `summaryTextRaw`, `poiNamesRaw`, `meals`, `accommodation`, `transport`, `rawBlock`, `notes`) 유지. 일정은 **일정 탭/원문 블록**에서만 채움; Python `itinerary.py`가 조립 후 Prisma 적재 경로와 연결하면 됨.

## 5. HanatourMonthlyBenefit 저장 구조 요약

`supplierKey`, `benefitMonth`(YYYY-MM), `sourceUrl`, `isActive`, `cardInstallmentBenefits`·`hanaExtraCards`·`rawMeta`(JSON 문자열), `commonNoticesRaw`, `benefitSummaryRaw`, `fetchedAt`. 동일 월은 upsert, 상품별 전문 중복 저장 금지.

## 6. 제목 정규화 규칙 요약

`normalizeHanatourBaseTitle`: 선행 `[...]` 제거 → 첫 `#` 이전만 사용 → 공백 정규화 → `도시(/도시)* 숫자 일` 패턴 우선, 실패 시 `#` 이전 전체.

## 7. 동일상품 판정 규칙 요약

**SSOT 모듈:** `scripts/calendar_e2e_scraper_hanatour/utils.py` 내 동일상품 키·필터 (하나투어 전용, 타 공급사와 미공유).

- 키: `hanatour_raw_title_exact_match_key` (NBSP→공백·trim만; `#`·띄어쓰기·해시태그 원문 유지)
- 일치: `hanatour_same_product_raw_exact`, `hanatour_same_product_modal_row_vs_baseline` (`hanatour_modal_row_matches_identity_bundle`는 별칭)
- 리스트 필터: `filter_hanatour_same_product_rows`
- 월별 시간 패턴 버킷: `hanatour_monthly_pattern_storage_key`

`departure_modal.py`는 DOM 수집·호출 순서·rawTitle 있을 때 anchor 폴백 금지 등 오케스트레이션만 담당.

진단 로그에 `payload_role` / `same_product_sso_key_fn` / `diagnostic_meta_note` 등이 붙으면, 그 블록은 **텔레메트리·메타**이며 동일상품 판정 SSOT가 아니다. SSOT 문자열은 `identifiers.HANATOUR_SAME_PRODUCT_SSO_KEY_FN`과 동일하게 잡는다.

`baseline.rawTitle`이 비었을 때만 **identity bundle**(normalizedBaseTitle·variant·항공) + anchor/pkg 완화를 최하위 폴백으로 사용.

표시·로그용 정규화는 §6·`build_hanatour_match_key` 등과 혼동하지 말 것.

## 8. 출발일 모달 수집 방식 요약

Node가 `python -m scripts.calendar_e2e_scraper_hanatour.main <url> <max_months>` 호출 → JSON `departures`를 `DepartureInput`으로 매핑. `collectHanatourDepartureInputs`는 위 모듈을 사용한다. 모달·달력·row 파싱은 `scripts/calendar_e2e_scraper_hanatour/scraper.py` 정본.

## 9. 쇼핑정보 파싱 방식 요약

총 방문 횟수(`shoppingVisitCountTotal`)와 표 행 수를 분리; `shopping.py`에서 표·블록 파싱, 실패 시 원문 블록 보존. Product에 `shoppingShopOptions` JSON 문자열로 저장.

## 10. 선택관광 파싱 방식 요약

`hasOptionalTours` + `optionalTourSummaryRaw` + 구조화 배열(`optionalToursStructured`). 공급사 기본값 금지; `optional_tours.py`.

## 11. 일정 수집 방식 요약

일정 탭 또는 일정 원문만 정본; 분해 실패 시 빈 배열 유지(승인 게이트에서 차단 정상).

## 12. 월별 혜택 수집 방식 요약

HTML 수집(`monthly_benefit.py`) → 레코드 조립 → Node `upsertHanatourMonthlyBenefit`로 월 단위 SSOT. Product에는 `benefitMonthRef`/`hasMonthlyCardBenefit`만.

## 13. 기존 공급사에도 적용되어야 할 공통 원칙

쇼핑·선택관광·상태라벨·미팅·포함/불포함은 **상품 또는 출발일 단위**로만 해석; 공급사 단위 하드코딩 금지.

## 14. 테스트한 대표 케이스

- `python -m scripts.calendar_e2e_scraper_hanatour.main <url> 3` — JSON 출력 확인
- `npx prisma db push` — 스키마·클라이언트 생성 성공

## 15. 남은 리스크 1~7

1. Python 출발 모달·Playwright 미구현 → 현재 빈 배열 후 캘린더 스크래퍼 폴백에 의존.
2. 상세 HTML 파싱·상품 upsert API와 Product 확장 필드 연결 미완.
3. ItineraryDay 적재 파이프라인(관리 동기화·에이전트)과 `itinerary.py` 미연결.
4. 월별 혜택 URL·크론·관리 UI 미연결.
5. `deriveHanatourConfirmationFlags` 휴리스틱이 false를 거의 내지 않음(원문 `statusLabelsRaw`가 SSOT).
6. 제목 정규식 edge case(특수 목적지 표기)에서 `normalizedBaseTitle` 품질 변동.
7. `tsc` 전체는 기존 `lib/pexels-keyword.ts` 정규식 플래그 이슈로 실패할 수 있음(본 작업과 무관).
