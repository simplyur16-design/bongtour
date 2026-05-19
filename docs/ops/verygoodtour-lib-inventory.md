# verygoodtour lib 인벤토리 (P1b·P2·P3)

**E2E:** `scripts/calendar_e2e_scraper_verygoodtour/` — 별도 지시 없으면 무터치.

| 단계 | 상태 | 메모 |
|------|------|------|
| P3 | ✅ | `register-admin-core-verygoodtour` · handler digest 중복 제거 |
| P1b | ✅ | LLM trim · `requireDirectedFlightLineResolver` |
| P2 | ✅ | `verygoodtour-parse-contract.md` · flight-parser P2 주석 |

## 허브

- `parse-and-register-verygoodtour-handler.ts` (orchestration 통합)
- `register-parse-verygoodtour.ts` · `register-from-llm-verygoodtour.ts`
- `register-input-parse-verygoodtour.ts` · `detail-body-parser-verygoodtour.ts`
- `public-consumption-verygoodtour.ts`

## verify (E2E 아님)

```bash
npm run verify:verygoodtour-lib
```
