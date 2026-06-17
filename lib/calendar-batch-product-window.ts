import { formatDepartureDateYmd } from '@/lib/calendar-batch-cursor'
import { CALENDAR_BATCH_CHUNK_DAYS } from '@/lib/calendar-batch-seq-state'

export type ProductBatchWindow = {
  cursorYmd: string | null
  rangeStartYmd: string
  rangeEndYmd: string
  atHorizon: boolean
  retired: boolean
  windowEmpty: boolean
}

export function addCalendarDaysYmd(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split('-').map((x) => parseInt(x, 10))
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  dt.setUTCDate(dt.getUTCDate() + delta)
  return dt.toISOString().slice(0, 10)
}

export function bootstrapCalendarBatchCursorYmd(params: {
  cursorYmd: string | null | undefined
  maxDepartureYmd: string | null
  todaySeoulYmd: string
}): string | null {
  const stored = params.cursorYmd?.trim() || null
  if (stored) return stored
  if (params.maxDepartureYmd) return params.maxDepartureYmd
  return addCalendarDaysYmd(params.todaySeoulYmd, -1)
}

export function computeProductBatchWindow(params: {
  cursorYmd: string | null | undefined
  retired: boolean
  maxDepartureYmd: string | null
  todaySeoulYmd: string
  horizonYmd: string
  hasFutureDepartures: boolean
}): ProductBatchWindow {
  if (params.retired) {
    return {
      cursorYmd: params.cursorYmd?.trim() || null,
      rangeStartYmd: params.todaySeoulYmd,
      rangeEndYmd: params.todaySeoulYmd,
      atHorizon: true,
      retired: true,
      windowEmpty: true,
    }
  }

  const cursorYmd = bootstrapCalendarBatchCursorYmd({
    cursorYmd: params.cursorYmd,
    maxDepartureYmd: params.maxDepartureYmd,
    todaySeoulYmd: params.todaySeoulYmd,
  })
  const rangeStartYmd = addCalendarDaysYmd(cursorYmd ?? addCalendarDaysYmd(params.todaySeoulYmd, -1), 1)
  const rawEndYmd = addCalendarDaysYmd(rangeStartYmd, CALENDAR_BATCH_CHUNK_DAYS - 1)
  const rangeEndYmd = rawEndYmd > params.horizonYmd ? params.horizonYmd : rawEndYmd
  const atHorizon = rangeStartYmd > params.horizonYmd
  const windowEmpty = atHorizon || rangeStartYmd > rangeEndYmd

  return {
    cursorYmd,
    rangeStartYmd,
    rangeEndYmd,
    atHorizon,
    retired: false,
    windowEmpty,
  }
}

export function rollingCursorYmdForHorizonReset(todaySeoulYmd: string): string {
  return addCalendarDaysYmd(todaySeoulYmd, -1)
}

export function maxDepartureYmdFromGroup(
  map: Map<string, Date>,
  productId: string
): string | null {
  const d = map.get(productId)
  return d ? formatDepartureDateYmd(d) : null
}
