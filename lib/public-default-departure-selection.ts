/**
 * 공개 상세 — 기본 대표 출발 행 선택 정책.
 * SSOT: 공개 예약가능 하한(KST today+2) **이후** 예약가능 행 중 **성인가 최저**.
 * 동가 → 더 빠른 출발일 → id. 지나간(하한 미만) 출발일은 후보에서 제외.
 */
import { getPublicBookableMinYmd } from '@/lib/public-bookable-date'
import { getPriceAdult, isScheduleAdultBookable } from '@/lib/price-utils'

// REGRESSION-FREEZE[public-default-departure-nearest]: 하한 이후만 · 대표=최저가 — manifest

export function publicDateKeyFromRowDate(d: string): string {
  return d.startsWith('20') && d.length >= 10 ? d.slice(0, 10) : d
}

function isOnOrAfterBookableFloor(dateKey: string, floorYmd: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateKey) && dateKey >= floorYmd
}

/** 공개 상세에 쓸 행만 — 예약가능 + 공개 예약가능 하한 이상 */
export function filterPublicBookableDepartureRows<T extends { date: string }>(
  rows: T[],
  baseDate: Date = new Date(),
): T[] {
  const floor = getPublicBookableMinYmd(baseDate)
  return rows.filter((r) => {
    if (!isScheduleAdultBookable(r as never)) return false
    return isOnOrAfterBookableFloor(publicDateKeyFromRowDate(r.date), floor)
  })
}

function sortByAdultPriceThenDate<T extends { date: string; id: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const pa = getPriceAdult(a as never)
    const pb = getPriceAdult(b as never)
    if (pa !== pb) return pa - pb
    const da = publicDateKeyFromRowDate(a.date)
    const db = publicDateKeyFromRowDate(b.date)
    if (da !== db) return da.localeCompare(db)
    return a.id.localeCompare(b.id)
  })
}

/**
 * 공개 하한(오늘+2 KST) 이후 예약가능 행 중 **성인가 최저** 1행.
 * 동가 → 더 빠른 출발일 → id. 과거 출발일은 제외.
 */
export function pickGloballyCheapestDepartureRowByAdultPrice<T extends { date: string; id: string }>(
  rows: T[],
  baseDate: Date = new Date(),
): T | null {
  const pool = filterPublicBookableDepartureRows(rows, baseDate)
  if (pool.length === 0) return null
  return sortByAdultPriceThenDate(pool)[0] ?? null
}

/** @deprecated alias — 공개 기본 출발은 하한 이후 최저가 */
export function pickNearestPublicBookableDepartureRow<T extends { date: string; id: string }>(
  rows: T[],
  baseDate: Date = new Date(),
): T | null {
  return pickGloballyCheapestDepartureRowByAdultPrice(rows, baseDate)
}

/** 사용자가 고른 일자 — 그날 예약가능 행만 두고 성인가 최저 → 더 빠른 id */
export function pickBookableRowForDateKey<T extends { date: string; id: string }>(
  rows: T[],
  dateKey: string,
): T | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null
  const floor = getPublicBookableMinYmd()
  if (dateKey < floor) return null
  const pool = rows.filter(
    (r) => publicDateKeyFromRowDate(r.date) === dateKey && isScheduleAdultBookable(r as never),
  )
  if (pool.length === 0) return null
  return sortByAdultPriceThenDate(pool)[0] ?? null
}

/** 동일 일자의 아무 출발 행 1건(예약불가·가격 0 포함). on-demand 후보 선택용. */
export function pickAnyRowForDateKey<T extends { date: string; id: string }>(rows: T[], dateKey: string): T | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null
  const pool = rows.filter((r) => publicDateKeyFromRowDate(r.date) === dateKey)
  if (pool.length === 0) return null
  return sortByAdultPriceThenDate(pool)[0] ?? null
}
