# 모두투어(modetour) 본문 섹션 분리·추출 SSOT

## 목적

관리자 등록 시 **붙여넣기 본문**을 결정적으로 나누어 `DetailBodyParseSnapshot`을 만든다.  
이 문서는 **모두투어 전용** 앵커·정규화·슬라이스·호텔 전처리·하위 파서 책임의 **1급 유지보수 기준**이다.

**우선순위:** 본 문서 > 공통 등록 정책의 서술. 상위 입력·정형칸 우선순위 → `docs/admin-register-supplier-precise-spec.md` §1, `docs/register-supplier-extraction-spec.md`.

**일정 표현 SSOT는 본 문서 범위 밖:** `docs/register_schedule_expression_ssot.md`. 본 문서는 본문 **섹션 자르기**만 규정한다.

**항공·가격·공개 leg 병합(브랜드 게이트):** `docs/ops/modetour-parse-contract.md` — 본 문서 = 섹션 분리·스냅샷, 계약 문서 = 항공/가격 해석·공개 분기.

### HTTP supplier 키 vs 붙여넣기 본문

canonical 키와 붙여넣기 원문 구분: [register-supplier-extraction-spec.md](./register-supplier-extraction-spec.md) 「표기·키 SSOT (요약)」. 이 문서·픽스처의 한글·원문은 **모두투어 본문 파서 입력**만 규정한다.

### 본문 파서 비책임 축 (입력 파서 SSOT)

- **항공·선택관광·쇼핑** 구조화는 **`register-input-parse-modetour`** + 정형 입력란(`register-parse-modetour`)만. `detail-body-parser-modetour`는 해당 필드를 채우지 않는다.
- 본문 동일 문구로 입력축을 대신 구조화하지 않는다.

---

## 이 문서를 따르는 코드 파일

| 파일 | 역할 |
|------|------|
| `lib/detail-body-parser-modetour.ts` | 스냅샷 조립(항공/옵션/쇼핑 필드 빈 껍데기)·호텔 전처리·포함불포함 |
| `lib/detail-body-parser-utils-modetour.ts` | 정규화·앵커·섹션 분리·슬라이스 |
| `lib/register-parse-modetour.ts` | 본문 파서 호출·**입력란 기준** 항공/옵션/쇼핑 구조화·항공 확장·`supplementModetourScheduleFromPastedBody` 등 |
| `lib/register-input-parse-modetour.ts` | 항공·옵션·쇼핑 **입력 해석 SSOT** |
| `lib/register-input-unstructured-body-modetour.ts` | 비정형 옵션·쇼핑 |
| `lib/hotel-table-parser-generic.ts` | 표 기반 호텔 행 복원 **공용** 구현. `lib/hotel-parser-hanatour.ts`, `lib/hotel-parser-verygoodtour.ts`, `lib/hotel-parser-ybtour.ts`에서 직접 호출하고, 모두투어는 `preprocessModetourHotelSection` 후 `parseHotelSectionModetour` → 내부에서 호출 |
| `lib/modetour-basic-info-must-know-extract.ts` | 포함/불포함 + mustKnow 계열(스냅샷 이후 파이프와 연계) |
| `lib/review-policy-modetour.ts` | 검수 |

회귀: `scripts/verify-detail-body-parser-regression.ts` 샘플 `M1`–`M3`. 픽스처 스크립트 `scripts/verify-detail-parser-fixtures.ts`는 모두투어 utils `splitDetailSections`로 섹션 분리 검증.

---

## 입력 SSOT vs 본문 SSOT 경계

- 정형칸 비어 있지 않으면 해당 섹션은 **붙여넣기 텍스트가 SSOT 후보**(구현: `sliceDetailBodySections`).
- `schedule` 일차 배열·브리프 문구는 **비책임**; `register-modetour-pasted-schedule` 등 후속.

---

## 섹션 앵커 규칙

- **`MODETOUR_SECTION_ANCHOR_ALIASES`** (`detail-body-parser-utils-modetour.ts`)가 SSOT.
- 모두투어 특화: `DAY1`/`DAY2`, `모두투어`, `교통편`, `모두투어 옵션` 등(코드 상수와 동기).
- **포함/불포함 헤더 공백:** `포함 사항`, `불포함 사항`, `포함/불포함 사항` 별칭을 `included_excluded_section`에 둔다.
- **하단 네비·미팅:** `여행 상세 정보`, `미팅정보`를 `notice_section`에 두어 일정 본문과 뒤따르는 안내를 분리할 수 있게 한다(줄 어디에든 별칭 문자열이 나타나면 해당 타입으로 분기 — 과분기 주의는 회귀 샘플로 관리).

---

## False positive 방지

- 쇼핑·호텔: 전용 `isFalseShoppingAnchorLineModetour` / `isFalseHotelAnchorLineModetour`.
- 표 안 짧은 `호텔명` 헤더 줄은 호텔 앵커로 오인 방지(코드 주석과 동일).

---

## 항공 시드 슬라이스

- `flight` + `schedule` + `summary` 시드 길이 **`MODETOUR_FLIGHT_SEED_MIN_LEN` (96)** 미만이면 전체 본문을 항공 입력으로 넘김.

---

## 호텔 섹션 (모두투어 전용)

- `preprocessModetourHotelSection`: 일차·날짜·도시·호텔명이 줄바꿈으로 쪼개진 표를 한 행으로 이음.
- `enrichModetourHotelStructured`: 도시·날짜·예약상태 보강 휴리스틱.
- `parseHotelSectionGeneric`(`hotel-table-parser-generic.ts`)은 위 전처리·보강과 별도로, **타 공급사 호텔 파서도 동일 함수를 사용**한다(모두투어 독점 호출이 아님).

---

## 포함/불포함 보강

- `detail-body-parser-modetour.ts`: `incExc` 슬라이스만으로 `parseModetourIncludedExcludedSection` 결과의 included·excluded가 **모두 비었을 때**, 정규화 본문에 `포함\s*사항`과 `불포함\s*사항`이 **둘 다** 나타나면 **전체 본문**을 한 번 더 넘겨 재파싱한다(둘 다 `clipModetourIncExcInputForParse` 적용 후 파싱).
- **`clipModetourIncExcInputForParse`:** `[…무비자…]`로 시작하는 줄, `예약 시 유의 사항`, `여행 시 유의 사항`, `미팅정보`, `여행 상세 정보`, `# 선택옵션`으로 시작하는 줄, `선택관광명`으로 시작하는 줄(표 머리 깨짐) **이전**까지만 포함/불포함 파서에 넘긴다(불포함 목록 뒤 **무비자·입국 장문**이 붙는 샘플 대응).

---

## 일정·선택관광·쇼핑 표 공존

- 한 붙여넣기에 **일정 서술**과 **선택관광 표**·**쇼핑 표**가 이어질 때: `일정표`/`상세일정`/`1일차` 등은 **`schedule_section`**으로, `선택관광`/`쇼핑정보` 등은 각 **`optional_tour_section`** / **`shopping_section`**으로 분기한다. 표 안 `쇼핑품목` 줄은 `isFalseShoppingAnchorLineModetour`로 **쇼핑 앵커 오인 방지**.
- **정형칸**(`hotelRaw`/`optionalRaw`/`shoppingRaw`)이 비어 있지 않으면 해당 섹션 텍스트는 **슬라이스보다 붙여넣기가 우선**(`sliceDetailBodySections`).
- **일차 배열·일정 문장 요약**은 본 문서 비책임; `register-modetour-pasted-schedule` 등이 별도 SSOT.

---

## 책임 범위

| 축 | 책임 |
|----|------|
| 본문 정규화 | `normalizeDetailRawText` (모두투어 예약·상담 노이즈 패턴) |
| 앵커·분리·슬라이스 | utils 모듈(항공/옵션/쇼핑은 **경계만**) |
| 항공·옵션·쇼핑 **구조화** | **`register-input-parse-modetour`** + 정형 입력란(본문 파서 비책임) |
| 호텔 | 전처리 + `parseHotelSectionGeneric` + enrich |
| 포함/불포함 | `parseModetourIncludedExcludedSection` |
| 일정 배열·표현 | **비책임** |
| mustKnow | **비책임**(`parseDetailBodyStructured*` 밖). `applyModetourBasicInfoMustKnowExtract`(`register-parse-modetour`) |

---

## 관련 문서

- `docs/ops/modetour-parse-contract.md` — 항공 directed·가격·공개 병합(섹션 분리와 별층).
