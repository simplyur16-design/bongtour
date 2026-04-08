# 등록 파이프 — 일정 표현층 SSOT

> 상태: **실전 고정(4공급사)**. 모두투어·하나투어·참좋은여행(`verygoodtour`)·`ybtour` 등록 경로에서 확인된 표현층 계약을 반영한다.  
> 관련: `lib/schedule-from-product.ts`, `lib/upsert-itinerary-days.ts`, `lib/parse-and-register-hanatour-schedule.ts`, `lib/parse-and-register-verygoodtour-schedule.ts`, `lib/parse-and-register-ybtour-schedule.ts`, `scripts/verify-hanatour-register-schedule-e2e.ts`, `scripts/verify-verygoodtour-register-schedule-e2e.ts`, `scripts/verify-ybtour-register-schedule-e2e.ts`, `docs/LEGACY-AND-SCHEDULE-SSOT.md`, `docs/SCHEDULE-SSOT-DECISION.md`

> **본문 섹션 분리 SSOT:** 붙여넣기 본문을 `flight_section`·`hotel_section` 등으로 **줄 단위로 자르는 규칙**은 공급사별 `docs/body-parser-{hanatour|modetour|verygoodtour|ybtour}-ssot.md`가 1급이다. 본 문서는 **표현층**(§2.1)·저장 매핑만 규정하며, §2.2에 따라 본문 추출 알고리즘은 범위 밖이다.

---

## 1. 문서 목적

### 1.1 왜 이 SSOT가 필요한지

- 기본정보 등록 파이프에서 **사용자에게 보이는 일정 문구**(제목·요약·식사·숙소·이미지 힌트)의 **의미와 우선순위**를 한곳에 고정한다.
- 공급사가 늘어도 **“무엇을 어떻게 보여줄지”**만 공통화하고, **데이터를 어디서 긁을지**는 공급사별로 둔다.

### 1.2 추출층과 표현층을 왜 분리하는지

| 층 | 담당 | 변경 빈도 |
|----|------|-----------|
| **추출층** | 사이트·붙여넣기·LLM·스크래퍼에서 원문·구조를 읽어 `parsed.schedule` 등으로 채움 | 공급사·채널마다 다름 |
| **표현층** | 읽은 값을 **짧은 제목·1문장 요약·표기 규칙**으로 정리해 저장·표시에 넘김 | 공급사 공통 규칙으로 둘 수 있음 |

분리하지 않으면 “모듈투어 HTML”과 “노랑풍선 DOM”이 표현 규칙까지 갈라져 유지보수가 불가능해진다.

---

## 2. 적용 범위

### 2.1 적용 대상 (표현층 SSOT)

- 일정 **title**
- 일정 **description** (등록 타입상 브리프 문장)
- **imageKeyword**
- **meals** 및 조·중·석·요약 필드
- **accommodation** / **hotelText** (일차 숙소 표기)
- **rawBlock** (등록 스냅샷)

### 2.2 비적용 대상 (이 문서 밖)

- 가격·달력·가격표 판독
- 항공 원문·구조 판독
- 본문 HTML/붙여넣기 **추출 알고리즘** 자체
- 스크래퍼·어댑터 구현
- 공개 UI 컴포넌트 구현 세부

---

## 3. 현재 확정된 저장/표시 매핑 (레이어별 역할)

| 레이어 | 역할 | 비고 |
|--------|------|------|
| **`parsed.schedule`** | 등록 파이프 인메모리의 일차별 표현 결과 (`RegisterScheduleDay`: day, title, description, imageKeyword, hotelText, breakfast/lunch/dinner, mealSummaryText) | 공급사 파서·보강의 **출구** |
| **`itineraryDayDrafts`** | `ItineraryDayInput[]`. 기본은 `registerScheduleToDayInputs(parsed.schedule)` + **모두투어** confirm 시 스크래퍼 초안에 대한 hotel-first·schedule 오버레이 + **하나투어** 시 `finalizeHanatourItineraryDayDraftsFromSchedule` + **참좋은** `finalizeVerygoodtourItineraryDayDraftsFromSchedule` + **ybtour** `finalizeYbtourItineraryDayDraftsFromSchedule`로 schedule 기준 재확정·숙소 정렬 | DB 직전 |
| **`ItineraryDay`** | Prisma: 일차별 **원문/정본 계열** 컬럼 (`summaryTextRaw`, 식사·숙박 필드, `hotelText`, `rawBlock` 등). **title 전용 컬럼 없음** | `upsertItineraryDays` |
| **`Itinerary`** | 레거시: 일차별 `description` **한 필드**에 `title`과 `description`을 `\n\n`으로 합쳐 저장 (모두투어 confirm 경로) | `getScheduleFromProduct`는 JSON 없을 때만 fallback |
| **`Product.schedule`** | JSON 문자열: 공개 일정 표시 **단기 SSOT** (`getScheduleFromProduct`: JSON 우선). 항목에 day, description, 선택 title·imageKeyword·imageUrl 등 | `lib/schedule-from-product.ts` 주석 정책 |

**차이 요약**

- **공개 카드의 제목·본문 줄·imageKeyword(일정 JSON)**: `Product.schedule` 우선.
- **일차 식사·`hotelText`**: 상세 `page`에서 `itineraryDays`와 JSON 일정을 **머지**해 전달 (코드 기준).
- **`summaryTextRaw`**: `registerScheduleToDayInputs`에서 **`description` 우선, 없으면 `title`** → DB에는 “요약 문장” 축으로 저장.

---

## 4. 표현층 SSOT 규칙 (공통 초안)

### 4.1 일정 summary 목적

- 일차별 **사용자가 훑어보는 브리프**: 동선·핵심 관광·이동·당일 숙소·식사를 과장·장문 없이 전달한다.

### 4.2 title 규칙

- **핵심 동선 + 핵심 관광지 + 최종 이동지** 수준의 짧은 한 줄(또는 항공일은 `출발 · 도착` 형).
- 같은 이동/관광 표현을 연달아 붙이지 않는다.
- 길이 상한을 둔다 (모두투어 구현: 패턴 매칭 시 짧은 고정 형, 폴백 시 문자 상한).

### 4.3 description 규칙

- **짧은 1문장 브리프** (종결형 허용).
- 본문에 **명시된 이동 시간**만 자연스럽게 포함; 없으면 지어내지 않는다.
- 유의사항·개요·홍보·선택관광 안내 등은 요약에 넣지 않는다.

### 4.4 meals 표기 규칙

- 가능하면 **조·중·석** 분리 필드 + 필요 시 **mealSummaryText**.
- 레거시 **`meals`**: 파생 필드(조·중·석 연결 또는 요약 문자열). 저장 시 `registerScheduleToDayInputs`가 채움.

### 4.5 accommodation 표기 규칙

- 일차 **예정 숙소 한 줄**은 `hotelText`와 표시용 `accommodation`을 **같은 문장 축**으로 맞춘다.  
  - **모두투어** confirm: schedule 기준 hotel-first 후 `accommodation` 동기화 (`modetourItineraryDraftsApplyScheduleHotelBodyFirst` 등).  
  - **하나투어** confirm 직전 draft: `finalizeHanatourItineraryDayDraftsFromSchedule`에서 유효 `hotelText`가 있으면 `accommodation`에 동일 값 반영 (`숙박 없음` 포함).  
  - **참좋은** / **ybtour**: 각각 `finalizeVerygoodtourItineraryDayDraftsFromSchedule`, `finalizeYbtourItineraryDayDraftsFromSchedule`에서 유효 `hotelText`가 있으면 `accommodation` 동기화 (`lib/parse-and-register-verygoodtour-schedule.ts`, `lib/parse-and-register-ybtour-schedule.ts`).

### 4.6 imageKeyword 규칙

- 이미지 검색·캡션 보조용 **짧은 장소·이동 힌트**.
- `Day N travel` 같은 무의미 토큰 금지.  
  - **모두투어**: 붙여넣기 일정 정제 경로에서 제거·대체.  
  - **하나투어**: 공용 `register-parse.ts`는 비어 있을 때 해당 문자열을 기본값으로 줄 수 있으므로, **`augmentHanatourScheduleExpressionParsed`** (`lib/parse-and-register-hanatour-schedule.ts`)에서 패턴 일치 시 `title`→`description` 앞부분으로 대체하거나 공백 처리 (공용 파일 비수정).  
  - **참좋은**: **`augmentVerygoodtourScheduleExpressionParsed`**에서 행 단위 정리.  
  - **ybtour**: **`augmentYbtourScheduleExpressionParsed`**(및 핸들러 경로의 **`sanitizeYbtourRegisterParsedStrings`**)에서 행 단위 정리.

### 4.7 rawBlock 규칙

- 등록 시점의 **`{ title, description, imageKeyword }` JSON 문자열**로 스냅샷 보관 (`registerScheduleToDayInputs`).
- 재파싱·감사 시 “당시 표현” 추적용. 파이프가 덮어쓸 때는 **같은 스키마**를 유지한다.

### 4.8 노이즈 제거 규칙

- 일정 요약에 섞이면 안 되는 토큰/구간: 유의사항·개요·더보기/크게보기·이미지 플레이스홀더·하단 표 등.  
  - **모두투어**: `lib/register-modetour-pasted-schedule.ts`에서 처리.  
  - **하나투어**: 상세 노이즈 컷은 LLM·정형 본문 파서(`detail-body-parser-hanatour` 등) 측; 일정 행 표현은 `parsed.schedule` 채운 뒤 위 규칙·후처리로 마감.  
  - **ybtour**: 붙여넣기 본문의 **`N일차` 블록 경계**·마지막 일차 **꼬리 구간**은 `lib/parse-and-register-ybtour-schedule.ts`에서 다루며, 실본문 E2E(`tmp_ybtour_body.txt`)에서는 Day4 `description`에 선택관광·옵션 목록류 꼬리가 끼지 않았음을 스크립트가 assert한다 (`scripts/verify-ybtour-register-schedule-e2e.ts`).

### 4.9 fallback 금지 규칙

- 본문·LLM에 없는 **창작 문장**으로 채우지 않는다.
- 폴백은 **짧게라도 원문/추출 결과에 기반**한다.

### 4.10 confirm 저장 시 브리프 유지 규칙

- **목표**: 확정 시 `ItineraryDay.summaryTextRaw`·`rawBlock`·식사·숙소가 **브리프(description) 축**에서 벗어나 장문 raw·스크래퍼-only 초안에 잡아먹히지 않게 한다.
- **모두투어**: 스크래퍼 등으로 만든 일차 초안 위에 `parsed.schedule`을 **오버레이** (`modetourItineraryDraftsApplyParsedScheduleOverlay`: 동일 일차 `summaryTextRaw` 브리프 길이 ≥ 8자일 때 식사·`rawBlock` 등 갱신). 숙소는 먼저 **hotel-first** (`modetourItineraryDraftsApplyScheduleHotelBodyFirst`).
- **하나투어**: `savePersistedParsedOnly`로 confirm 보충 재파싱이 꺼진 채로도, **`recoverHanatourEmptyScheduleWithFullParse`** (`forced === 'hanatour'`, 본문 `text` 있음, `parsed.schedule` 비었을 때)로 **풀 파싱(`forPreview: false`) 1회**를 호출해 `schedule`·필요 시 `dayHotelPlans`만 보강 (`lib/parse-and-register-orchestration.ts`). 이후 **`finalizeHanatourItineraryDayDraftsFromSchedule`**로 draft를 **`registerScheduleToDayInputs(schedule)` 결과**에 맞추고 `hotelText`↔`accommodation` 정렬.
- **참좋은**: 전용 `lib/parse-and-register-verygoodtour-handler.ts`에서 `augmentVerygoodtourScheduleExpressionParsed` → `registerScheduleToDayInputs` → `finalizeVerygoodtourItineraryDayDraftsFromSchedule` 순으로 정렬; confirm 전 **`verygoodConfirmHasScheduleExpressionLayer`**로 일정 표현층을 검사한다.
- **ybtour**: `runParseAndRegisterFlow` 옵션으로 **`recoverYbtourEmptyScheduleWithFullParse`**, 붙여넣기 본문을 넘기는 **`augmentParsed`**(`augmentYbtourScheduleExpressionParsed`), **`finalizeYbtourItineraryDayDraftsFromSchedule`**, 오케스트레이션 **`confirmScheduleExpressionLayerOk: ybtourConfirmHasScheduleExpressionLayer`** (`lib/parse-and-register-ybtour-handler.ts`).

---

## 5. 필드별 SSOT 정의

### 5.1 title

| 항목 | 내용 |
|------|------|
| **field** | `title` (`RegisterScheduleDay` / `Product.schedule` JSON / `ItineraryDay.rawBlock` JSON / `Itinerary.description` 상단 블록) |
| **의미** | 일차 **헤드라인** (짧은 동선·관광·이동). |
| **생성 기준** | 추출층이 넘긴 원문을 표현층 규칙으로 압축 (모두투어: 붙여넣기 정제 + 패턴 마감 / 하나투어: 등록 LLM compact `schedule[]` + 후처리). |
| **저장 위치** | `Product.schedule` JSON `title`; `Itinerary.description` 앞 단락; **`ItineraryDay` 단독 컬럼 없음** → `rawBlock` JSON에 포함. |
| **공개 표시 기준** | `getScheduleFromProduct` → 행의 `title` (JSON 우선). |
| **비고** | DB 스키마상 제목 전용 컬럼은 `ItineraryDay`에 없음. |

### 5.2 description

| 항목 | 내용 |
|------|------|
| **field** | `description` (`RegisterScheduleDay` / `Product.schedule` JSON) |
| **의미** | 일차 **브리프 본문** (1문장 요약). |
| **생성 기준** | 표현층 규칙 (섹션 4.3). |
| **저장 위치** | `Product.schedule` JSON; `Itinerary.description`의 **하단 블록**(합본 시). |
| **공개 표시 기준** | JSON `description` → 상세 컴포넌트의 요약 줄 입력. |
| **비고** | `ItineraryDay.summaryTextRaw`와 **같은 문장 축**으로 취급 (아래). |

### 5.3 summaryTextRaw

| 항목 | 내용 |
|------|------|
| **field** | `ItineraryDay.summaryTextRaw` |
| **의미** | DB에 저장하는 **해당 일 요약 문장 원문**. |
| **생성 기준** | `registerScheduleToDayInputs`: **`description` trim 우선, 없으면 `title`**. |
| **저장 위치** | `ItineraryDay.summaryTextRaw`. |
| **공개 표시 기준** | 상세 `page`는 일정 카드에 **JSON schedule을 먼저** 쓰고, 식사/호텔은 `itineraryDays` 머지 — **카드 본문 줄은 JSON `description` 기준**이 현재 경로. |
| **비고** | **description과 동일 축**으로 정렬하는 것이 파이프 일관성에 유리. |

### 5.4 breakfastText / lunchText / dinnerText

| 항목 | 내용 |
|------|------|
| **field** | `breakfastText`, `lunchText`, `dinnerText` |
| **의미** | 해당 일 **조·중·석** 표기 원문. |
| **생성 기준** | 추출층(일정표/LLM) → 표현층에서 불필요 쉼표·접미 정리 가능 (모두투어 붙여넣기 추출). |
| **저장 위치** | `ItineraryDay` 동명 컬럼. |
| **공개 표시 기준** | 상세에서 schedule 행에 머지된 값 → `formatMealDisplay` 등. |
| **비고** | `registerScheduleToDayInputs`가 `meals` 파생에 사용. |

### 5.5 mealSummaryText

| 항목 | 내용 |
|------|------|
| **field** | `mealSummaryText` |
| **의미** | 조·중·석를 한 줄로 묶은 **요약 원문** (표에만 있을 때 등). |
| **생성 기준** | 추출층. |
| **저장 위치** | `ItineraryDay.mealSummaryText`. |
| **공개 표시 기준** | `formatMealDisplay`가 분필드와 함께 처리. |
| **비고** | 분필드가 비었을 때 단일 요약으로 표시 가능. |

### 5.6 meals

| 항목 | 내용 |
|------|------|
| **field** | `ItineraryDay.meals` |
| **의미** | 레거시 **식사 한 줄** (조·중·석 연결 또는 mealSummary). |
| **생성 기준** | `registerScheduleToDayInputs`: `[breakfast, lunch, dinner].join(' / ')` 또는 `mealSummaryText`. |
| **저장 위치** | `ItineraryDay.meals`. |
| **공개 표시 기준** | 관리자 원문 일정표 등; 공개 카드는 분필드 머지 경로 우선. |
| **비고** | **파생 필드**. SSOT 논리 축은 조·중·석 + mealSummaryText. |

### 5.7 hotelText

| 항목 | 내용 |
|------|------|
| **field** | `hotelText` |
| **의미** | 해당 일 **예정 숙소 한 줄** (본문 일정표 우선 정책). |
| **생성 기준** | 추출층; 모두투어는 본문 `예정호텔` 등 기준 + LLM 약값 보정. |
| **저장 위치** | `ItineraryDay.hotelText`; `parsed.schedule`. |
| **공개 표시 기준** | `formatScheduleDayHotelLine`: **`dayHotelText` 최우선**. |
| **비고** | 상품 입력칸 `hotelNames`/`hotelSummaryText`보다 **일차 hotelText가 우선**. |

### 5.8 accommodation

| 항목 | 내용 |
|------|------|
| **field** | `accommodation` |
| **의미** | 숙박 **표시용 원문** (스크래퍼 등에서 올 수 있음). |
| **생성 기준** | 초안 입력; 모두투어 confirm에서 **유효 `hotelText`가 있으면 `hotelText`와 동기화**; 하나투어·참좋은·ybtour는 각 **finalize**(`finalizeHanatour…` / `finalizeVerygoodtour…` / `finalizeYbtour…`)에서 동기화. |
| **저장 위치** | `ItineraryDay.accommodation`. |
| **공개 표시 기준** | 일차 호텔 줄 로직에서 `hotelText`와 동일 축으로 맞추는 것이 목표. |
| **비고** | 스크래퍼만 있을 때와 붙여넣기만 있을 때 불일치 방지용 **우선순위 규칙** 필요 (섹션 6). |

### 5.9 imageKeyword

| 항목 | 내용 |
|------|------|
| **field** | `imageKeyword` |
| **의미** | 이미지 검색·메타 보조 **짧은 키워드**. |
| **생성 기준** | 표현층 규칙 (섹션 4.6). |
| **저장 위치** | `Product.schedule` JSON; `rawBlock` JSON. **`ItineraryDay` 단독 컬럼 없음**. |
| **공개 표시 기준** | 일정 JSON 기반 이미지 파이프. |
| **비고** | |

### 5.10 rawBlock

| 항목 | 내용 |
|------|------|
| **field** | `ItineraryDay.rawBlock` |
| **의미** | 등록 시점 **title/description/imageKeyword 스냅샷** (JSON). |
| **생성 기준** | `registerScheduleToDayInputs`. |
| **저장 위치** | `ItineraryDay.rawBlock`. |
| **공개 표시 기준** | 직접 노출 필수 아님; 감사·재처리 참고. |
| **비고** | 모두투어 confirm에서 스크래퍼 초안 위에 **schedule 오버레이**로 갱신. 하나투어·참좋은·ybtour는 augment 반영 후 `schedule`로부터 `registerScheduleToDayInputs`가 생성한 JSON과 일치하도록 finalize·검증 스크립트가 동일 축을 본다. |

---

## 6. 우선순위 규칙

| 질문 | 결론 (현재 코드 기준) |
|------|------------------------|
| **title 기준** | 공개: **`Product.schedule` JSON의 `title`**. 없으면 `Itinerary.description` fallback (제목/본문 분리 없이 한 필드). |
| **description / summaryTextRaw 동일 축?** | **예.** 생성 시 `summaryTextRaw = description \|\| title`. 표현 정책상 **브리프 문장은 한 축**. |
| **meals 기준 필드 조합** | **조·중·석 + mealSummaryText**가 원천; **`meals`는 파생**. |
| **hotelText vs accommodation 충돌** | 모두투어 confirm: **schedule의 유효 `hotelText`가 `hotelText`·`accommodation`에 반영**(hotel-first). 하나투어: **`finalizeHanatourItineraryDayDraftsFromSchedule`**. 참좋은: **`finalizeVerygoodtourItineraryDayDraftsFromSchedule`**. ybtour: **`finalizeYbtourItineraryDayDraftsFromSchedule`**. 공개: **`dayHotelText`(hotelText) 우선** (`formatScheduleDayHotelLine`). |
| **confirm 저장 최종 우선** | **모두투어**: (1) draft 소스 (2) **`modetourItineraryDraftsApplyScheduleHotelBodyFirst`** (3) **`modetourItineraryDraftsApplyParsedScheduleOverlay`** (브리프 ≥ 8자일 때 식사·`rawBlock` 등). **하나투어**: (1) `parsed.schedule` 비면 **풀 파싱 복구** (2) **`augmentHanatourScheduleExpressionParsed`** (3) **`finalizeHanatourItineraryDayDraftsFromSchedule`** 후 `buildScheduleJson`·`upsertItineraryDays`와 동일 축. **참좋은**: 핸들러 내 augment → finalize 및 **`verygoodConfirmHasScheduleExpressionLayer`**. **ybtour**: 복구 옵션 → augment(붙여넣기 본문) → finalize 및 **`ybtourConfirmHasScheduleExpressionLayer`** (`confirmScheduleExpressionLayerOk`). |
| **confirm 직전 일정 표현층** | 가격·항공 등 다른 신호만으로 확정하지 않도록, **일차 표현이 실질적으로 존재하는지** 검사하는 패턴이 필요하다. 구현 위치는 공급사별로 **`parse-and-register-orchestration.ts`의 `confirmScheduleExpressionLayerOk`**(ybtour) 또는 **전용 핸들러 내부**(참좋은 등)로 나뉜다. |

---

## 7. 공통화 가능 / 비공통

### 7.1 표현층 — 공통화 가능 (4공급사 기준 확정)

- `RegisterScheduleDay[]` → `registerScheduleToDayInputs` → `summaryTextRaw` / `rawBlock` / 식사 파생 / `hotelText` 계약.
- `Product.schedule` JSON 우선 읽기 (`getScheduleFromProduct`).
- 브리프 축: **`summaryTextRaw = description || title`**, **`rawBlock = { title, description, imageKeyword }`**.
- 무의미 `imageKeyword`(`Day N travel` 등) 제거·대체는 **공급사 후처리**로 둔다 (공용 `register-parse.ts` 단독에만 의존하지 않음).
- **confirm 직전**: 일정 표현층(스케줄 행 또는 동등한 draft 신호)이 없으면 저장을 막거나 경고하는 **게이트**를 둘 수 있으며, ybtour는 오케스트레이션 훅으로, 참좋은은 핸들러 내부 검사로 연결된다 (섹션 6 표).

### 7.2 추출층 — 공급사별로 유지 (공통화하지 않음)

- 사이트별 HTML/DOM/붙여넣기 파서, **등록 LLM 프롬프트·compact 스키마**, 스크래퍼·어댑터.
- **가격·달력·항공·쇼핑·포함/불포함** 판독 및 본문 정형 파서(`detail-body-parser-*` 등).
- 미리보기에서 `schedule[]`를 비우는 공용 정책(`finalizePreviewRegisterRaw`)이 있으면, **표현층 연결 복구는 공급사 전용 옵션·후처리**로 보완 (예: 하나투어 `recoverHanatourEmptyScheduleWithFullParse`, ybtour `recoverYbtourEmptyScheduleWithFullParse`).
- **ybtour** 본문의 `N일차` 블록 추출·LLM 일부 일차만 반환하는 경우 등은 **추출·보강 입력**으로 남고, **없는 일차만 본문에서 메우는** 병합은 표현층 augment(`mergeMissingYbtourScheduleDays`) 계약으로 고정한다 (섹션 11.3).

---

## 8. 적용 사례 1: 모두투어

### 8.1 확정된 결과 요약

- 붙여넣기 본문 기준 **일차 블록 분리·노이즈 제거·짧은 title·1문장 description·식사/예정호텔 추출·imageKeyword 정리**는 `lib/register-modetour-pasted-schedule.ts`에 구현.
- `parseForRegisterModetour` → `supplementModetourScheduleFromPastedBody`로 `parsed.schedule`에 반영.
- 저장: `registerScheduleToDayInputs` → confirm 시 **hotel-first + schedule 오버레이** (`lib/parse-and-register-modetour-handler.ts`).

### 8.2 다른 공급사로 확장할 때

1. 공급사별 **추출층**으로 `RegisterScheduleDay[]`를 채운다.  
2. **표현층**은 본 문서 섹션 4·5·6·12를 만족하도록 전용 정제·finalize를 둔다.  
3. 저장 경로는 동일: **`registerScheduleToDayInputs` → ItineraryDay / Product.schedule / Itinerary** (`LEGACY-AND-SCHEDULE-SSOT.md` 참고).

---

## 9. 적용 사례 2: 하나투어 (실본문 E2E로 확인)

### 9.1 검증 입력·방법

- **본문 출처**: `하나투어.docx`에서 추출한 평문(실상품 본문; 검증 시점 기준 상품코드 **JKP130260501TW5** 등 포함).  
- **재현 스크립트**: `scripts/verify-hanatour-register-schedule-e2e.ts` — `.env.local`/`.env` 로드 후 `lib` 동적 import, **미리보기 `forPreview: true` → `schedule.length === 0` → 풀 파싱 `forPreview: false` 복구**(오케스트레이션 `recoverHanatourEmptyScheduleWithFullParse`와 동일 취지) → `augmentHanatourScheduleExpressionParsed` → `registerScheduleToDayInputs` → `finalizeHanatourItineraryDayDraftsFromSchedule` → `buildScheduleJson` 형태로 일치 검사.  
- **코드 진입**: `lib/parse-and-register-hanatour-handler.ts`가 `recoverHanatourEmptyScheduleWithFullParse`, `augmentParsed`, `finalizeHanatourItineraryDayDraftsFromSchedule`를 `runParseAndRegisterFlow`에 넘김.

### 9.2 확인된 결과 (해당 E2E 실행 기준)

- **`parsed.schedule`**: 복구 후 **3일** 행 존재.  
- **`itineraryDayDrafts`**: 3건 생성.  
- **`summaryTextRaw`**: 각 일 **`description`과 동일** (`registerScheduleToDayInputs` 규칙과 일치).  
- **`rawBlock`**: `{ title, description, imageKeyword }`가 augment 반영 후 `schedule` 행과 **필드 일치**.  
- **`hotelText` / `accommodation`**: 일치(예: `숙박 없음` 포함).  
- **`Day N travel`**: augment 후 **잔존 0건**.  
- **`Product.schedule`**: `buildScheduleJson(augment된 schedule)`과 **동일 표현층 축**(스크립트에서 JSON 길이·내용 일관만 검증; DB insert는 동일 인자 경로).

### 9.3 한계 (문서화만)

- HTTP confirm + Prisma 저장까지는 **관리자 인증·미리보기 토큰**이 필요해 스크립트 범위 밖일 수 있다. 저장 계약은 오케스트레이션상 **동일 `schedule`·`itineraryDayDrafts`**가 쓰인다는 전제로 위와 정합.

---

## 10. 적용 사례 3: 참좋은여행 (`verygoodtour`)

### 10.1 검증 입력·방법

- **본문 출처**: 저장소 루트 `tmp_verygoodtour_body.txt` (실본문 추출물; 스크립트 주석 기준 참좋은여행.docx → 평문).  
- **재현 스크립트**: `scripts/verify-verygoodtour-register-schedule-e2e.ts` — `.env.local`/`.env` 로드, **`GEMINI_API_KEY` 필요**, 미리보기 `forPreview: true` → `schedule.length === 0`이면 **풀 파싱 복구**(`forPreview: false`, `skipDetailSectionGeminiRepairs: true` 등 핸들러와 동일 취지) → **`augmentVerygoodtourScheduleExpressionParsed`** → **`registerScheduleToDayInputs`** → **`finalizeVerygoodtourItineraryDayDraftsFromSchedule`** → `buildScheduleJson`과의 행 동치, `summaryTextRaw`/`rawBlock`/`hotelText`↔`accommodation`, augment 후 **`Day N travel` 0건**, **`verygoodConfirmHasScheduleExpressionLayer`**.  
- **코드 진입**: `lib/parse-and-register-verygoodtour-handler.ts`가 위 augment·finalize·게이트를 **오케스트레이션 `runParseAndRegisterFlow`가 아닌 전용 핸들러 본문**에서 수행한다.

### 10.2 확인된 계약 (스크립트가 검증하는 범위)

- `parsed.schedule` → drafts → **`Product.schedule` JSON** 표현 필드 **동치**, 브리프·`rawBlock`·숙소 축 일치, **일정 표현층 게이트** 통과.  
- 스크립트는 **일차 개수를 고정 숫자로 단정하지 않는다**(최종 `schedule`이 비어 있으면 FAIL).

### 10.3 한계 (문서화만)

- HTTP confirm·Prisma 저장은 인증·토큰 필요로 스크립트 범위 밖일 수 있다.

---

## 11. 적용 사례 4: ybtour

### 11.1 검증 입력·방법

- **본문 출처**: 저장소 루트 `tmp_ybtour_body.txt`.  
- **재현 스크립트**: `scripts/verify-ybtour-register-schedule-e2e.ts` — preview `parseForRegisterYbtour`(`forPreview: true`) → `schedule` 비면 **풀 파싱 복구**(`forPreview: false`, `skipDetailSectionGeminiRepairs: true` 등 오케스트레이션 `recoverYbtourEmptyScheduleWithFullParse`와 동일 취지) → **`sanitizeYbtourRegisterParsedStrings(augmentYbtourScheduleExpressionParsed(merged, text))`** → **`registerScheduleToDayInputs`** → **`finalizeYbtourItineraryDayDraftsFromSchedule`** → `buildScheduleJson` 동치·**`ybtourConfirmHasScheduleExpressionLayer`**.  
- **코드 진입**: `lib/parse-and-register-ybtour-handler.ts` → **`runParseAndRegisterFlow`** (`recoverYbtourEmptyScheduleWithFullParse`, `augmentParsed`에 붙여넣기 본문, `finalizeYbtourItineraryDayDraftsFromSchedule`, **`confirmScheduleExpressionLayerOk: ybtourConfirmHasScheduleExpressionLayer`**). 일정 보강·키워드 정리: `lib/parse-and-register-ybtour-schedule.ts`, 문자열 sanitize: `lib/register-ybtour-text-sanitize.ts`.

### 11.2 확인된 결과 (`tmp_ybtour_body.txt` 고정 E2E, 스크립트 assertion 기준)

- 최종 **`parsed.schedule` 4일**, **`itineraryDayDrafts` 4건**, **`Product.schedule` JSON 4행**.  
- augment 후 **`Day N travel` 잔존 0건**.  
- **`summaryTextRaw`**, **`rawBlock`**, **`hotelText`**, **`accommodation`**, 식사·**`meals`** 축: 스크립트가 schedule ↔ drafts 간 일치로 검증.  
- **마지막 일차 꼬리 노이즈**: Day4 `description`에 스크립트 정의 패턴(선택관광·`#선택옵션`·특정 호텔/마사지 문구·`$/인` 형태 등) **없음**을 assert.  
- **Day4 `hotelText`**: 해당 붙여넣기 기준 **빈값 유지**(무단 채움 없음) assert.

### 11.3 누락 일차 보강 (표현층 augment 계약)

- **`mergeMissingYbtourScheduleDays`**: 붙여넣기 본문에서 파생한 일차 행으로 **기존 `parsed.schedule`에 없는 `day`만** 추가하고, **이미 있는 일차 행은 덮어쓰지 않는다** (`lib/parse-and-register-ybtour-schedule.ts` 주석·구현과 일치).

### 11.4 공급사 키·레거시 표기

- **문서·SSOT·`brandKey`는 `ybtour` 기준**으로 정리한다. **`yellowballoon`**은 레거시 alias이며, 코드 주석·호환 목적에서만 언급한다 (`parse-and-register-orchestration.ts` 등).

### 11.5 한계 (문서화만)

- §9.3과 동일: confirm·DB insert 전체는 스크립트 범위 밖일 수 있다.

---

## 12. 네 공급사: 공통 확정 vs 차이 vs 추출/표현 분리

### 12.1 공통 확정 (일정 표현층)

| 항목 | 내용 |
|------|------|
| 표현 인메모리 기준 | **`parsed.schedule` (`RegisterScheduleDay[]`)** |
| DB 초안 생성 | **`registerScheduleToDayInputs`** → `summaryTextRaw`, `rawBlock`, 조·중·석, `mealSummaryText`, 파생 `meals`, `hotelText` |
| 공개 일정 우선 | **`Product.schedule` JSON** (`getScheduleFromProduct`) |
| rawBlock 스키마 | **`{ title, description, imageKeyword }`** |
| 브리프 축 | **`summaryTextRaw = description \|\| title`** |
| 식사 | 분필드 + `mealSummaryText` 원천, **`meals` 파생** |
| 숙소 표시 우선(공개) | 일정 카드 **`dayHotelText`(`hotelText`) 우선** |
| confirm 게이트 | 일정 표현층이 비어 있으면 확정만으로는 부족하다는 **원칙**; ybtour는 **`confirmScheduleExpressionLayerOk`**, 참좋은은 **`verygoodConfirmHasScheduleExpressionLayer`** 등으로 연결 (섹션 6). |

### 12.2 차이 (공급사별 후처리·추출 요약)

| 항목 | 모두투어 | 하나투어 | 참좋은 (`verygoodtour`) | ybtour |
|------|----------|----------|-------------------------|--------|
| 일정 행 채움 (추출층 중심) | 붙여넣기·`register-modetour-pasted-schedule` 정제 + 파서 보강 | 등록 LLM **compact** `schedule[]` (+ 공용 보조) | `parseForRegisterVerygoodtour` 등 전용 파서 | `parseForRegisterYbtour` + 본문 **`N일차`** 블록 기반 **누락 일차만** augment 병합 |
| 미리보기 `schedule=[]` | 공용 `finalizePreviewRegisterRaw` 동일 | **`recoverHanatourEmptyScheduleWithFullParse`** | 스크립트·핸들러 동일 취지의 **풀 파싱 복구** | **`recoverYbtourEmptyScheduleWithFullParse`** |
| confirm draft 보정 (표현층 마감) | 스크래퍼 초안 **위에** schedule **오버레이** + hotel-first | **`finalizeHanatourItineraryDayDraftsFromSchedule`** | **`finalizeVerygoodtourItineraryDayDraftsFromSchedule`** (전용 핸들러) | **`finalizeYbtourItineraryDayDraftsFromSchedule`** (`runParseAndRegisterFlow`) |
| 노이즈·키워드 | 붙여넣기 일정 모듈이 강함 | **`augmentHanatourScheduleExpressionParsed`** | **`augmentVerygoodtourScheduleExpressionParsed`** | **`augmentYbtourScheduleExpressionParsed`** + sanitize + 본문 블록 경계(꼬리 완화) |
| 일정 표현 게이트 | (경로별 기존 정책) | (경로별) | **`verygoodConfirmHasScheduleExpressionLayer`** | **`ybtourConfirmHasScheduleExpressionLayer`** → `confirmScheduleExpressionLayerOk` |

### 12.3 추출층 vs 표현층 마감 — 무엇이 어디에 속하는가

| 구분 | 추출층(공급사별) | 표현층 마감(공통 계약 + 공급사 모듈) |
|------|------------------|--------------------------------------|
| 본문·HTML·붙여넣기에서 일차 블록·표 읽기 | ✓ (모두투어 붙여넣기, 하나투어 LLM/정형 파서, 참좋은/ybtour 전용 파서) | |
| 미리보기에서 `schedule` 비움에 대한 **풀 파싱 복구** | 트리거·파서 호출 | 복구 결과를 `parsed.schedule`에 올린 뒤 이후 단계와 연결 |
| `Day N travel` 제거·브리프 정렬 | | ✓ (각 `augment*`·모두투어 붙여넣기 정제) |
| **누락 일차만** 본문에서 보강 | 본문에서 일차 블록을 **파생**하는 로직 | ✓ ybtour: **`mergeMissingYbtourScheduleDays`** (기존 행 비덮어쓰기 금지) |
| `registerScheduleToDayInputs`·finalize·`Product.schedule` 동치 | | ✓ |

### 12.4 공급사별로 남겨야 하는 것 (표현층 밖 또는 전처리)

- 본문→`RegisterScheduleDay[]`를 만드는 **추출·LLM 스키마·미리보기 정책 보완** 방식.  
- **가격·항공·쇼핑·포함/불포함** (본 SSOT 비적용).  
- 스크래퍼/어댑터 유무 및 confirm 시 **초안 소스** 존재 여부(모두투어형 오버레이 vs 타 공급사형 finalize).  
- 공용 **`register-parse.ts` 출력 품질·토큰 한계** 자체(수정 시 타 공급사 회귀 주의).  
- **호텔/식사 원문**을 어디서 읽을지(표·본문·LLM)에 대한 공급사별 판독.

---

## 13. 표현층 SSOT 확정 항목 요약표 (4절 마감)

| 규칙 | 확정 내용 |
|------|-----------|
| title | 짧은 헤드라인·동선; 저장은 JSON·`Itinerary`·`rawBlock` 경로 (섹션 4.2·5.1). |
| description | 1문장 브리프 축; `summaryTextRaw`와 동일 축 (4.3·5.2·5.3). |
| imageKeyword | 짧은 장소 힌트; `Day N travel` 금지·공급사 후처리로 제거 (4.6). |
| meals | 조·중·석 + `mealSummaryText`; `meals` 파생 (4.4). |
| accommodation | `hotelText`와 같은 문장 축; 공급사별 finalize·모두투어 hotel-first만 다름 (4.5·6절). |
| rawBlock | `{ title, description, imageKeyword }` 스냅샷 (4.7). |
| 노이즈 제거 | 모두투어 붙여넣기 모듈; 하나투어·참좋은·ybtour는 각 augment·본문 파서·ybtour 블록 경계 (4.8·§11). |
| fallback 금지 | 창작 금지·원문·추출 기반 (4.9). |
| confirm 브리프 유지 | 모두투어 오버레이; 하나투어·참좋은·ybtour는 복구+augment+finalize (4.10). |
| confirm 일정 표현층 게이트 | 확정 전 일차 표현 존재 여부 검사 **필요성** 확정; 구현은 ybtour 훅·참좋은 핸들러 등 공급사별 (6절·12.1). |
| 누락 일차 보강 | **있는 일차만** 본문 등에서 메우기; **기존 LLM/파서 행 덮어쓰기 금지**(ybtour `mergeMissingYbtourScheduleDays` 계약, §11.3). |

---

## 14. 다음 기본정보 축·신규 공급사 전 체크포인트

### 14.1 일정 표현층 SSOT가 4공급사 기준으로 고정된 범위

- **저장/표시 매핑**(§3)·**필드 정의**(§5)·**우선순위**(§6)·**공통 계약**(§7.1·§12.1)은 네 공급사 경로와 맞춰 문서에 반영되었다.  
- **적용 사례**: 모두투어(§8), 하나투어 E2E(§9), 참좋은 E2E(§10), **ybtour E2E 고정 본문**(§11).

### 14.2 다음 축(가격 / 항공 / 포함·불포함 / 쇼핑·옵션)으로 넘어가기 전

- 본 문서는 **일정 표현층**만 SSOT로 고정한다. 위 축은 **별도 계약·전용 handler·finalize(또는 동등 저장 단계)·저장 매핑**이 필요하며, **실본문 E2E**로 검증 순서를 재사용하는 것이 안전하다.  
- **다음 단계가 “다섯 번째 공급사 추가”가 아니라 “다음 기본정보 축”**인 경우에도, 일정 때와 같이 **추출층 vs 표현(또는 정책)층**을 나누고 공용 파일 단일 대형 변경을 피한다.

### 14.3 신규 공급사·축 공통 체크리스트

1. **문서상 확정**: 섹션 3·4·5·6·12의 **출력 계약**이 해당 공급사/축에도 그대로 적용되는지.  
2. **진입 파일**: 전용 **`parse-and-register-*-handler.ts`** 및 (해당 시) **`runParseAndRegisterFlow`** 옵션(`savePersistedParsedOnly`, `augmentParsed`, schedule 복구 플래그, `confirmScheduleExpressionLayerOk` 등).  
3. **오케스트레이션**: `parse-and-register-orchestration.ts`에서 **미리보기 `schedule` 비움·confirm 게이트**가 브랜드에 주는 영향.  
4. **일정 마감 모듈**: 모두투어형 붙여넣기 정제 / 하나투어·참좋은·ybtour형 **`*-schedule.ts` augment·finalize** 등 패턴 선택.  
5. **검증**: 실본문 1건으로 `parsed.schedule` → drafts → `buildScheduleJson`(및 해당 축의 저장 필드) **동치** 검사.  
6. **손대지 않을 것**: 공용 `register-parse.ts` 단일 거대 변경, 타 공급사 회귀, 공개 UI(일정 축 작업 시).

---

## 15. 변경 이력

| 날짜 | 내용 |
|------|------|
| (초안) | 모두투어 등록·저장·공개 읽기 경로 코드 기준 skeleton 작성 |
| 2026-04 | 하나투어 실본문 E2E 검증 결과·모두투어 대비 공통/차이·4.10·체크포인트 반영, 문서 상태를 2공급사 실전 고정으로 갱신 |
| 2026-04-01 | 참좋은·ybtour 적용 사례·4공급사 비교표·추출/표현 분리·게이트·누락 일차 보강·다음 축 체크포인트 반영; ybtour `tmp_ybtour_body.txt` E2E assertion 사실만 기록 |
