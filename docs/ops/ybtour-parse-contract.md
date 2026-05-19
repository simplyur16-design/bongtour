# 노랑풍선(ybtour) 본문·등록 해석 — 공급사 고정 계약

타 공급사(특히 modetour·hanatour) 규칙을 **공통 적용하지 않는다.**

**본문 섹션 분리:** `docs/body-parser-ybtour-ssot.md`  
**항공·옵션·쇼핑 구조화:** `register-input-parse-ybtour` + 정형 `pastedBlocks` (본문 파서 비책임)

## 항공

- **결정적 leg SSOT**: `lib/flight-parser-ybtour.ts` — `출발`/`도착` 블록·편명·공항·일시 (`flight-ybtour-blocks.ts`).
- **관리자 항공칸**: `[PASTED AIRLINE OR TRANSPORT INFO]` → `register-parse-ybtour`가 입력란만으로 `flightStructured` 재구성.
- **Directed 한 줄**: `resolveDirectedFlightLinesYbtour` (`register-flight-ybtour.ts`) — `register-from-llm-ybtour`에 **필수 주입** (`requireDirectedFlightLineResolver`).
- **LLM (P1b)**: 항공 leg·`prices[]`·`optionalTours[]`·`shoppingStops[]` 행 추출 **금지**.

### 항공 파일 경계 (P2 — 통합 금지)

| 파일 | 책임 | 하지 않음 |
|------|------|-----------|
| `flight-parser-ybtour.ts` | 출발/도착 leg·`FlightStructured` | FMC, 달력·가격 |
| `flight-ybtour-blocks.ts` | 블록 분리·본문 일정표 항공 시드 | directed 줄, DB |
| `register-input-parse-ybtour.ts` | `parseYbtourFlightInput` 진입 | LLM, directed |
| `register-flight-ybtour.ts` | directed segment 한 줄 | leg 1차 파싱 |
| `register-parse-ybtour.ts` | 병합·resolver 주입·LLM 호출 | 공개 UI |
| `flight-manual-correction-ybtour.ts` | FMC | 자동 파싱 |
| `register-flight-evidence-supplier-ybtour.ts` | 미리보기 evidence | leg SSOT |
| `flight-preferred-legs-ybtour.ts` | 2줄 힌트 분리 | leg 대체 불가 |

## 쇼핑

- **방문 횟수**: LLM `shoppingVisitCount` **저장 SSOT 아님** — `docs/ops/supplier-shopping-visit-count.md`.

## 운영

- 인벤토리: `docs/ops/ybtour-lib-inventory.md`
- 입력 파싱 스모크: `npx tsx scripts/verify-ybtour-cip1292-input-parse.ts`
