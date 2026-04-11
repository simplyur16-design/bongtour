/**
 * 출발일 수집 하한·기간 기본값.
 * 등록 상품은 대개 수 주~수 개월 후 출발이므로, 과거 일자는 제외하고 월 단위 탐색은 오늘(한국 달력) 이후부터 맞춘다.
 */
import type { DepartureInput } from '@/lib/upsert-product-departures-hanatour'
import { normalizeCalendarDate } from '@/lib/date-normalize'

/** 한국 달력 기준 오늘 YYYY-MM-DD */
export function scrapeCalendarTodayYmd(timeZone = 'Asia/Seoul'): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

/** `YYYY-MM-DD` 문자열에 그레고리력 일수만 가산(타임존 무관·순수 달력). */
export function addCalendarDaysToYmd(ymd: string, deltaDays: number): string {
  const [y0, m0, d0] = ymd.split('-').map(Number)
  const t = Date.UTC(y0, m0 - 1, d0 + deltaDays)
  const dt = new Date(t)
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

/**
 * 참좋은(verygoodtour) 출발·금액 수집 하한: KST **오늘 +3일** YYYY-MM-DD부터만 포함.
 * (예: 오늘이 4/11이면 4/12·4/13 제외, **4/14**부터 수집·대표 후보.)
 */
export function scrapeCalendarVerygoodDepartureFloorYmd(timeZone = 'Asia/Seoul'): string {
  return addCalendarDaysToYmd(scrapeCalendarTodayYmd(timeZone), 3)
}

/** 출발일 행 → YYYY-MM-DD (비교용) */
export function departureInputToYmd(v: DepartureInput['departureDate']): string | null {
  if (v == null) return null
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(v)
  }
  const s = String(v).trim()
  return normalizeCalendarDate(s) ?? (s.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null)
}

/** 오늘(한국) 이전 출발일 행 제거 */
export function filterDepartureInputsOnOrAfterCalendarToday(inputs: DepartureInput[]): DepartureInput[] {
  const floor = scrapeCalendarTodayYmd()
  return inputs.filter((inp) => {
    const ymd = departureInputToYmd(inp.departureDate)
    return ymd != null && ymd >= floor
  })
}

/** 달력 월 비교용 */
export type YearMonth = { year: number; month: number }

export function yearMonthFromYmd(ymd: string): YearMonth | null {
  const m = ymd.trim().match(/^(\d{4})-(\d{2})(?:-\d{2})?/)
  if (!m) return null
  return { year: Number(m[1]), month: Number(m[2]) }
}

export function scrapeTodayYearMonth(): YearMonth {
  const ym = yearMonthFromYmd(scrapeCalendarTodayYmd())
  if (!ym) return { year: new Date().getUTCFullYear(), month: new Date().getUTCMonth() + 1 }
  return ym
}

export function yearMonthBefore(a: YearMonth, b: YearMonth): boolean {
  return a.year < b.year || (a.year === b.year && a.month < b.month)
}

export function maxYearMonth(a: YearMonth, b: YearMonth): YearMonth {
  return yearMonthBefore(a, b) ? b : a
}

/** parse-and-register·재수집 등 공통: 앞으로 스캔할 월 수 (당일 출발 제외 전제) */
export const SCRAPE_DEFAULT_MONTHS_FORWARD = 6

/**
 * 모두투어 **등록 확정(confirm)** 시 `GetOtherDepartureDates` 검색 상한만큼의 월 수.
 * 재수집·어댑터 기본(6개월)과 구분해 ProductDeparture 적재량을 줄인다(동일 API, searchTo만 짧게).
 */
export const MODETOUR_REGISTER_CONFIRM_MONTHS_FORWARD = 4

/** `lib/modetour-departures`와 동일한 기준일 앵커로 searchTo(YYYY-MM-DD) 계산 — 정리 스크립트·검증용 */
export function computeModetourCalendarSearchToYmd(monthsForward: number): string {
  const mf = Math.max(1, Math.min(18, monthsForward))
  const todayYmd = scrapeCalendarTodayYmd()
  const [y0, m0, d0] = todayYmd.split('-').map(Number)
  const rangeAnchor = new Date(Date.UTC(y0, m0 - 1, d0))
  const rangeEnd = new Date(Date.UTC(rangeAnchor.getUTCFullYear(), rangeAnchor.getUTCMonth() + mf, rangeAnchor.getUTCDate()))
  return rangeEnd.toISOString().slice(0, 10)
}

/**
 * 관리자 하나투어 출발일 재수집(E2E) — 앞으로 스캔할 월 수.
 * `HANATOUR_ADMIN_E2E_MONTHS_FORWARD` (1~18)로 덮어쓸 수 있음. 미설정 시 `SCRAPE_DEFAULT_MONTHS_FORWARD`와 동일(운영 다건·월 순회).
 */
export function resolveHanatourAdminE2eMonthsForward(): number {
  const raw = (process.env.HANATOUR_ADMIN_E2E_MONTHS_FORWARD ?? '').trim()
  const n = raw ? Number.parseInt(raw, 10) : NaN
  if (Number.isFinite(n) && n >= 1 && n <= 18) return n
  return SCRAPE_DEFAULT_MONTHS_FORWARD
}
