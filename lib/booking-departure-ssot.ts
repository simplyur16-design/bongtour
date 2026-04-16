/**
 * 예약 요청·견적·카카오 상담 공통 — 출발일(YYYY-MM-DD)과 해당 일자 가격 행을 한 축으로 맞춘다.
 */
import type { ProductPriceRow } from '@/app/components/travel/TravelProductDetail'
import { isScheduleAdultBookable } from '@/lib/price-utils'

export function bookingDepartureDateKeyFromRowDate(d: string): string {
  return d.startsWith('20') && d.length >= 10 ? d.slice(0, 10) : d
}

/** `prices`에서 해당 일자의 첫 행(예약가능 여부와 무관). */
export function findPriceRowForDateKey(
  prices: ProductPriceRow[],
  dateKey: string | null | undefined
): ProductPriceRow | null {
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null
  return prices.find((p) => bookingDepartureDateKeyFromRowDate(p.date) === dateKey) ?? null
}

export type DepartureSlotAdvisory = '예약가능' | '상담필요' | '확인필요' | '수집중' | '일정없음'

export function advisoryForDepartureRow(row: ProductPriceRow | null, isCollecting: boolean): DepartureSlotAdvisory {
  if (isCollecting) return '수집중'
  if (!row) return '일정없음'
  if (isScheduleAdultBookable(row)) return '예약가능'
  const st = String(row.status ?? '').trim()
  if (st) return '상담필요'
  return '확인필요'
}

/**
 * 견적 카드용: 선택 일자에 맞는 행만 사용한다. 다른 날짜의 예약가능 행으로 폴백하지 않는다.
 */
export function quotePriceRowStrictForSelectedDate(
  prices: ProductPriceRow[],
  selectedDateKey: string | null | undefined,
  explicitRow: ProductPriceRow | null | undefined
): ProductPriceRow | null {
  if (explicitRow && selectedDateKey) {
    const ex = bookingDepartureDateKeyFromRowDate(explicitRow.date)
    if (ex === selectedDateKey) return explicitRow
  }
  return findPriceRowForDateKey(prices, selectedDateKey)
}

/** 상세 SSOT: 캘린더에서 고른 날짜 → 행 id → 없으면 기본 행 날짜. */
export function resolvePublicDetailDateKey(args: {
  calendarDateKey: string | null
  selectedDepartureRowId: string | null
  mergedPrices: ProductPriceRow[]
  defaultDepartureRow: ProductPriceRow | null
}): string | null {
  if (args.calendarDateKey && /^\d{4}-\d{2}-\d{2}$/.test(args.calendarDateKey)) {
    return args.calendarDateKey
  }
  if (args.selectedDepartureRowId) {
    const r = args.mergedPrices.find((p) => p.id === args.selectedDepartureRowId)
    if (r) return bookingDepartureDateKeyFromRowDate(r.date)
  }
  return args.defaultDepartureRow ? bookingDepartureDateKeyFromRowDate(args.defaultDepartureRow.date) : null
}

/**
 * 선택 `dateKey`에 맞는 가격 행(없으면 null). 다른 날짜의 기본 행으로 채우지 않는다.
 */
export function resolvePublicDetailPriceRowForDateKey(args: {
  mergedPrices: ProductPriceRow[]
  dateKey: string | null
  selectedDepartureRowId: string | null
}): ProductPriceRow | null {
  if (!args.dateKey) return null
  if (args.selectedDepartureRowId) {
    const byId = args.mergedPrices.find((p) => p.id === args.selectedDepartureRowId)
    if (byId && bookingDepartureDateKeyFromRowDate(byId.date) === args.dateKey) return byId
  }
  return findPriceRowForDateKey(args.mergedPrices, args.dateKey)
}
