# 참좋은여행(verygoodtour) 본문 섹션 분리·추출 SSOT

## 목적

관리자 등록 시 **붙여넣기 본문**을 결정적으로 나누어 `DetailBodyParseSnapshot`을 만든다.  
이 문서는 **참좋은여행 전용** 앵커·정규화·슬라이스·하위 파서 책임의 **1급 유지보수 기준**이다.

**우선순위:** 본 문서 > 공통 등록 정책. 상위 정책 → `docs/admin-register-supplier-precise-spec.md` §2, `docs/register-supplier-extraction-spec.md`.

**일정 표현 SSOT:** `docs/register_schedule_expression_ssot.md` — 본 문서는 **본문 섹션 분리**만 다룬다.

### 본문 파서 비책임 축 (입력 파서 SSOT)

- **항공·선택관광·쇼핑** 구조화는 **`register-input-parse-verygoodtour`** + 정형 입력란(`register-parse-verygoodtour`)만.
- 본문 파서는 동일 문자열이 있어도 입력축을 구조화하지 않는다.

---

## 이 문서를 따르는 코드 파일

| 파일 | 역할 |
|------|------|
| `lib/detail-body-parser-verygoodtour.ts` | 스냅샷 조립(항공/옵션/쇼핑 빈 껍데기)·포함 보강·호텔 |
| `lib/detail-body-parser-utils-verygoodtour.ts` | 정규화·앵커·분리·슬라이스 |
| `lib/register-parse-verygoodtour.ts` | 본문 파서 호출·**입력란 기준** 항공/옵션/쇼핑·항공 꾸밈·LLM `presetDetailBody` |
| `lib/register-input-parse-verygoodtour.ts` | 항공·옵션·쇼핑 **입력 해석 SSOT** |
| `lib/register-input-unstructured-body-verygoodtour.ts` | 비정형 옵션·쇼핑 |
| `lib/hotel-parser-verygoodtour.ts` | 호텔 섹션 |
| `lib/register-verygoodtour-basic.ts` | 포함/불포함(`parseVerygoodtourIncludedExcludedSection`) |
| `lib/review-policy-verygoodtour.ts` | 검수(옵션·쇼핑 공란 허용 tolerances 등) |

회귀: `scripts/verify-detail-body-parser-regression.ts` 샘플 `C1`–`C7`.

---

## 입력 SSOT vs 본문 SSOT 경계

- 정형칸 우선은 `sliceDetailBodySections`와 동일 패턴.
- **항공·옵션·쇼핑:** `register-parse-verygoodtour`가 `register-input-parse-verygoodtour`로만 구조화. 항공 데코 정규화도 등록 파이프 측.

---

## 섹션 앵커 규칙

- **`VERYGOOD_SECTION_ANCHOR_ALIASES`** (`detail-body-parser-utils-verygoodtour.ts`)가 SSOT.
- 참좋은 특화: `참좋은`, 사이트 브랜드 푸터 마커, **`요약설명`**(상단 요약 블록 헤더), `O포함사항` / `O 포함사항` / `O불포함` 계열, `현지 선택관광` 등 — 이 목록은 **줄이 해당 `DetailSectionType`으로 분기**할 때 쓰인다.
- **`O 포함/불포함` 블록 종료(다음 섹션으로의 경계):** 줄에 **`상품평점`** 또는 **`여행일정 변경에 관한 사전 동의`**(및 짧은 접두 동의 문구)가 앵커로 잡히면 `included_excluded_section`이 끝나고 `notice_section` 등으로 넘어간다(붙여넣기 샘플 기준).

---

## 정규화(노이즈 줄 제거)

- `normalizeDetailRawText`: 공통 UI 단어(더보기·참좋은 브랜드 푸터 등) 외에, **단독 줄** `바로가기`, `평점`, `여행후기`, `상세보기`/`지도보기`/`내용보기`, `연령대별 선호도`, `솔직한 여행이야기`, 순수 `NN%`, `20대`…`50대` 등 **리뷰·UI 잔재**를 제거한다(코드: `isVerygoodUiNoiseLine`).

---

## False positive 방지

- `isFalseShoppingAnchorLineVerygoodtour`, `isFalseHotelAnchorLineVerygoodtour` (utils).

---

## 항공 시드 슬라이스

- 시드 순서: **`flight_section` → `summary_section` → `schedule_section`** (상단 요약이 긴 붙여넣기 가정).
- 하한 **`VERYGOOD_FLIGHT_SEED_MIN_LEN` (88)** 미만이면 전체 본문을 항공 입력으로 넘김.

---

## 포함/불포함 보강

- `detail-body-parser-verygoodtour.ts`: included·excluded가 **모두 비었을 때만**, 정규화 본문이 정규식 **`/O\s*포함사항/i`** 에 매칭되면 `parseVerygoodtourIncludedExcludedSection(...)`로 **전체 정규화 본문**을 한 번 더 넘겨 재파싱한다(재시도 전에도 `clipVerygoodIncExcInputForParse` 적용).
- 앵커 별칭에 있는 `O불포함` 등은 **섹션 분리**용이며, 위 보강 트리거와 범위가 같지 않다(`O불포함`만 있고 `O…포함사항` 문구가 없으면 이 보강은 실행되지 않음).
- **`clipVerygoodIncExcInputForParse`:** 앵커 누락 시 슬라이스가 길어지면, `여행일정 변경에 관한 사전 동의`, 단독 `■ 항공`, `1일차`, 또는 `일정표`+`호텔|관광지|약관`이 섞인 탭형 한 줄 **이전**까지만 구조화 입력으로 넘긴다.

---

## 책임 범위

| 축 | 책임 |
|----|------|
| 본문 정규화 | 참좋은·챔조아 브랜드 노이즈 패턴 |
| 앵커·분리·슬라이스 | utils(항공/옵션/쇼핑 **경계만**) |
| 호텔 | `hotel-parser-verygoodtour` |
| 항공·옵션·쇼핑 **구조화** | **`register-input-parse-verygoodtour`** + 정형 입력란(본문 파서 비책임) |
| 포함/불포함 | `register-verygoodtour-basic` + 위 보강 |
| 일정 배열·표현 | **비책임** |
| mustKnow | **비책임**(`register-parse-verygoodtour`에 hanatour/modetour 동일 extract 호출 없음 — 변경 시 본 문서·코드 표 동시 갱신) |

---

## 관련 문서

- `docs/detail-body-review-policy.md` — 검수 심각도 공통 정의(타입 축).
