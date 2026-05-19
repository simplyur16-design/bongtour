# 하나투어 회귀 기준 (운영 — 화면·URL)

**목적:** P1b·P2 이후 등록·공개 상세 변경 시 **같은 상품·같은 출발일**로 스크린·URL을 비교한다.  
**자동 검증(결정론):** `npm run verify:hanatour-atp207` — Gemini 없이 항공 TW0669/TW0670·가격·쇼핑 시그널.

---

## 1. 기준 상품 (SSOT)

| 항목 | 값 |
|------|-----|
| 공급사 키 | `hanatour` |
| 상품코드 | `ATP207260601TWJ` |
| 공급사 URL | https://www.hanatour.com/trp/pkg/CHPC0PKG0200M200?pkgCd=ATP207260601TWJ&prePage=major-products |
| 발췌 fixture | `scripts/fixtures/hanatour-atp207260601twj.fixture.ts` |

**공개 URL (슬러그):** DB `Product.slug` 확인 후 기록.

```text
# 로컬
http://localhost:3000/products/{slug 또는 id}

# 운영 (등록 후 기입)
https://bongtour.com/products/{slug}
```

---

## 2. 관리자 — 등록 미리보기 1건

| 항목 | 내용 |
|------|------|
| 경로 | `/admin/register` |
| API | `POST /api/travel/parse-and-register-hanatour` (handler → orchestration) |
| 브랜드 | 하나투어 (`brandKey: hanatour`) |

### 캡처·기록 체크리스트

붙여넣기(ATP207 본문 + 항공·옵션·쇼핑 칸) 후 **미리보기(confirm 전)**.

| # | 확인 항목 | 기대 |
|---|-----------|------|
| A1 | 상품코드 `ATP207260601TWJ`·제목·3박 4일 | 본문과 일치 |
| A2 | 항공 | **항공 입력란** 또는 `출발 :` / `도착 :` 줄 — LLM만으로 채우지 않음 |
| A3 | 가격표·출발일 | 본문 표 + 확정/E2E SSOT (LLM `prices[]` 아님) |
| A4 | 일정 day·imageKeyword | 본문 일차 헤더; 허브일 공항 키워드 없음 |
| A5 | 선택관광·쇼핑 | 전용 칸 paste; **쇼핑 횟수**는 헤더 「쇼핑없음」/「N회」(표 행 수 ≠ 횟수) |
| A6 | 미팅·출발확정 | 본문 근거 없는 `출발확정` 과다 표시 없음 |

**스크린 보관 (권장):**

```text
docs/ops/screenshots/hanatour-admin-preview-ATP207260601TWJ-YYYYMMDD.png
```

| 필드 | 값 (운영자 기입) |
|------|------------------|
| Last verified | |
| Commit / branch | |
| Notes | |

---

## 3. 공개 상세 1건

| 항목 | 내용 |
|------|------|
| 컴포넌트 | `TravelProductDetail` / `MobileProductDetail` + `ItineraryViewPackageMain` |
| 조립 | `app/products/[idOrSlug]/product-detail-view.tsx` |

### 캡처·기록 체크리스트

**출발일 2개 이상** 바꿔 보며 히어로·일정이 **함께** 움직이는지 확인.

| # | 영역 | 기대 |
|---|------|------|
| P1 | 히어로 우측 — 가는편·오는편 | `formatFlightLegTwoLines(calendarAlignedDepartureFacts)` |
| P2 | 출발·귀국 날짜 | 달력 선택일·박일 |
| P3 | 일정 하단 항공 | 히어로와 동일 일시 (고정 템플릿 잔존 없음) |
| P4 | 선택관광 표 | 행명·USD 요금 표시 |
| P5 | 출발일 변경 | P1·P3 동시 갱신 |

**스크린 보관 (권장):**

```text
docs/ops/screenshots/hanatour-public-detail-ATP207-departure-A-YYYYMMDD.png
docs/ops/screenshots/hanatour-public-detail-ATP207-departure-B-YYYYMMDD.png
```

| 필드 | 값 (운영자 기입) |
|------|------------------|
| Public URL | |
| Departure A / B | 예: 2026-06-01 / 다른 가용일 |
| Last verified | |
| Notes | |

---

## 4. PR 전 명령 (코드 회귀)

```bash
npm run verify:hanatour-atp207
npm run verify:hanatour-lib
npm run audit:hanatour-lib
npm run verify:manual-flight-hanatour
```

---

## 5. 관련 문서

- 본문 파서: `docs/body-parser-hanatour-ssot.md`
- 항공·가격·LLM: `docs/ops/hanatour-parse-contract.md`
- 쇼핑 횟수 규칙: `docs/ops/supplier-shopping-visit-count.md`
- lib 인벤토리: `docs/ops/hanatour-lib-inventory.md`
