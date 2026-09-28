/**
 * Apply Product.hotelSummaryRaw day plans onto schedule rows missing hotelText.
 * Also stamps return-day "숙박 없음" when summary says so.
 * REGRESSION-FREEZE[register-schedule-hotel-from-summary]: hotelSummaryRaw → day hotelText — manifest
 */
import { parseDayHotelPlansFromSupplierText } from '@/lib/day-hotel-plans-hanatour'

export function applyHotelSummaryRawToScheduleDays<
  T extends {
    day?: number | null
    hotelText?: string | null
    title?: string | null
    routeText?: string | null
    description?: string | null
  },
>(
  rows: T[],
  hotelSummaryRaw: string | null | undefined,
): T[] {
  if (!rows.length) return rows
  const blob = String(hotelSummaryRaw ?? '').trim()
  if (!blob) return rows
  const plans = parseDayHotelPlansFromSupplierText(blob)
  const byDay = new Map(plans.map((p) => [p.dayIndex, p]))
  const maxDay = Math.max(0, ...rows.map((r) => Number(r.day) || 0))

  return rows.map((row) => {
    const day = Number(row.day) || 0
    if (String(row.hotelText ?? '').trim()) return row
    const plan = byDay.get(day)
    if (plan?.hotels?.length) {
      const hotelText = plan.hotels.join(' / ').slice(0, 500)
      return { ...row, hotelText }
    }
    const hay = `${row.title ?? ''}\n${row.routeText ?? ''}\n${row.description ?? ''}`
    if (day === maxDay && maxDay >= 2 && /인천|ICN|김포|GMP|귀국|출국/.test(hay)) {
      return { ...row, hotelText: '숙박 없음(귀국)' }
    }
    if (/숙박\s*없음/.test(blob) && day === maxDay && maxDay >= 2) {
      return { ...row, hotelText: '숙박 없음(귀국)' }
    }
    return row
  })
}
