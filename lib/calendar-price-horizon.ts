/**
 * 달력·출발일 가격 수집 지평선 SSOT — 향후 6개월(180일).
 *
 * REGRESSION-FREEZE[calendar-price-horizon-180d]: 180일·6개월 하한 — manifest
 *
 * 계약: `docs/ops/calendar-price-horizon-contract.md`
 */
import { CALENDAR_BATCH_HORIZON_DAYS } from '@/lib/calendar-batch-seq-state'
import { addCalendarDaysToYmd, scrapeCalendarTodayYmd } from '@/lib/scrape-date-bounds'

/** KST 오늘 기준 inclusive 상한 일수 (배치 sequential·6개월 검증과 동일). */
export const CALENDAR_PRICE_HORIZON_DAYS = CALENDAR_BATCH_HORIZON_DAYS

/**
 * E2E 달력 월 루프 상한 — 180일(≈6개월) 커버.
 * 공급사별 env로 덮어쓸 수 있으나 기본·하한은 이 값.
 */
export const CALENDAR_PRICE_HORIZON_MONTHS_FORWARD = 6

export function calendarPriceHorizonEndYmd(todaySeoulYmd?: string): string {
  const today = (todaySeoulYmd ?? scrapeCalendarTodayYmd()).trim().slice(0, 10)
  return addCalendarDaysToYmd(today, CALENDAR_PRICE_HORIZON_DAYS)
}

/** inclusive `[from,to]` — API `searchFrom`/`searchTo`·배치 env 공통. */
export function calendarPriceHorizonDateRangeYmd(todaySeoulYmd?: string): {
  fromYmd: string
  toYmd: string
} {
  const fromYmd = (todaySeoulYmd ?? scrapeCalendarTodayYmd()).trim().slice(0, 10)
  return { fromYmd, toYmd: addCalendarDaysToYmd(fromYmd, CALENDAR_PRICE_HORIZON_DAYS) }
}
