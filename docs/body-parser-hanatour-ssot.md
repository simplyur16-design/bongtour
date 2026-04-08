# 하나투어(hanatour) 본문 섹션 분리·추출 SSOT

## 목적

관리자 등록 시 **붙여넣기 본문**을 결정적으로 나누어 `DetailBodyParseSnapshot`을 만든다.  
이 문서는 **하나투어 전용** 앵커·정규화·슬라이스·하위 파서 책임의 **1급 유지보수 기준**이다.

**우선순위:** 본 문서 > 공통 등록 정책 문서의 “섹션 이름” 수준 서술.  
공통 문서는 상위 입력 SSOT·정형칸 우선순위를 고정한다 → `docs/admin-register-supplier-precise-spec.md` §3, `docs/register-supplier-extraction-spec.md`.

**일정 표현 SSOT는 본 문서 범위 밖:** `parsed.schedule` 브리프·저장 매핑은 `docs/register_schedule_expression_ssot.md` (표현층).

### 본문 파서 비책임 축 (입력 파서 SSOT)

- **항공·선택관광/옵션·쇼핑** 구조화는 **`register-input-parse-hanatour`** + 정형 입력란(`register-parse-hanatour`) SSOT. `detail-body-parser-hanatour`는 채우지 않는다.
- 본문에 동일 문구가 있어도 본문 파서가 입력축을 대신 구조화하지 않는다.

---

## 이 문서를 따르는 코드 파일

| 파일 | 역할 |
|------|------|
| `lib/detail-body-parser-hanatour.ts` | 스냅샷 조립(항공/옵션/쇼핑 구조화 제외)·호텔·포함불포함 |
| `lib/detail-body-parser-utils-hanatour.ts` | 정규화·앵커·섹션 분리·슬라이스 |
| `lib/register-parse-hanatour.ts` | 본문 파서 호출·**입력란 기준** 항공/옵션/쇼핑 구조화·LLM `presetDetailBody` |
| `lib/register-input-parse-hanatour.ts` | 항공·옵션·쇼핑 **입력 해석 SSOT** |
| `lib/register-input-unstructured-body-hanatour.ts` | 비정형 옵션·쇼핑 휴리스틱(표 실패 시) |
| `lib/hotel-parser-hanatour.ts` | 호텔 섹션 표/행 구조화 |
| `lib/hanatour-basic-info-body-extract.ts` | 포함/불포함 구조화 + 등록 후보 보강(본문 파서 밖 후속 단계와 연계) |
| `lib/review-policy-hanatour.ts` | 검수 정책 |

회귀: `scripts/verify-detail-body-parser-regression.ts` 샘플 `H1`–`H3`.

---

## 입력 SSOT vs 본문 SSOT 경계

- **정형칸**(항공·호텔·옵션·쇼핑)에 값이 있으면 `sliceDetailBodySections`가 해당 섹션 텍스트를 **붙여넣기로 덮어쓴다**(공통 정책과 동일 구현).
- **항공·옵션·쇼핑:** `register-parse-hanatour`가 `register-input-parse-hanatour`로만 구조화. 본문 파서는 `raw.flightRaw` 등 슬라이스만 제공.
- **일차 배열 `schedule`:** `parseDetailBodyStructuredHanatour`는 생성하지 않는다. LLM·`parse-and-register-hanatour-schedule` 등 후속 축.

---

## 섹션 앵커 규칙

- 앵커 사전·줄 매칭은 **`lib/detail-body-parser-utils-hanatour.ts`의 `HANATOUR_SECTION_ANCHOR_ALIASES`** 가 SSOT(코드에 상수로 존재).
- 요약·항공·일정·호텔·옵션·쇼핑·포함불포함·유의 등 타입은 `DetailSectionType`(`lib/detail-body-parser-types.ts`)과 동일 이름.
- **`포함/불포함/선택경비 정보`** 트리플 대제목 줄을 `included_excluded_section` 앵커에 포함한다(붙여넣기 샘플 기준).

---

## 예약현황 복합 한 줄

- `예약 : N명 좌석 : M석 (최소출발 : …)` 는 utils에서 `raw.hanatourReservationStatus`로 **경량 파싱**할 수 있다(가격/좌석 필드화 SSOT는 등록 파이프). 항공 구조화와 무관하다.

---

## 일정 본문·UI 잔재(정규화)

- `normalizeDetailRawText`는 **단독 줄** `상세보기`, `내용보기`, `지도보기`, `일정 전체펼침`/`일정 전체닫힘`, `이전다음`, `N / M`(페이지 네비 한 줄) 등 **일정 탭 UI**를 제거한다(`isHanatourScheduleUiNoiseLine`).
- **관광지 개요·입국 안내·호텔 후보 장문**은 본 단계에서 문장 단위로 판별하지 않는다. **일차 배열 `schedule` 구조화** 시 장문을 버릴지는 `docs/register_schedule_expression_ssot.md` 및 `parse-and-register-hanatour-schedule` 등 **표현·일정 파이프**에서 다룬다(본 문서는 섹션 슬라이스·노이즈 줄만).

---

## False positive 방지

- 쇼핑: 표 헤더형 줄(`쇼핑항목` 등)이 본문 `쇼핑정보` 앵커와 충돌하지 않게 `isFalseShoppingAnchorLineHanatour`.
- 호텔: `예정호텔은…`, `일급 호텔` 등 본문 서술이 앵커로 오인되지 않게 `isFalseHotelAnchorLineHanatour`.
- 단독 줄 `호텔`은 호텔 섹션 앵커로 허용.

---

## 항공 시드 슬라이스

- `flight_section` + `schedule_section` + `summary_section`을 이어 붙인 문자열 길이가 **`HANATOUR_FLIGHT_SEED_MIN_LEN` (80)** 미만이면 **전체 정규화 본문**을 항공 입력으로 넘긴다.

---

## 책임 범위 (본 파이프라인)

| 축 | 본 문서/해당 코드 책임 |
|----|-------------------------|
| 본문 정규화 | `normalizeDetailRawText` (하나투어 UI·푸터 노이즈 줄 제거 패턴) |
| 앵커·섹션 분리 | `splitHanatourSectionsByAnchors` |
| 섹션 슬라이스 | `sliceDetailBodySections` |
| 항공·옵션·쇼핑 **구조화** | **`register-input-parse-hanatour`** + 정형 입력란(본문 파서 비책임) |
| 호텔 구조화 | `parseHotelSectionHanatour` |
| 포함/불포함 | `parseHanatourIncludedExcludedStructured` |
| 일정 브리프 배열 | **비책임** (표현·LLM·스케줄 모듈) |
| mustKnow 후보 | **비책임**(`parseDetailBodyStructured*` 밖). 등록 단계: `applyHanatourBasicInfoBodyExtract`(`register-parse-hanatour`) |

---

## 포함/불포함 세부 (트리플 블록·폴백)

구현·줄 단위 규칙의 **1급 서술**은 `lib/hanatour-basic-info-body-extract.ts`(및 해당 JSDoc)에 있다. 본 문서는 detail-body와의 경계만 고정한다.

- `detail-body-parser-hanatour.ts`는 `parseHanatourIncludedExcludedStructured(incExcSection, normalizedRaw)`로 호출한다. 두 번째 인자 `fullBodyFallback`에 `normalizedRaw`를 넘기면, **슬라이스된 섹션만으로 트리플 블록을 못 찾았을 때** 동일 파서가 **전체 정규화 본문**에서 `tryBlob`으로 한 번 더 시도한다(섹션 문자열과 전체 본문이 다를 때만).
- 트리플 헤더 `포함 / 불포함 / 선택경비 정보`와 `포함내역`·`불포함내역`·`선택경비` 서브헤더로 블록을 자르고, 끝 경계는 해당 파일의 `TRIPLE_BLOCK_END_LINE_RES` 등으로 잘라 낸다.
- 블록을 찾지 못하면 빈 구조 + (본문이 길면) 검수 플래그 등 — 자세한 것은 위 모듈 코드.

---

## 관련 문서 (참고, 1급 SSOT 아님)

- `docs/detail-body-review-policy.md`, `docs/detail-body-input-priority.md` — 검수·입력 우선순위(공급사 공통 타입 축).
- `docs/register_schedule_expression_ssot.md` — 일정 표현층만.
