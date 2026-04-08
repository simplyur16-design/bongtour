const PUBLIC_BOOKABLE_MIN_OFFSET_DAYS = 2

function startOfDayLocal(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function getPublicBookableMinDate(baseDate: Date = new Date()): Date {
  const min = startOfDayLocal(baseDate)
  min.setDate(min.getDate() + PUBLIC_BOOKABLE_MIN_OFFSET_DAYS)
  return min
}

export function toYmdLocal(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function getPublicBookableMinYmd(baseDate: Date = new Date()): string {
  return toYmdLocal(getPublicBookableMinDate(baseDate))
}

export function isOnOrAfterPublicBookableMinDate(
  dateLike: Date | string | null | undefined,
  baseDate: Date = new Date()
): boolean {
  if (!dateLike) return false
  const d = dateLike instanceof Date ? new Date(dateLike) : new Date(dateLike)
  if (Number.isNaN(d.getTime())) return false
  const lhs = startOfDayLocal(d).getTime()
  const rhs = getPublicBookableMinDate(baseDate).getTime()
  return lhs >= rhs
}
