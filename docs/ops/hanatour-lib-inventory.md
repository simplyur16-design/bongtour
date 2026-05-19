# 하나투어 `lib/*hanatour*` 인벤토리 (정리 SSOT)

**갱신:** 2026-05 · **파일 수:** 58 (`lib/` 직하위 `*hanatour*` 패턴) · 잔여: `docs/ops/hanatour-remaining.md`

E2E(`scripts/calendar_e2e_scraper_*`)는 범위 밖.

---

## 진입점 (허브)

| 레이어 | 파일 | 줄(대략) | 역할 |
|--------|------|----------|------|
| HTTP | `parse-and-register-hanatour-handler.ts` | 27 | 얇은 래퍼 → orchestration |
| Flow | `parse-and-register-hanatour-orchestration.ts` | ~1700 | 등록 API·확정·geo |
| Parse | `register-parse-hanatour.ts` | 181 | 본문 파서 + LLM orchestration |
| LLM | `register-from-llm-hanatour.ts` | ~2400 | Gemini JSON 본체 (P1b trim 완료) |
| 스키마 | `register-llm-schema-hanatour.ts` | — | `RegisterParsed` 타입 |
| 공개 | `public-consumption-hanatour.ts` | 289 | 상세 탭·쇼핑·옵션 resolution |
| geo | `sync-product-geo-tags.ts` (공통) | orchestration에서 호출 |

문서: `docs/body-parser-hanatour-ssot.md`, `docs/ops/hanatour-parse-contract.md`, `docs/PARSING_MANUAL_HANATOUR.md`

---

## modetour 대비 구조 차이

| 항목 | modetour | hanatour |
|------|----------|----------|
| 등록 HTTP | handler 비대 → P3 후 digest SSOT | handler 얇음, **orchestration**에 흐름 집중 |
| LLM 본체 | ~2313줄 (P1b 완료) | ~2435줄 (P1b trim·COMPACT 제거) |
| schedule extract | 507줄 | 509줄 — 거의 동일 복사본, diff만 유지 |
| 항공 | `flight-modetour-parser` + directed | `flight-parser-hanatour` + `register-flight-hanatour` (**P2 계약** `hanatour-parse-contract.md`) |
| admin P3 | `register-admin-core-modetour` | `register-admin-core-hanatour` ✅ |

---

## 정리 체크리스트 (Phase 2)

| 단계 | 내용 | 상태 |
|------|------|------|
| P0 | 인벤토리·허브 문서 | ✅ 이 문서 |
| P3 | admin core + orchestration digest 중복 제거 | ✅ |
| P1b | `register-from-llm-hanatour` LLM 프롬프트 trim (항공·옵션·쇼핑 행·prices[] → pasted/E2E SSOT; **shoppingVisitCount는 LLM 유지**) | ✅ |
| P1b | `resolveDirectedFlightLines` 필수화 (default null 제거) | ✅ |
| P1b | `npm run verify:hanatour-atp207` (ATP207260601TWJ fixture) | ✅ |
| P2 | 항공 9파일 경계 주석 + `docs/ops/hanatour-parse-contract.md` | ✅ |
| 공개 | 출발일 변경 시 hero↔일정 — 공용 `TravelProductDetail` SSOT 적용됨, ATP207 **운영 스모크**만 | ⬜ 운영 |
| 잡파일 | `.tmp-paste-verify` · `register-gemini-timing-hanatour`(미연결) | ✅ 삭제 |
| audit | `npm run audit:hanatour-lib` | ✅ |
| verify | `npm run verify:hanatour-lib` | ✅ 스크립트 추가 |

---

## Flight (9) — P2 분층

| 파일 | 역할 |
|------|------|
| `flight-parser-hanatour.ts` | `출발 :` / `도착 :` leg SSOT |
| `register-input-parse-hanatour.ts` | `parseHanatourFlightInput` 진입 |
| `register-parse-hanatour.ts` | 항공칸 병합·resolver 주입 허브 |
| `register-flight-hanatour.ts` | directed segment 한 줄 |
| `flight-manual-correction-hanatour.ts` | FMC |
| `register-flight-evidence-supplier-hanatour.ts` | evidence |
| `hanatour-departure-flight-display.ts` | 출발확정·sanitize |
| `hanatour-flight-routing-meta.ts` | 직항/경유 칩 |
| `flight-preferred-legs-hanatour.ts` | 2줄 힌트 |

경계 표: `docs/ops/hanatour-parse-contract.md`

---

## Admin 스택 (P3)

`docs/ops/hanatour-admin-register-stack.md` · `lib/register-admin-core-hanatour.ts`

---

## 참고 verify

```bash
npm run audit:hanatour-lib
npm run verify:hanatour-lib
npm run verify:hanatour-atp207
npm run verify:manual-flight-hanatour
npm run verify:supplier-pipeline   # brand=hanatour 샘플
```
