# 하나투어(hanatour) 본문 해석 — 공급사 고정 계약

이 문서는 **하나투어 본문 구조**에 맞춘 파싱·병합만을 다룬다. 모두투어·노랑풍선·참좋은여행 등 타 공급사에 동일 규칙을 공통 적용하지 않는다.

**본문 줄 단위 섹션 분리(앵커·슬라이스):** `docs/body-parser-hanatour-ssot.md` — 등록 시 `DetailBodyParseSnapshot`을 만드는 1급 SSOT. 본 문서는 **항공 `출발 :` / `도착 :`·directed·출발확정·공개 leg**에 초점을 둔다.

## 항공

- **결정적 leg SSOT**: `lib/flight-parser-hanatour.ts` — `출발 :` → outbound, `도착 :` → inbound. 편명·소요시간·날짜(요일)시각 쌍 분리.
- **관리자 항공칸**: `[PASTED AIRLINE OR TRANSPORT INFO]` 있으면 **입력란만**으로 `flightStructured` 재구성 (`register-parse-hanatour` — 본문 캠페인 문구와 분리).
- **Directed 한 줄**: `resolveDirectedFlightLinesHanatour` (`register-flight-hanatour.ts`) — `register-from-llm-hanatour`에 **필수 주입** (`requireDirectedFlightLineResolver`). modetour `flight-modetour-parser` directed 계약을 **옮기지 않음**.
- **LLM**: P1b 이후 항공 필드·`prices[]`·`optionalTours[]`·`shoppingStops[]` 행 추출 **금지** — 정형칸·`flight-parser-hanatour`·E2E 달력 SSOT.
- **수동 교정**: `structuredSignals.flightManualCorrection` — `flight-manual-correction-hanatour.ts`. 공개 상세·모바일은 `originSource === 'hanatour'` 분기에서만 FMC 적용.
- **출발확정·좌석 문구**: `hanatour-departure-flight-display.ts` — 본문 근거 없는 `출발확정`·달력 status 오탐 차단.
- **직항/경유 칩**: `hanatour-flight-routing-meta.ts` — 핵심정보 `경유있음` 등; 기본 `직항` 추측 금지.

### 항공 파일 경계 (P2 — 통합 금지)

| 파일 | 책임 | 하지 않음 |
|------|------|-----------|
| `flight-parser-hanatour.ts` | `출발 :` / `도착 :` leg·`FlightStructured` | FMC, evidence, 달력·가격 |
| `register-input-parse-hanatour.ts` | `parseHanatourFlightInput` 진입(→ 위 파서) | LLM, directed 줄, 출발행 DB |
| `register-parse-hanatour.ts` | 본문·정형칸 병합 → LLM·`resolveDirectedFlightLinesHanatour` 주입 | leg 1차 파싱(파서 모듈), 공개 UI |
| `register-flight-hanatour.ts` | directed segment 한 줄(`formatDirectedFlightRow`) | 본문 파싱, ProductDeparture enrich |
| `flight-manual-correction-hanatour.ts` | FMC final/auto → key facts·leg | 자동 파싱 |
| `register-flight-evidence-supplier-hanatour.ts` | 미리보기 evidence 스니펫 | leg 구조화 |
| `hanatour-departure-flight-display.ts` | 출발확정·예약현황 sanitize | leg 파싱 |
| `hanatour-flight-routing-meta.ts` | 직항/경유 메타·칩 | leg·시각 |
| `flight-preferred-legs-hanatour.ts` | 출발/도착 **2줄 힌트**(한 줄에 출발·도착 붙은 경우 분리) | SSOT leg 대체 불가 |

등록 파이프라인에 modetour 전용 `register-modetour-flight.ts`에 대응하는 **별도 대형 파일 없음** — `register-parse-hanatour.ts`가 항공칸 병합·resolver 주입 허브.

## 가격

- **3슬롯 SSOT**: 성인 `adultPrice`, 아동 `childExtraBedPrice`, 유아 `infantPrice` (`childNoBedPrice` 미사용). `register-hanatour-price.ts` · `HANATOUR_PRICE_SLOT_SSOT_NOTE` in `register-parse-hanatour.ts`.
- **라벨 표 추출**: 공용 `extractProductPriceTableByLabels` — 하나투어 붙여넣기 표·본문 표.
- **출발일별 달력 행**: LLM·미리보기 JSON 아님 — 확정/E2E·`upsert-product-departures-hanatour` SSOT.

## 쇼핑

- **방문 횟수**: LLM `shoppingVisitCount` + 본문 「쇼핑 N회」/「쇼핑없음」(표 행 수와 **동일 의미 아님**). ybtour/verygoodtour 규칙과 다름 → `docs/ops/supplier-shopping-visit-count.md`.

## 공통으로 유지되는 것

- `ProductDeparture` / `ProductPriceRow` / `rawMeta.structuredSignals` 저장·소비 형태.
- geo: `syncProductGeoTags` (orchestration).

## 타 공급사

별도 본문 규칙·분기로 추가한다. 하나투어 계약을 공통 레이어·modetour 파서에 합치지 않는다.

## 운영 SSOT

- 인벤토리: `docs/ops/hanatour-lib-inventory.md`
- 관리자 스택: `docs/ops/hanatour-admin-register-stack.md`
- 회귀 fixture: `npm run verify:hanatour-atp207` (ATP207260601TWJ · TW0669/TW0670)
