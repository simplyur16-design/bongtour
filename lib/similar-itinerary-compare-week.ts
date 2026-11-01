/**
 * REGRESSION-FREEZE[similar-itinerary-compare-week]: 비슷한 일정 비교 — 같은 출발 주간(월~일) 조건 — manifest
 *
 * 사장님 2026-10-31 14:53 「출발 주간까지 맞춰서 비교하게 해라」 / 「현재 공급사들 리스트만 가지고한다」.
 * - 주간 = 월요일~일요일(출발일 YMD 기준, 상세 달력과 같은 `toISOString().slice(0, 10)` 키).
 * - 가격은 DB ProductDeparture.adultPrice 만 쓴다(추정·보간 없음). 예약가능 하한(KST 오늘+2)·마감·잔여 0 은 제외
 *   — 공개 상세 기본 출발과 같은 `filterPublicBookableDepartureRows` 기준.
 * - 그 주 안에서 성인가가 낮은 출발 1건(같은 값이면 빠른 날짜)을 고른다.
 * - 기본 주간 = 후보 상품에 예약가능 출발이 있는 주 중 가장 이른 주(가까운 주).
 */
import {
  filterPublicBookableDepartureRows,
  pickGloballyCheapestDepartureRowByAdultPrice,
} from '@/lib/public-default-departure-selection'

export type CompareWeekDepartureInput = {
  id: string
  departureDate: Date | string
  adultPrice: number | null
  statusRaw?: string | null
  seatsStatusRaw?: string | null
  seatCount?: number | null
  isBookable?: boolean | null
  carrierName?: string | null
}

export type CompareWeekRow = {
  id: string
  date: string
  adult: number
  statusRaw: string | null
  seatsStatusRaw: string | null
  seatCount: number | null
  isBookable: boolean | null
  carrierName: string | null
}

export type CompareWeekPick = {
  departureId: string
  dateYmd: string
  adultKrw: number
  carrierName: string | null
}

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/

export function compareDepartureDateKey(d: Date | string): string {
  if (d instanceof Date) return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
  return String(d ?? '').slice(0, 10)
}

function ymdToUtcDate(ymd: string): Date | null {
  if (!YMD_RE.test(ymd)) return null
  const d = new Date(`${ymd}T00:00:00.000Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

function utcDateToYmd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** 그 날짜가 속한 주의 월요일 YMD */
export function compareWeekStartYmd(ymd: string): string | null {
  const d = ymdToUtcDate(ymd)
  if (!d) return null
  const dow = d.getUTCDay() // 0=일 … 6=토
  const back = (dow + 6) % 7
  d.setUTCDate(d.getUTCDate() - back)
  return utcDateToYmd(d)
}

/** 월요일 YMD → 일요일 YMD */
export function compareWeekEndYmd(weekStartYmd: string): string | null {
  const d = ymdToUtcDate(weekStartYmd)
  if (!d) return null
  d.setUTCDate(d.getUTCDate() + 6)
  return utcDateToYmd(d)
}

/** `?week=` 입력 — 아무 날짜나 받아 그 주 월요일로 맞춤, 형식 틀리면 null */
export function parseCompareWeekParam(raw: string | null | undefined): string | null {
  const s = String(raw ?? '').trim()
  if (!YMD_RE.test(s)) return null
  return compareWeekStartYmd(s)
}

export function toCompareWeekRows(departures: readonly CompareWeekDepartureInput[]): CompareWeekRow[] {
  const out: CompareWeekRow[] = []
  for (const d of departures) {
    const date = compareDepartureDateKey(d.departureDate)
    if (!YMD_RE.test(date)) continue
    const adult = typeof d.adultPrice === 'number' && Number.isFinite(d.adultPrice) ? Math.round(d.adultPrice) : 0
    out.push({
      id: String(d.id),
      date,
      adult,
      statusRaw: d.statusRaw ?? null,
      seatsStatusRaw: d.seatsStatusRaw ?? null,
      seatCount: d.seatCount ?? null,
      isBookable: d.isBookable ?? null,
      carrierName: d.carrierName ?? null,
    })
  }
  return out
}

/** 공개 예약가능(하한 이후·가격 있음·마감/잔여 0 제외) 행만 */
export function bookableCompareWeekRows(rows: readonly CompareWeekRow[], baseDate: Date = new Date()): CompareWeekRow[] {
  return filterPublicBookableDepartureRows([...rows], baseDate).filter((r) => r.adult > 0)
}

/** 선택 주간(월~일) 안에서 성인가가 낮은 출발 1건 — 같은 값이면 빠른 날짜 */
export function pickCompareWeekDeparture(
  rows: readonly CompareWeekRow[],
  weekStartYmd: string,
  baseDate: Date = new Date(),
): CompareWeekPick | null {
  const end = compareWeekEndYmd(weekStartYmd)
  if (!end) return null
  const inWeek = bookableCompareWeekRows(rows, baseDate).filter((r) => r.date >= weekStartYmd && r.date <= end)
  const pick = pickGloballyCheapestDepartureRowByAdultPrice(inWeek, baseDate)
  if (!pick || pick.adult <= 0) return null
  return { departureId: pick.id, dateYmd: pick.date, adultKrw: pick.adult, carrierName: pick.carrierName }
}

export type CompareWeekOption = {
  weekStartYmd: string
  weekEndYmd: string
  /** 그 주 예약가능 출발이 있는 후보 상품 수 */
  productCount: number
  /** 그 주 예약가능 출발이 있는 공급사 수 */
  supplierCount: number
}

/** 후보 상품들의 예약가능 출발로 고를 수 있는 주간 목록(이른 주부터) */
export function listCompareWeekOptions(
  products: ReadonlyArray<{ id: string; supplierKey: string | null; rows: readonly CompareWeekRow[] }>,
  baseDate: Date = new Date(),
  maxWeeks = 16,
): CompareWeekOption[] {
  const byWeek = new Map<string, { products: Set<string>; suppliers: Set<string> }>()
  for (const p of products) {
    for (const r of bookableCompareWeekRows(p.rows, baseDate)) {
      const ws = compareWeekStartYmd(r.date)
      if (!ws) continue
      const e = byWeek.get(ws) ?? { products: new Set<string>(), suppliers: new Set<string>() }
      e.products.add(p.id)
      if (p.supplierKey) e.suppliers.add(p.supplierKey)
      byWeek.set(ws, e)
    }
  }
  return [...byWeek.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(0, Math.max(1, maxWeeks))
    .map(([ws, e]) => ({
      weekStartYmd: ws,
      weekEndYmd: compareWeekEndYmd(ws) ?? ws,
      productCount: e.products.size,
      supplierCount: e.suppliers.size,
    }))
}

/** 요청 주간이 목록에 있으면 그 주, 없으면 가까운 주(목록 첫 주) */
export function resolveSelectedCompareWeek(
  requestedWeekStartYmd: string | null,
  options: readonly CompareWeekOption[],
): string | null {
  if (requestedWeekStartYmd && options.some((o) => o.weekStartYmd === requestedWeekStartYmd)) {
    return requestedWeekStartYmd
  }
  return options[0]?.weekStartYmd ?? null
}

const DOW_KO = ['일', '월', '화', '수', '목', '금', '토'] as const

/** `2026-11-12` → `11/12(목)` */
export function formatCompareDayLabel(ymd: string): string {
  const d = ymdToUtcDate(ymd)
  if (!d) return ymd
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${DOW_KO[d.getUTCDay()]})`
}

/** 주간 라벨 `11/9(월)~11/15(일)` */
export function formatCompareWeekLabel(weekStartYmd: string): string {
  const end = compareWeekEndYmd(weekStartYmd)
  if (!end) return weekStartYmd
  return `${formatCompareDayLabel(weekStartYmd)}~${formatCompareDayLabel(end)}`
}

export function formatCompareWeekPriceLabel(krw: number | null | undefined): string {
  if (krw == null || !Number.isFinite(krw) || krw <= 0) return '이 주 출발 없음'
  return `${Math.round(krw).toLocaleString('ko-KR')}원`
}
