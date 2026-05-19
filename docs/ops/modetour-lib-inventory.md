# 모두투어 `lib/*modetour*` 인벤토리 (정리 SSOT)

**갱신:** 2026-05 · **파일 수:** 57 (`flight-preferred-legs-modetour` 제거 → `flight-preferred-legs-kr-out-in` 공용)

E2E(`scripts/calendar_e2e_scraper_*`)는 범위 밖.

---

## 명명 4패턴 (의도)

| 패턴 | 개수 | 용도 | 예 |
|------|------|------|-----|
| `modetour-*` | 9 | 수집·표시·본문 유틸 | `modetour-departures.ts`, `modetour-product-public-display.ts` |
| `register-modetour-*` | 7 | 등록 파이프라인 단계 | `register-modetour-price.ts`, `register-modetour-flight.ts` |
| `*-modetour` | 38 | 공용 개념의 공급사 분기 | `register-from-llm-modetour.ts`, `flight-parser-modetour.ts` |
| 변칙 | 3 | handler·extras | `parse-and-register-modetour-handler.ts` |

**신규 파일 규칙:** 위 네 가지 중 하나에 맞출 것. 한국어 `출발/도착` 줄 패턴처럼 **타 공급사 공유**면 `flight-preferred-legs-kr-out-in.ts`처럼 **중립 이름** (`lib/flight-preferred-legs-kr-out-in.ts`).

---

## 진입점 (허브) — 여기서만 import 시작

| 레이어 | 파일 | 역할 |
|--------|------|------|
| HTTP | `parse-and-register-modetour-handler.ts` | 등록 API·확정 저장 |
| Parse | `register-parse-modetour.ts` | 본문 파서 + LLM 호출 orchestration |
| LLM | `register-from-llm-modetour.ts` | Gemini JSON 본체 |
| 스키마 | `register-llm-schema-modetour.ts` | `RegisterParsed` 타입 |
| 공개 | `public-consumption-modetour.ts` | 상세 탭·쇼핑·옵션 resolution |
| geo | `sync-product-geo-tags.ts` (공통) | handler에서만 호출 |

문서: `docs/ops/modetour-parse-contract.md`, `docs/body-parser-modetour-ssot.md`

---

## 책임 그룹 (다중 파일 — 통합 후보는 ⚠ 표시)

### Flight (6) — **의도적 분층, 당장 통합 안 함**

| 파일 | 줄 | 역할 |
|------|-----|------|
| `flight-modetour-parser.ts` | ~583 | 결정적 출발/도착 줄 파싱 SSOT |
| `flight-parser-modetour.ts` | ~163 | 관리자 붙여넣기 → `FlightStructured` |
| `register-modetour-flight.ts` | ~250 | flightRaw 확장·directed·등록 병합 |
| `flight-manual-correction-modetour.ts` | ~325 | 수동 교정 |
| `register-flight-evidence-supplier-modetour.ts` | ~329 | 증거·검증 메타 |
| `flight-preferred-legs-kr-out-in.ts` | ~25 | **공용** 출발/도착 한 줄 (구 `flight-preferred-legs-modetour`) |

### Shopping (3)

| 파일 | 역할 |
|------|------|
| `register-modetour-shopping.ts` | 등록 sanitize·구조화 |
| `modetour-shopping-table-display.ts` | 공개 표 |
| `register-input-unstructured-body-modetour.ts` | 비정형 본문 휴리스틱 |

### Optional (3)

| `register-modetour-options.ts` | paste·표 |
| `optional-tour-row-gate-modetour.ts` | 행 게이트 |
| `modetour-optional-tour-name.ts` | 표시명 |

### Schedule / itinerary (5 + 3)

| `register-schedule-extract-modetour.ts` | 2-pass 일정 LLM |
| `register-modetour-pasted-schedule.ts` | 본문 일정 보강 |
| `modetour-itinerary-schedule-overlay.ts` | 오버레이 |
| `modetour-schedule-image-keyword.ts` | imageKeyword |
| `modetour-itinerary-collector.ts` | collector 입력 |
| `upsert-itinerary-days-modetour.ts` | DB 일정 |
| `upsert-product-departures-modetour.ts` | 출발일 |
| `modetour-departures.ts` | 달력·프로모 HTML |

### Price (3)

| `register-modetour-price.ts` | finalize 가격 |
| `price-promotion-modetour.ts` | 프로모 스냅샷 |
| `product-departure-to-price-rows-modetour.ts` | 출발→가격 행 |

### Parse / body (4)

| `detail-body-parser-modetour.ts` | 섹션 슬라이스 SSOT |
| `detail-body-parser-utils-modetour.ts` | 앵커·유틸 |
| `register-input-parse-modetour.ts` | 항공·옵션·쇼핑 **입력** 진입 |
| `structured-tour-signals-modetour.ts` | 시그널 추출 |

### Admin (9 + 스택 문서)

| `register-admin-core-modetour.ts` | **P3** pastedBlocks·originUrl SSOT (digest·fingerprint·handler) |
| `register-admin-input-persist-modetour.ts` | 스냅샷 저장 |
| `register-admin-analysis-store-modetour.ts` | 분석 행 |
| `register-admin-confirm-reuse-modetour.ts` | confirm 재사용 |
| `register-admin-input-digest-modetour.ts` | digest |
| `register-admin-audit-status-modetour.ts` | 상태 상수 |
| `register-admin-retention-modetour.ts` | 보존 정책 |
| `register-preview-*-modetour.ts` (3) | 미리보기 SSOT·payload·fingerprint |
| `admin-register-verification-meta-modetour.ts` | 검증 메타 |
| `docs/ops/modetour-admin-register-stack.md` | 호출 그래프 |

### 기타 허브

| `register-llm-blocks-modetour.ts` | LLM 입력 블록 |
| `register-correction-*-modetour.ts` | 교정 |
| `review-policy-modetour.ts` | 검수 정책 |
| `extract-highlight-modetour.ts` / `llm-extract-highlight-modetour.ts` | 하이라이트 |
| `parse-and-register-modetour-extras.ts` | 히어로·달력 샘플 분기 |

---

## 100줄 미만 stub (17 → 16) — **대부분 정당한 얇은 레이어**

삭제 금지(참조 있음): `register-input-parse-modetour`, `parse-and-register-modetour-extras`, `register-modetour-meal-from-description`, `modetour-optional-tour-name`, admin digest/audit/reuse/retention, `modetour-itinerary-collector`, `must-know-trip-readiness-pipe-modetour`, `departure-option-modetour`, `hotel-table-parser-modetour`(generic re-export), `modetour-shopping-table-display`.

---

## legacy / @deprecated

| 위치 | 내용 | 조치 |
|------|------|------|
| `register-preview-ssot-modetour.ts` | `currentSellingPrice` @deprecated | handler는 `selectedDeparturePrice`만 사용 — 타입 필드는 하위 호환 유지 |
| `public-consumption-modetour.ts` | legacy canonical 경로 | **의도** (데이터 소스 폴백) |
| `register-correction-types-modetour.ts` | legacy overlay JSON | **의도** (구형 교정 호환) |

---

## 기준 상품 (P1 회귀)

| 항목 | 값 |
|------|-----|
| URL | https://www.modetour.com/package/99604825 |
| 상품코드 | `AVP603TWA1` |
| 단체번호 | `99604825` |
| 검증 | `npm run verify:modetour-avp603` (항공 TW013/014·성인 549000·쇼핑 3회·선택관광 있음) |

## P1 잔여 (운영)

- [x] 회귀 기준 URL·스크린 체크리스트 — `docs/ops/modetour-regression-baseline.md` (스크린은 `docs/ops/screenshots/`에 날짜별 저장)
- [x] 전용 플래그 목록 — `docs/ops/modetour-only-flags.md`

## 정리 Phase (모두투어)

- [x] **P0** 인벤토리·허브 문서 (본 파일)
- [x] **P0** 크로스 공급사 오염: `flight-preferred-legs-modetour` → `flight-preferred-legs-kr-out-in`
- [x] **P1a** `register-from-llm-modetour` import 블록 정리 + `resolveDirectedFlightLines` null 폴백 제거
- [x] **P1a** AVP603TWA1 결정론 fixture·verify 스크립트
- [x] **P1b** `register-from-llm-modetour.ts` dead branch·중복 프롬프트 블록 제거 (항공·옵션·쇼핑·prices LLM 추출 제거, resolver 필수화, imageKeyword SSOT)
- [x] **P2** flight 6파일 경계 주석 + `modetour-parse-contract.md` 경계 표 (통합 X)
- [x] **P3** admin 스택 — `register-admin-core-modetour.ts` + `modetour-admin-register-stack.md`, handler digest/pastedBlocks 중복 제거

검증:

```bash
npx tsx scripts/verify-modetour-lib-ssot.ts
npx tsx scripts/audit-modetour-lib-inventory.ts
npm run verify:mega-menu-browse
```

---

## 다음 공급사

`hanatour` 점검 시 본 표를 복사해 diff — **모두투어 화면·`RegisterParsed` shape**를 기준선으로 맞춘다 (`docs/ops/supplier-llm-parser-remediation.md`).
