# YellowBalloon ItineraryCollector 설계 초안

**코드 스캐폴딩**: `lib/ybtour/ybtour-itinerary-collector.ts`  
**관련**: [YELLOW-BALLOON-ADAPTER-DESIGN.md](./YELLOW-BALLOON-ADAPTER-DESIGN.md) (**구현 순서** 4번), [itinerary-policy.md](./itinerary-policy.md)

---

## 목적

노랑풍선 상품 상세의 **일정 탭** 또는 **일정 원문 블록**을 정본으로 사용해 `ItineraryDayInput[]` 를 생성한다.

---

## 최상위 원칙

1. **ItineraryDay 정본** = 일정 탭 또는 일정 원문 블록만.
2. **핵심포인트·상품요약·리뷰·혜택문구**로 day를 추론·생성하지 않는다.
3. 일정 탭 수집 실패 시 **`[]` 반환**.
4. 빈 배열은 **실패**로 간주하고, 승인 게이트에서 차단되는 것이 정상이다.

---

## 입력·출력

| 구분 | 내용 |
|------|------|
| 입력 | `page` 또는 HTML 컨텍스트, `productId`, `originSource = YELLOWBALLOON`, `originCode`, (선택) raw product context |
| 출력 | `ItineraryDayInput[]` — 실패 시 `[]` |

---

## 권장 파이프라인 (함수 단계)

| 단계 | 함수 | 역할 |
|------|------|------|
| 1 | `openItineraryTab()` | 일정 탭 클릭, 비동기 로딩 대기. 실패 시 이후 단계 생략 |
| 2 | `fetchItineraryHtmlOrState()` | DOM 또는 XHR로 일정 원문 블록 확보 |
| 3 | `extractDayBlocks()` | 1일차/2일차… 구분 노드 → 블록 배열. 구분 불가 시 **억지 분해 금지** → 실패 검토 |
| 4 | `parseDayBlock(dayIndex, rawBlock)` | 필드 추출 (아래 매핑). 구조화 실패해도 **rawBlock 우선 보존** |
| 5 | `buildItineraryDayInputs()` | day 오름차순, 빈 블록 제거, **day 중복 제거** → 최종 배열 |

---

## 필드 매핑 (설계 명세 → 현재 `ItineraryDayInput` / Prisma)

현재 스키마에는 `title` / `sortOrder` / `collectedAt` 컬럼이 **없다**. 아래처럼 **기존 필드에 흡수**한다.

| 설계 명세 | `ItineraryDayInput` | 비고 |
|-----------|----------------------|------|
| dayNumber | `day` | 1, 2, 3… |
| title | `summaryTextRaw` 앞줄 또는 `notes` | "1일차" 등은 `summaryTextRaw` 또는 첫 줄에 포함 |
| summary | `summaryTextRaw` | title 과 합칠 때 ` — ` 구분 등 |
| visitSpotsRaw | `poiNamesRaw` | |
| mealInfoRaw | `meals` | |
| hotelInfoRaw | `accommodation` | |
| routeTextRaw | `transport` | |
| rawBlock | `rawBlock` | **최소 1개 일차라도 반드시 확보 권장** (금지 규칙 참고) |
| dateText | `dateText` | 탭에 날짜 표기가 있으면 |
| city | `city` | 도시 한 줄이 분리되면 |
| sortOrder | *(없음)* | `day` 오름차순이 정렬 기준 |
| collectedAt | *(없음)* | DB 스키마에 없음 — 필요 시 추후 마이그레이션 별도 |

---

## 금지

- 핵심포인트를 잘라 day 생성
- 리뷰 문구를 day에 삽입
- 일정 탭 실패 시 **Product 설명으로 대체** day 생성
- **rawBlock 없이 summary만** 남기기 (정책상 지양 — 구조화 실패 시에도 `rawBlock`에 원문 덩어리 우선)

---

## 실패 처리

다음에 해당하면 **`[]` 또는 명시적 실패**로 끝내고, 승인 게이트에서 막힌다.

- 일정 탭 열기 실패  
- day block 구분 실패 (억지 1일치 분해 안 함)  
- 일정 원문 **raw block** 확보 실패  

---

## VERYGOODTOUR / MODETOUR / 출발 어댑터와의 관계

- **분리 모듈**: `ybtour-itinerary-collector.ts` 만 사용. 다른 공급사 일정 파서와 **합치지 않음**.
- **출발 수집** `collectYellowBalloonDepartureInputs` 와 **독립** — 호출 순서는 오케스트레이션 레이어에서 결정.
