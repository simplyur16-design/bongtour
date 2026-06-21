# 달력·출발일 가격 6개월(180일) 지평선 계약

**SSOT:** `lib/calendar-price-horizon.ts` · `lib/calendar-batch-seq-state.ts` (`CALENDAR_BATCH_HORIZON_DAYS = 180`)

## 원칙

1. **미래 출발일·가격이 있는 등록 상품**은 KST 오늘부터 **180일(inclusive)** 구간을 수집·검증 대상으로 한다.
2. **공급사별 수집 방식은 다를 수 있으나**, 지평선 일수는 위 SSOT만 따른다 (3개월·2개월 하드코딩 금지).
3. **API/HXR 출발·가격 수집 SSOT = 공급사별 일 1회 sweep** (성공 시 `*NextPriceRecheckYmd` = KST +7일). API가 정상이면 **3시간마다 재수집하지 않는다.**
4. **3h sequential batch(calendar cron) — 기본 비활성.** `ENABLE_INSTRUMENTATION_CALENDAR_CRON=1` 일 때만 opt-in (복구·테스트). E2E는 sweep에서만 API 0건 시.
5. **순차 배치(30일 창)** 가 켜져 있을 때 실패하면 cursor를 전진시키지 않는다 — 빈 창을 “완료”로 오인하지 않는다.

## 공급사별 수집 경로 (오염 방지)

| 공급사 | 운영 (SSOT) | 3h batch (기본 OFF) | 관리자 on-demand |
|--------|-------------|---------------------|------------------|
| **modetour** | 04:00 sweep — B2C API·SD1/0건 시 E2E | `ENABLE=1` 시 API only | 동일 API |
| **hanatour** | 05:00 sweep — gw API·0건 시 E2E | opt-in 시 API only | E2E / 월 분할 |
| **ybtour** | 06:00 sweep — by-goods API·0건 시 E2E | opt-in 시 API only | E2E |
| **verygoodtour** | 07:30 sweep — HXR·0건 시 E2E | opt-in 시 HXR only | E2E |
| **lottetour** | 07:00 sweep — HXR·0건 시 E2E | opt-in 시 HXR only | 동일 |
| **kyowontour** | 08:30 sweep — AJAX·0건 시 E2E | opt-in 시 AJAX only | 동일 |

**Python E2E 배치 직접 호출 금지.** Node `calendar-scrape-horizon` / `calendar-scrape-modetour-api`는 sweep·관리자·opt-in 3h batch 전용.

## 상수

- `CALENDAR_PRICE_HORIZON_DAYS` = 180
- `CALENDAR_PRICE_HORIZON_MONTHS_FORWARD` = 6 (브라우저 E2E 월 루프 — sweep·관리자 전용)
- `SCRAPE_DEFAULT_MONTHS_FORWARD` = 6 (`lib/scrape-date-bounds.ts` — API `monthsForward` 기본)

등록 확정만 예외: `MODETOUR_REGISTER_CONFIRM_MONTHS_FORWARD` = 4 (적재량 제한, 별도 계약).

## 회귀 얼림

- manifest id: `calendar-price-horizon-180d`
- manifest id: `calendar-batch-api-first` — opt-in 3h batch는 API/HXR only (E2E 금지)
- manifest id: `calendar-batch-retired-daily-sweep-ssot` — 3h cron 기본 OFF
- manifest id: `modetour-sweep-e2e-recheck` — sweep API→E2E·7일 재확인
- `npm run verify:calendar-price-horizon`
