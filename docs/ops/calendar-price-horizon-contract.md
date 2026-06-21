# 달력·출발일 가격 6개월(180일) 지평선 계약

**SSOT:** `lib/calendar-price-horizon.ts` · `lib/calendar-batch-seq-state.ts` (`CALENDAR_BATCH_HORIZON_DAYS = 180`)

## 원칙

1. **미래 출발일·가격이 있는 등록 상품**은 KST 오늘부터 **180일(inclusive)** 구간을 수집·검증 대상으로 한다.
2. **공급사별 수집 방식은 다를 수 있으나**, 지평선 일수는 위 SSOT만 따른다 (3개월·2개월 하드코딩 금지).
3. **순차 배치(30일 창)** 실패 시 cursor를 전진시키지 않는다 — 빈 창을 “완료”로 오인하지 않는다.
4. **E2E(브라우저)는 3h 배치에서 돌리지 않는다.** API/HXR 주기 검증은 **일 1회 sweep**(`*NextPriceRecheckYmd` = KST +7일)에서 API→E2E 폴백으로만 수행한다.

## 공급사별 수집 경로 (오염 방지)

| 공급사 | 운영 배치(3h cron) | 일 1회 sweep (KST, API→E2E) | 관리자 on-demand |
|--------|-------------------|------------------------------|------------------|
| **modetour** | B2C API only (`calendar-scrape-modetour-api`) | 04:00 — API·SD1/0건 시 E2E | 동일 API |
| **hanatour** | gw API only (`calendar-scrape-horizon`) | 05:00 — API·0건 시 E2E | E2E / 월 분할 |
| **ybtour** | by-goods API only | 06:00 — API·0건 시 E2E | E2E |
| **verygoodtour** | HXR only | 07:30 — HXR·0건 시 E2E | E2E |
| **lottetour** | evtListAjax HXR only | 07:00 — HXR·0건 시 E2E | 동일 |
| **kyowontour** | AJAX only | 08:30 — AJAX·0건 시 E2E | 동일 |

**Python E2E 배치 직접 호출 금지** — 3h cron은 Node API/HXR 경로만 (`calendar-scrape-horizon` / `calendar-scrape-modetour-api`).

## 상수

- `CALENDAR_PRICE_HORIZON_DAYS` = 180
- `CALENDAR_PRICE_HORIZON_MONTHS_FORWARD` = 6 (브라우저 E2E 월 루프 — sweep·관리자 전용)
- `SCRAPE_DEFAULT_MONTHS_FORWARD` = 6 (`lib/scrape-date-bounds.ts` — API `monthsForward` 기본)

등록 확정만 예외: `MODETOUR_REGISTER_CONFIRM_MONTHS_FORWARD` = 4 (적재량 제한, 별도 계약).

## 회귀 얼림

- manifest id: `calendar-price-horizon-180d`
- manifest id: `calendar-batch-api-first` — 3h batch API/HXR only, E2E 금지
- manifest id: `modetour-sweep-e2e-recheck` — sweep API→E2E·7일 재확인
- `npm run verify:calendar-price-horizon`
