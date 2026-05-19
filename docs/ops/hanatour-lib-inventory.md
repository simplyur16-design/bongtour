# 하나투어 `lib/*hanatour*` 인벤토리 (정리 SSOT)

**갱신:** 2026-05 · **파일 수:** 58 (`lib/` 직하위 `*hanatour*` 패턴)

E2E(`scripts/calendar_e2e_scraper_*`)는 범위 밖.

---

## 진입점 (허브)

| 레이어 | 파일 | 줄(대략) | 역할 |
|--------|------|----------|------|
| HTTP | `parse-and-register-hanatour-handler.ts` | 27 | 얇은 래퍼 → orchestration |
| Flow | `parse-and-register-hanatour-orchestration.ts` | ~1700 | 등록 API·확정·geo |
| Parse | `register-parse-hanatour.ts` | 181 | 본문 파서 + LLM orchestration |
| LLM | `register-from-llm-hanatour.ts` | ~2616 | Gemini JSON 본체 (**P1b 대상**) |
| 스키마 | `register-llm-schema-hanatour.ts` | — | `RegisterParsed` 타입 |
| 공개 | `public-consumption-hanatour.ts` | 289 | 상세 탭·쇼핑·옵션 resolution |
| geo | `sync-product-geo-tags.ts` (공통) | orchestration에서 호출 |

문서: `docs/body-parser-hanatour-ssot.md`, `docs/PARSING_MANUAL_HANATOUR.md`

---

## modetour 대비 구조 차이

| 항목 | modetour | hanatour |
|------|----------|----------|
| 등록 HTTP | handler 비대 → P3 후 digest SSOT | handler 얇음, **orchestration**에 흐름 집중 |
| LLM 본체 | ~2313줄 (P1b 완료) | ~2616줄 — COMPACT/풀 프롬프트·LLM 가격/옵션 추출 **잔존** |
| schedule extract | 507줄 | 509줄 — 거의 동일 복사본, diff만 유지 |
| 항공 | `flight-modetour-parser` + directed 계약 | `register-flight-hanatour`, `flight-parser-hanatour` (**별도**, 옮기지 말 것) |
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
| P2 | 항공 스택 경계 주석·계약 문서 (`hanatour-parse-contract` 검토) | ⬜ |
| 공개 | 출발일 변경 시 hero↔일정 항공 동기화 (modetour와 동일 버그 여부 점검) | ⬜ |
| verify | `npm run verify:hanatour-lib` | ✅ 스크립트 추가 |

---

## Admin 스택 (P3)

`docs/ops/hanatour-admin-register-stack.md` · `lib/register-admin-core-hanatour.ts`

---

## 참고 verify

```bash
npm run verify:hanatour-lib
npm run verify:manual-flight-hanatour
npm run verify:supplier-pipeline   # brand=hanatour 샘플
```
