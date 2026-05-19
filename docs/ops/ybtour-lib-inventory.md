# ybtour lib 인벤토리 (P1b·P2·P3)

**E2E:** `scripts/calendar_e2e_scraper_ybtour/` — 별도 지시 없으면 무터치.

| 단계 | 상태 | 메모 |
|------|------|------|
| P3 | ✅ | `register-admin-core-ybtour` · orchestration digest 중복 제거 |
| P1b | ✅ | LLM trim · `requireDirectedFlightLineResolver` |
| P2 | ✅ | `ybtour-parse-contract.md` · flight-parser P2 주석 |

## 허브

- `parse-and-register-ybtour-handler.ts` → `parse-and-register-ybtour-orchestration.ts`
- `register-parse-ybtour.ts` · `register-from-llm-ybtour.ts`
- `register-input-parse-ybtour.ts` · `detail-body-parser-ybtour.ts`
- `public-consumption-ybtour.ts`

## verify (E2E 아님)

```bash
npm run verify:ybtour-lib
npx tsx scripts/verify-ybtour-cip1292-input-parse.ts
```
