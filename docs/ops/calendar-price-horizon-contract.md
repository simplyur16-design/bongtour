# 달력·출발일 가격 6개월(180일) 지평선 계약

**SSOT:** `lib/calendar-price-horizon.ts` · `lib/calendar-batch-seq-state.ts` (`CALENDAR_BATCH_HORIZON_DAYS = 180`)

## 원칙

1. **미래 출발일·가격이 있는 등록 상품**은 KST 오늘부터 **180일(inclusive)** 구간을 수집·검증 대상으로 한다.
2. **공급사별 수집 방식은 다를 수 있으나**, 지평선 일수는 위 SSOT만 따른다 (3개월·2개월 하드코딩 금지).
3. **순차 배치(30일 창)** 실패 시 cursor를 전진시키지 않는다 — 빈 창을 “완료”로 오인하지 않는다.

## 공급사별 수집 경로 (오염 방지)

| 공급사 | 운영 배치(3h cron) | 관리자 재수집·on-demand | 비고 |
|--------|-------------------|-------------------------|------|
| **modetour** | B2C API `GetOtherDepartureDates` (Node API 경유) | 동일 API (`collectModetourDepartureInputs`) | **Python E2E 배치 사용 금지** — 폴백만 E2E |
| **hanatour** | Node `calendar-scrape-horizon` — gw API 우선, 0건 시 E2E | E2E / 월 분할 | **Python E2E 배치 직접 호출 금지** |
| **ybtour** | Node `calendar-scrape-horizon` — by-goods API 우선, 0건 시 E2E | E2E | 동일 |
| **verygoodtour** | Node `calendar-scrape-horizon` — HXR 우선, 0건 시 E2E | E2E | 동일 |
| **lottetour** | Node `calendar-scrape-horizon` — evtListAjax HXR 우선, 0건 시 E2E | 동일 | 동일 |
| **kyowontour** | Node `calendar-scrape-horizon` — AJAX 우선, 0건 시 E2E | 동일 | 동일 |

**modetour 일 1회 sweep** (`lib/modetour-sweep.ts`, KST 04:00): B2C API `GetOtherDepartureDates` 우선. **SD1 또는 지평 내 성인가 0건**이면 Python E2E(6개월)로 재확인 — stale DB 미래출발 방치 금지. 수집 성공 시 `rawMeta.modetourNextPriceRecheckYmd` = KST 오늘 + 7일 후 재검증.

## 상수

- `CALENDAR_PRICE_HORIZON_DAYS` = 180
- `CALENDAR_PRICE_HORIZON_MONTHS_FORWARD` = 6 (브라우저 E2E 월 루프)
- `SCRAPE_DEFAULT_MONTHS_FORWARD` = 6 (`lib/scrape-date-bounds.ts` — API `monthsForward` 기본)

등록 확정만 예외: `MODETOUR_REGISTER_CONFIRM_MONTHS_FORWARD` = 4 (적재량 제한, 별도 계약).

## 회귀 얼림

- manifest id: `calendar-price-horizon-180d`
- manifest id: `calendar-batch-api-first` — 3h batch Node API→E2E (Python E2E 직접 금지)
- manifest id: `modetour-sweep-e2e-recheck` — sweep API→E2E·7일 재확인
- `npm run verify:calendar-price-horizon`
