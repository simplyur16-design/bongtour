# 노랑풍선(ybtour / yellowballoon alias) 본문 섹션 분리·추출 SSOT

## 목적

관리자 등록 시 **붙여넣기 본문**을 결정적으로 나누어 `DetailBodyParseSnapshot`을 만든다.  
이 문서는 **노랑풍선 전용** 앵커·정규화·슬라이스·하위 파서 책임의 **1급 유지보수 기준**이다.

**우선순위:** 본 문서 > 공통 정책. 키·레거시 URL 별칭 요약은 [register-supplier-extraction-spec.md](./register-supplier-extraction-spec.md) 「표기·키 SSOT (요약)」·`docs/admin-register-supplier-precise-spec.md` §4.

붙여넣기 **본문**의 한글·원문은 **파서 입력**이다. 요청 JSON의 `originSource` / `brandKey`는 canonical **`ybtour`**.

**일정 표현 SSOT:** `docs/register_schedule_expression_ssot.md` — 본 문서는 **본문 섹션 분리**만.

### 본문 파서 비책임 축 (입력 파서 SSOT)

- **항공·선택관광/옵션관광·쇼핑**의 **구조화(표·편명·행 배열)** 는 본 문서/`detail-body-parser-ybtour` **책임이 아니다.**
- 해당 축은 **`register-input-parse-ybtour`** 및 정형 입력란(`register-parse-ybtour`의 `pastedBlocks`)만이 SSOT다.
- 본문에 동일 문자열이 있어도 **본문 파서가 입력축을 대신 구조화하거나 덮어쓰지 않는다.** (슬라이스·`raw.*` 원료만 제공.)

---

## 이 문서를 따르는 코드 파일

| 파일 | 역할 |
|------|------|
| `lib/detail-body-parser-ybtour.ts` | 스냅샷 조립(항공/옵션/쇼핑 필드는 빈 껍데기)·포함/불포함·호텔 |
| `lib/detail-body-parser-utils-ybtour.ts` | 정규화·앵커·분리·슬라이스 |
| `lib/register-parse-ybtour.ts` | 본문 파서 호출·**입력란 기준** 항공/옵션/쇼핑 구조화·LLM·가격/쇼핑 finalize |
| `lib/register-input-parse-ybtour.ts` | 항공·옵션·쇼핑 **입력 해석 SSOT** |
| `lib/register-input-unstructured-body-ybtour.ts` | 비정형 옵션·쇼핑 |
| `lib/hotel-parser-ybtour.ts` | 호텔 섹션 |
| `lib/register-ybtour-basic.ts` | 포함/불포함 |
| `lib/review-policy-ybtour.ts` | 검수 |

회귀: `scripts/verify-detail-body-parser-regression.ts` 샘플 `Y1`–`Y3`.

---

## 입력 SSOT vs 본문 SSOT 경계

- 정형칸 우선: `sliceDetailBodySections` 동일(슬라이스 문자열만 덮어씀).
- **항공·옵션·쇼핑 구조화:** 전부 `register-parse-ybtour`에서 `register-input-parse-ybtour` 호출로만 수행. 본문 파서 exit 시 해당 필드는 빈 껍데기일 수 있음.

---

## 섹션 앵커 규칙

- **`YBTOUR_SECTION_ANCHOR_ALIASES`** (`detail-body-parser-utils-ybtour.ts`)가 SSOT.
- 노랑 특화: `노랑풍선`, `옐로우`, `여행일정표`, `노랑 선택관광`, `쇼핑 코스`, `노랑 쇼핑 횟수`(비정형 헤더는 `register-input-unstructured-body-ybtour` 상수와 별도 동기).

---

## False positive 방지

- `isFalseShoppingAnchorLineYbtour`, `isFalseHotelAnchorLineYbtour`.

---

## 항공 시드 슬라이스

- 순서: **`flight_section` → `schedule_section` → `summary_section`** (일정 블록이 위에 오는 붙여넣기 가정).
- 하한 **`YBTOUR_FLIGHT_SEED_MIN_LEN` (72)** 미만이면 전체 본문을 항공 입력으로 넘김.

---

## 포함/불포함 보강

- 보강 트리거: 정규화 본문에 **`포함\s*사항`** 과 **`불포함\s*사항`** 이 **둘 다** 있고, 슬라이스만으로 구조화가 비었을 때 전체 본문 재시도 (`detail-body-parser-ybtour.ts`).
- **앵커 별칭:** `포함 사항` / `불포함 사항`(공백 변형)을 `included_excluded_section`에 포함한다(utils).
- **`clipYbtourIncExcInputForParse`:** 구조화 직전에 **`포함/불포함/약관`** 탭 헤더, **`약관 / 취소수수료`**, `■ 약관`, `■ 취소수수료`, `# 약관` 등 **약관·취소 헤더 줄부터 이후**는 잘라 내어, 불포함 목록 안에 있더라도 **유니버셜 선택관광·싱글차지·예약금 문장**은 `register-ybtour-basic` 파서에 넘기되 **약관 장문은 포함/불포함 구조화 입력에서 제외**한다(오염 방지).

---

## 쇼핑 횟수 귀속(상단 vs 일정)

- **상단 요약 칩** `쇼핑 N회`: 상품 메타·가격/쇼핑 finalize 쪽 요약 신호로 본다(`register-ybtour-price` / `finalizeYbtourRegisterParsedShopping` 등 — 본 SSOT 범위 밖).
- **일정 본문** `면세점 쇼핑 N회` 등: **일정 설명**에 남기며, `shopping_section` 슬라이스·쇼핑 표와 **자동 동일화하지 않는다**. 충돌 시 **정형 쇼핑칸·쇼핑 섹션·일정 텍스트** 우선순위는 `docs/admin-register-supplier-precise-spec.md`·등록 파이프 정책을 따른다.

---

## 책임 범위

| 축 | 책임 |
|----|------|
| 본문 정규화 | 노랑·옐로우 고객센터류 노이즈 |
| 앵커·분리·슬라이스 | utils(항공/옵션/쇼핑은 **경계만**) |
| 호텔 | `hotel-parser-ybtour` |
| 항공·옵션·쇼핑 **구조화** | **`register-input-parse-ybtour`** + 정형 입력란(본문 파서 비책임) |
| 포함/불포함 | `register-ybtour-basic` + 보강 |
| 일정 배열·표현 | **비책임** |
| mustKnow | **비책임**(`register-parse-ybtour`에 전용 body extract 없음 — 변경 시 본 문서·코드 표 갱신) |

---

## 관련 문서

- `docs/admin-register-supplier-precise-spec.md` §4 — API·브랜드 키.
