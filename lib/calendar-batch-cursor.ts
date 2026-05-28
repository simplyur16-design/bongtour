/** Product.rawMeta — 달력 배치 상품별 커서·은퇴 (schema 변경 없음) */

export const CALENDAR_BATCH_CURSOR_KEY = 'calendarBatchCursorYmd'
export const CALENDAR_BATCH_RETIRED_KEY = 'calendarBatchRetired'

function parseRawMetaObject(rawMeta: string | null | undefined): Record<string, unknown> {
  if (!rawMeta?.trim()) return {}
  try {
    const parsed = JSON.parse(rawMeta) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

export function parseCalendarBatchCursorYmd(rawMeta: string | null | undefined): string | null {
  const v = parseRawMetaObject(rawMeta)[CALENDAR_BATCH_CURSOR_KEY]
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v
  return null
}

export function parseCalendarBatchRetired(rawMeta: string | null | undefined): boolean {
  const v = parseRawMetaObject(rawMeta)[CALENDAR_BATCH_RETIRED_KEY]
  return v === true || v === 'true' || v === 1 || v === '1'
}

export function mergeCalendarBatchCursorIntoRawMeta(
  rawMeta: string | null | undefined,
  cursorYmd: string | null
): string {
  const base = parseRawMetaObject(rawMeta)
  if (cursorYmd == null) {
    delete base[CALENDAR_BATCH_CURSOR_KEY]
  } else {
    base[CALENDAR_BATCH_CURSOR_KEY] = cursorYmd
  }
  return JSON.stringify(base)
}

export function mergeCalendarBatchRetiredIntoRawMeta(
  rawMeta: string | null | undefined,
  retired: boolean
): string {
  const base = parseRawMetaObject(rawMeta)
  if (retired) {
    base[CALENDAR_BATCH_RETIRED_KEY] = true
  } else {
    delete base[CALENDAR_BATCH_RETIRED_KEY]
  }
  return JSON.stringify(base)
}

export function mergeCalendarBatchHorizonRollingIntoRawMeta(
  rawMeta: string | null | undefined,
  rollingCursorYmd: string
): string {
  let next = mergeCalendarBatchRetiredIntoRawMeta(rawMeta, false)
  next = mergeCalendarBatchCursorIntoRawMeta(next, rollingCursorYmd)
  return next
}

export function formatDepartureDateYmd(d: Date): string {
  return d.toISOString().slice(0, 10)
}
