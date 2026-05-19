# 하나투어 정리 — 남은 것 (2026-05)

P0·P1b·P2·P3 **코드 단계는 완료**. 아래만 잔여.

## 코드 (선택·우선순위)

| 항목 | 설명 | 상태 |
|------|------|------|
| 공개 항공 동기화 | `TravelProductDetail` / `MobileProductDetail`가 이미 `calendarAlignedDepartureFacts` → 일정표 SSOT 사용. **hanatour 전용 페이지가 아니라 공용 패키지 상세**면 modetour와 동일 경로. ATP207 등록 후 출발일 변경만 **운영 스모크** 권장 | ⬜ 운영 확인 |
| `parse-and-register-hanatour-schedule.ts` (~1948줄) | 일정 표현·draft — handler에서 분리된 덩어리. **통합은 별도 PR**(동작 회귀 큼) | 보류 |
| `register-schedule-extract-hanatour` vs modetour | ~509줄 거의 동일 — **공급사별 파일 유지**(규칙). 공통 레이어로 합치지 않음 | 의도적 유지 |

## 운영·문서

| 항목 | 설명 | 상태 |
|------|------|------|
| 회귀 스크린 | [`hanatour-regression-baseline.md`](./hanatour-regression-baseline.md) — ATP207 체크리스트·`docs/ops/screenshots/hanatour-*` 경로 | ✅ 문서 (캡처는 운영자) |
| `PARSING_MANUAL_HANATOUR.md` | SSOT 링크·짧은 체크리스트만 유지, 중복 본문 삭제 | ✅ |

## 삭제 완료 (이번 정리)

- `scripts/.tmp-paste-verify/` — 로컬 붙여넣기 검증 임시본
- `lib/register-gemini-timing-hanatour.ts` — import 0 (미연결 dead code)

## 감사

```bash
npm run audit:hanatour-lib    # zero-importer 0이면 ok
npm run verify:hanatour-lib
npm run verify:hanatour-atp207
```

## 다음 공급사

`ybtour` → `verygoodtour` (각자 P3·P1b·P2)
