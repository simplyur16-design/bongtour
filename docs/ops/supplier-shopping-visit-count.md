# 공급사별 쇼핑 방문 횟수 (shoppingVisitCount) SSOT

**운영·LLM 프롬프트·교정 시 반드시 구분.**

| 공급사 | shoppingVisitCount 출처 | shoppingStops[] 행 |
|--------|-------------------------|-------------------|
| `modetour` | **LLM** + 본문 시그널(「쇼핑 N회」) | pastedBlocks / 결정적 파서 (LLM 행 추출 금지) |
| `hanatour` | **LLM** + 본문 시그널(「쇼핑 N회」·「쇼핑없음」) | pastedBlocks / 결정적 파서 (LLM 행 추출 금지) |
| `ybtour` | **LLM 아님** — 표·시그널·`shoppingStops` **목록 개수와 동일 의미 아님** | 목록 SSOT; 횟수는 regex/헤더 시그널 우선 |
| `verygoodtour` | **LLM 아님** — ybtour와 동일 | 목록 SSOT; 횟수는 regex/헤더 시그널 우선 |

## ybtour · verygoodtour

- LLM 프롬프트에 `shoppingVisitCount`를 요구하지 않거나, 응답해도 **저장 SSOT로 쓰지 않음**.
- 공개·저장 횟수 = **쇼핑 목록(`shoppingStops`)에 들어간 행 수** 또는 본문 「N회」 정규 추출(코드 `signals.shoppingVisitCount`).

## modetour · hanatour

- P1b 이후 LLM은 **횟수·요약만** (`hasShopping`, `shoppingVisitCount`, `shoppingSummaryText`).
- 표 행은 `register-input-parse-*` / 붙여넣기 블록이 SSOT.
- 「쇼핑 3회」 칩과 표 3행이 다를 수 있음 — **횟수 ≠ 행 수** (하나투어 ATP207: 헤더 `쇼핑없음` + 참고용 표 3행).

## verify

```bash
npm run verify:modetour-avp603
npm run verify:hanatour-atp207
```
