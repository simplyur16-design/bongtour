# 노랑풍선 `collectYellowBalloonDepartureInputs` 구현 준비

**코드 위치**: `lib/ybtour/ybtour-adapter.ts`  
**관련**: [YELLOW-BALLOON-ADAPTER-DESIGN.md](./YELLOW-BALLOON-ADAPTER-DESIGN.md) (**구현 순서**), [ID 체크리스트](./YELLOW-BALLOON-ID-CHECKLIST.md), [F12 체크리스트](./YELLOW-BALLOON-F12-CHECKLIST.md)

---

## 1) 함수 단계별 의사코드

```
collectYellowBalloonDepartureInputs(originUrl, options):
  meta.notes ← 단계 로그용 배열

  // Phase 1 — 상세 진입
  // TODO: 브라우저 또는 fetch 로 상세 HTML·초기 XHR 확보 (스펙 미확정)

  // Phase 2 — 식별 후보 (Product 적재와 별도; 화면 번호 즉시 확정 금지)
  identifiers.originCodeSsoCandidate ← TODO: URL / script / XHR
  identifiers.supplierGroupIdCandidate ← TODO: 별도 검증
  // supplierDepartureCode 는 상품 단위가 아니라 행 단위 → Phase 5

  // Phase 3 — 출발일 팝업 오픈
  // TODO: 클릭 시퀀스 또는 API

  // Phase 4 — 월 이동 루프 (maxMonthsToScan 등)
  rows ← []
  for each month:
    // Phase 5 — 우측 리스트 row 수집 (정본)
    for each list row:
      r ← YellowBalloonRowParsed { source: 'list-row', departureDate, adultPrice, ... }
      rows.push(r)

  // Phase 6 — 좌측 달력 (선택, 검증만)
  // 날짜 존재·월 일치만 비교; 가격은 리스트와 다르면 meta.notes 에 기록, **최종 가격은 리스트**

  // Phase 7 — 변환·중복 제거
  inputs ← rows.filter(source=list-row).map(yellowBalloonRowParsedToDepartureInput)
  inputs ← dedupeDepartureInputsByDate(inputs, options.duplicateDateStrategy)

  // Phase 8 — meta (mappingStatus 는 DB 아님)
  meta.mappingStatus ← 수집 품질에 따라 list-row-primary 등 (합의 후)
  return { inputs, listRowRaws, meta, identifiers }
```

---

## 2) 타입·보조 함수 (제안, 이미 스캐폴딩에 포함)

| 이름 | 역할 |
|------|------|
| `YellowBalloonIdentifiersSnapshot` | `originCodeSsoCandidate`, `supplierGroupIdCandidate` — **collect 반환**으로 호출측이 Product에 반영 전 검증 |
| `YellowBalloonRowParsed` | 리스트 row 중간 모델. `source: list-row \| calendar-audit-only` |
| `YellowBalloonCollectOptions` | `signal`, `maxMonthsToScan`, `duplicateDateStrategy` |
| `YellowBalloonCollectResult` | `inputs` + `listRowRaws` + `meta` + `identifiers` |
| `buildYellowBalloonTraceLocalPriceText` | 추적 전용 문자열을 `localPriceText` 접두 `ybtour:trace:` 로만 구성 |
| `yellowBalloonRowParsedToDepartureInput` | `list-row` 만 `DepartureInput` 으로 |
| `dedupeDepartureInputsByDate` | 동일 YYYY-MM-DD 키 중복 제거 |
| `departureDateSortKey` | `normalizeDepartureDate` 기준 키 |

---

## 3) TODO 목록 (스펙 미확정)

- [ ] 상세 로드: Puppeteer/Playwright vs 서버 fetch, 쿠키·캡차
- [ ] `originCode` / `supplierGroupId` 추출 위치 (URL·스크립트·XHR)
- [ ] 팝업 오픈 트리거
- [ ] 월 이동 시 **같은** 대표 상품 키가 요청에 유지되는지
- [ ] 우측 리스트: DOM vs JSON, 가상 스크롤
- [ ] 행별 `supplierDepartureCode` 필드명
- [ ] `mappingStatus` 를 `list-row-primary` 로 올릴 판정 규칙
- [ ] `ItineraryDay` 수집은 **별 collector** — 본 함수 범위 밖

---

## 4) 중복 제거 규칙 (`dedupeDepartureInputsByDate`)

- **키**: `normalizeDepartureDate` → UTC 날짜 `YYYY-MM-DD` (캘린더 동일 일자).
- **같은 월 재수집 / 이전달·다음달 이동**으로 동일 날짜가 다시 들어오면, **한 키당 1건**만 남긴다.
- **전략** (`duplicateDateStrategy`):
  - `first-wins`: 먼저 수집된 행 유지 (리스트 순서 상단 우선).
  - `richer-wins` (기본): `adultPrice`·`statusRaw`·`seatsStatusRaw`·`minPax` 채움 점수가 높은 행 유지.
- **같은 departureDate가 여러 row에 노출** (UI 중복): 위 전략으로 1건으로 합친다.
- **ProductDeparture DB 유니크** `(productId, departureDate)` 와 정합되도록 배열을 정리한 뒤 `upsertProductDepartures` 호출.

---

## 5) originCode / supplierGroupId / supplierDepartureCode 반영 위치

| 식별 | 저장 위치 (원칙) |
|------|------------------|
| **originCode** (확정 후) | **Product** — `collect` 는 `identifiers.originCodeSsoCandidate` 만 제공, **자동 확정 아님** |
| **supplierGroupId** | **Product** — `identifiers.supplierGroupIdCandidate` |
| **supplierDepartureCode** | **행별** — `DepartureInput` 의 비즈니스 필드에 직접 넣지 않고, `buildYellowBalloonTraceLocalPriceText` 경유 **localPriceText 보조** 또는 **meta / listRowRaws** |

---

## 6) 달력 vs 리스트 불일치 시 우선순위

1. **우측 리스트** = 출발일·가격·상태·좌석·행 식별의 **정본**.
2. **좌측 달력** = 월 이동·**교차검증**·중복 의심 시 **메모** (`meta.notes`). 달력 셀 가격만으로 `ProductDeparture` 를 확정하지 않는다.

---

## 7) 위험 포인트

- 가상 스크롤로 **수집 누락** → 월 루프·스크롤 대기 필요.
- **GTM/분석** 응답을 출발 데이터로 오인 — [F12 체크리스트 G](./YELLOW-BALLOON-F12-CHECKLIST.md).
- **`localPriceText`** 에 추적 문자열을 길게 넣어 **MAX_RAW 초과** — `buildYellowBalloonTraceLocalPriceText` 길이 제한 유지.
- `identifiers` 후보를 **검증 없이** Product에 쓰면 **동기화 꼬임** — 운영 검수·ID 체크리스트 필수.

---

## 8) VERYGOODTOUR / MODETOUR 와 충돌 여부

- **파일 분리**: `lib/ybtour/*` 만 수정. `verygoodtour-departures.ts`, `modetour-departures.ts` **미변경**.
- **공통 계약**: `DepartureInput`/`normalizeDepartureDate` 만 사용 — **파싱 로직 공유 없음**.
- **Prisma**: `mappingStatus` DB 컬럼 추가 없음 — `YellowBalloonCollectMeta` 만 유지.

---

## 9) 금지 (재확인)

- 노랑풍선을 VERYGOODTOUR 식 fragment 파싱형으로 **단정**하지 않는다.
- 노랑풍선을 MODETOUR 식 단일 API형으로 **단정**하지 않는다.
- **하나투어** 구현 범위에 포함하지 않는다.
