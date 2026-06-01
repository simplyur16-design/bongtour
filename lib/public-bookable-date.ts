const PUBLIC_BOOKABLE_MIN_OFFSET_DAYS = 2
const SEOUL_TZ = 'Asia/Seoul'

/** Asia/Seoul 달력 YYYY-MM-DD — DB 트리거·derived SSOT와 동일 */
export function toSeoulYmd(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SEOUL_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

function seoulCalendarAddDays(baseDate: Date, dayOffset: number): string {
  const ymd = toSeoulYmd(baseDate)
  const anchor = new Date(`${ymd}T12:00:00+09:00`)
  anchor.setUTCDate(anchor.getUTCDate() + dayOffset)
  return toSeoulYmd(anchor)
}

/** 서울 자정 instant — Prisma `departureDate >=` 비교용 */
function seoulMidnightInstant(ymd: string): Date {
  return new Date(`${ymd}T00:00:00+09:00`)
}

export function getPublicBookableMinDate(baseDate: Date = new Date()): Date {
  const minYmd = seoulCalendarAddDays(baseDate, PUBLIC_BOOKABLE_MIN_OFFSET_DAYS)
  return seoulMidnightInstant(minYmd)
}

/** @deprecated 서버 로컬 TZ — 신규 코드는 `toSeoulYmd` 사용 */
export function toYmdLocal(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function getPublicBookableMinYmd(baseDate: Date = new Date()): string {
  return toSeoulYmd(getPublicBookableMinDate(baseDate))
}

export function isOnOrAfterPublicBookableMinDate(
  dateLike: Date | string | null | undefined,
  baseDate: Date = new Date()
): boolean {
  if (!dateLike) return false
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike)
  if (Number.isNaN(d.getTime())) return false
  const lhs = toSeoulYmd(d)
  const rhs = getPublicBookableMinYmd(baseDate)
  return lhs >= rhs
}

/** Prisma Date 또는 unstable_cache JSON 직렬화 ISO string → YYYY-MM-DD */
export function toDepartureDateYmd(dateLike: Date | string | null | undefined): string {
  if (!dateLike) return ''
  if (typeof dateLike === 'string') return dateLike.slice(0, 10)
  if (dateLike instanceof Date) {
    if (Number.isNaN(dateLike.getTime())) return ''
    return toSeoulYmd(dateLike)
  }
  return ''
}
