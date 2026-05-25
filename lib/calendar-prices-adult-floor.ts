/** calendar-prices POST — 성인가 하한(원). 운영 DB 검증: 정상 출발일 최저 169,900원, 1~31원 더미만 차단 목적. */
export const CALENDAR_PRICES_MIN_ADULT_PRICE_KRW = 10_000

export type CalendarPricesItemLike = {
  date?: string
  price?: number | null
  adultPrice?: number | null
}

export type CalendarPricesRejectReason = 'missing_date' | 'invalid_price' | 'below_min_price'

export function resolveCalendarPricesAdultKrw(
  item: Pick<CalendarPricesItemLike, 'price' | 'adultPrice'>
): number | null {
  const raw = item.adultPrice ?? item.price
  if (raw == null) return null
  const p = Number(raw)
  if (!Number.isFinite(p)) return null
  return Math.round(p)
}

export function calendarPricesRejectReason(
  item: CalendarPricesItemLike,
  adultKrw: number | null
): CalendarPricesRejectReason | null {
  const d = item.date?.trim()
  if (!d) return 'missing_date'
  if (adultKrw == null) return 'invalid_price'
  if (adultKrw < CALENDAR_PRICES_MIN_ADULT_PRICE_KRW) return 'below_min_price'
  return null
}
