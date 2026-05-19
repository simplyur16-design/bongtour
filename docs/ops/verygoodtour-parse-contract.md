# 참좋은여행(verygoodtour) 본문·등록 해석 — 공급사 고정 계약

타 공급사 규칙을 **공통 적용하지 않는다.**

**본문 섹션 분리:** `docs/body-parser-verygoodtour-ssot.md`  
**항공·옵션·쇼핑:** `register-input-parse-verygoodtour` + `pastedBlocks`

## 항공

- **결정적 leg SSOT**: `lib/flight-parser-verygoodtour.ts` — `출국`/`입국`·편명·일시.
- **관리자 항공칸**: pasted airline → `register-parse-verygoodtour`.
- **Directed**: `resolveDirectedFlightLinesVerygoodtour` — LLM에 **필수** (`requireDirectedFlightLineResolver`).
- **LLM (P1b)**: 항공 leg·`prices[]`·`optionalTours[]`·`shoppingStops[]` 행 추출 **금지**.

### 항공 파일 경계 (P2 — 통합 금지)

| 파일 | 책임 | 하지 않음 |
|------|------|-----------|
| `flight-parser-verygoodtour.ts` | leg·`FlightStructured` | FMC, 달력 |
| `register-input-parse-verygoodtour.ts` | 항공·옵션·쇼핑 입력 진입 | LLM |
| `register-flight-verygoodtour.ts` | directed 한 줄 | leg 파싱 |
| `register-parse-verygoodtour.ts` | 병합·resolver·LLM | 공개 UI |
| `flight-verygoodtour-pipe-leg.ts` | leg 파이프 보조 | SSOT 대체 |
| `flight-preferred-legs-verygoodtour-blocks.ts` | 힌트 분리 | leg 대체 |
| `flight-manual-correction-verygoodtour.ts` | FMC | 자동 파싱 |

## 쇼핑

- ybtour와 동일: `shoppingVisitCount` LLM 저장 SSOT 아님 — `docs/ops/supplier-shopping-visit-count.md`.

## 운영

- `docs/ops/verygoodtour-lib-inventory.md`
