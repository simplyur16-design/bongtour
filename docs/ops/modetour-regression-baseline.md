# 모두투어 회귀 기준 (P1 잔여 — 화면·URL)

**목적:** P1b 이후 등록·공개 상세 변경 시 **같은 상품·같은 출발일**로 스크린·URL을 비교한다.  
**자동 검증(결정론):** `npm run verify:modetour-avp603` — Gemini 없이 항공·가격·쇼핑·imageKeyword.

---

## 1. 기준 상품 (SSOT)

| 항목 | 값 |
|------|-----|
| 공급사 키 | `modetour` |
| 상품코드 | `AVP603TWA1` |
| 모두투어 단체번호 | `99604825` |
| 공급사 URL | https://www.modetour.com/package/99604825 |
| 발췌 fixture | `scripts/fixtures/modetour-avp603twa1.fixture.ts` |

**공개 URL (슬러그):** DB `Product.slug` 확인 후 기록.

```text
# 로컬
http://localhost:3000/products/{slug 또는 id}

# 운영 (예: 북유럽 회귀용 — slug는 DB 기준)
https://bongtour.com/products/pkg-mt-0054
```

> `pkg-mt-0054`는 일정·호텔 표시 회귀에 쓰인 사례. **항공·가격·옵션 결정론** 회귀는 AVP603 fixture + 아래 체크리스트를 우선한다.

---

## 2. 관리자 — 등록 미리보기 1건

| 항목 | 내용 |
|------|------|
| 경로 | `/admin/register` |
| API | `POST /api/travel/parse-and-register-modetour` |
| 브랜드 | 모두투어 (`brandKey: modetour`) |

### 캡처·기록 체크리스트

붙여넣기 후 **미리보기(confirm 전)** 화면에서 아래를 스크린샷 + 날짜 기록.

| # | 확인 항목 | 기대 |
|---|-----------|------|
| A1 | 상품코드·제목·박일 | 본문과 일치 |
| A2 | 항공 블록 | 전용 입력란 / 본문 `출발·도착` 줄 — LLM만으로 채우지 않음 |
| A3 | 가격표·출발일 그리드 | E2E/수동 붙여넣기 SSOT (LLM `prices[]` 아님) |
| A4 | 일정 day 수·imageKeyword | 허브일(출국/귀국) 키워드, 공항명 키워드 없음 |
| A5 | 옵션·쇼핑 표 | 전용 칸 paste; `[선택관광]`·`#` 표시명 정리 |

**스크린 보관 (권장 경로):**

```text
docs/ops/screenshots/modetour-admin-preview-AVP603TWA1-YYYYMMDD.png
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

**출발일을 2개 이상 바꿔 보며** 아래가 **함께** 움직이는지 확인.

| # | 영역 | 기대 |
|---|------|------|
| P1 | 히어로 우측 카드 — 가는편·오는편 | `formatFlightLegTwoLines(calendarAlignedDepartureFacts)` |
| P2 | 출발·귀국 날짜 줄 | 달력 선택일·박일 SSOT |
| P3 | 일정 하단 **항공편** | 히어로 카드와 동일 일시 (고정 템플릿으로 안 남음) |
| P4 | 현지옵션 표 | `normalizeModetourOptionalTourDisplayName` |
| P5 | 출발일 변경 | 위 P1·P3 동시 갱신 |

**스크린 보관 (권장 경로):**

```text
docs/ops/screenshots/modetour-public-detail-AVP603TWA1-departure-A-YYYYMMDD.png
docs/ops/screenshots/modetour-public-detail-AVP603TWA1-departure-B-YYYYMMDD.png
```

| 필드 | 값 (운영자 기입) |
|------|------------------|
| Public URL | |
| Departure A / B | |
| Last verified | |
| Notes | |

---

## 4. PR 전 명령 (코드 회귀)

```bash
npm run verify:modetour-avp603
npm run verify:modetour-lib
npx tsx scripts/verify-supplier-pipeline-alignment.ts   # modetour 행 포함 시
```

---

## 5. 관련 문서

- 전용 플래그 목록: `docs/ops/modetour-only-flags.md`
- 파싱 계약: `docs/ops/modetour-parse-contract.md`
- lib 인벤토리: `docs/ops/modetour-lib-inventory.md`
