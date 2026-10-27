/**
 * 공개 상세 — 기본 대표 출발 행 선택 정책.
 * SSOT: 공개 예약가능 하한(KST today+2) **이후** 예약가능 행 중 **성인가 최저**.
 * 동가 → 더 빠른 출발일 → id. 지나간(하한 미만) 출발일은 후보에서 제외.
 */
import { getPublicBookableMinYmd } from '@/lib/public-bookable-date'
import { getPriceAdult, isScheduleAdultBookable } from '@/lib/price-utils'
import { isDepartureSoldOut } from '@/lib/departure-seat-availability'

// REGRESSION-FREEZE[public-default-departure-nearest]: 하한 이후만 · 대표=최저가 — manifest

export function publicDateKeyFromRowDate(d: string): string {
  return d.startsWith('20') && d.length >= 10 ? d.slice(0, 10) : d
}

function isOnOrAfterBookableFloor(dateKey: string, floorYmd: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateKey) && dateKey >= floorYmd
}

/** 공개 상세에 쓸 행만 — 예약가능(잔여석 0 = 판매완료 제외, 카드·달력과 같은 기준) + 공개 예약가능 하한 이상 */
export function filterPublicBookableDepartureRows<T extends { date: string }>(
  rows: T[],
  baseDate: Date = new Date(),
): T[] {
  const floor = getPublicBookableMinYmd(baseDate)
  return rows.filter((r) => {
    if (!isScheduleAdultBookable(r as never)) return false
    if (isDepartureSoldOut(r as never)) return false
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

/**
 * 상세 달력용 날짜별 1행 병합 — 같은 날짜 여러 회차(항공사별 등)는 기존처럼 뒤 행 우선, 현장 수집(patch) 행이 그 날짜를 덮는다.
 * 단 공개 기본 대표 출발(전체 회차 중 `pickDefault` 결과 — 기본: 하한 이후 예약가능 성인가 최저, 동가 → 빠른 날짜)은
 * 그 날짜 칸에 반드시 남긴다. 날짜 병합에 최저가 회차가 가려져 기본 출발일이 다른 날로 밀리던 문제 방지.
 */
// REGRESSION-FREEZE[public-default-departure-nearest]: 날짜 병합 후에도 기본 출발 = 전 회차 최저가 — manifest
export function mergePublicPriceRowsByDate<T extends { date: string; id: string }>(
  baseRows: readonly T[],
  patchRows: readonly T[],
  pickDefault: (rows: T[]) => T | null = (rows) => pickGloballyCheapestDepartureRowByAdultPrice(rows),
): T[] {
  const by = new Map<string, T>()
  for (const p of baseRows) by.set(publicDateKeyFromRowDate(p.date), p)
  const patchByDate = new Map<string, T>()
  for (const p of patchRows) patchByDate.set(publicDateKeyFromRowDate(p.date), p)
  for (const [k, p] of patchByDate) by.set(k, p)
  const pool = [
    ...baseRows.filter((r) => !patchByDate.has(publicDateKeyFromRowDate(r.date))),
    ...patchByDate.values(),
  ]
  const best = pickDefault(pool)
  if (best) by.set(publicDateKeyFromRowDate(best.date), best)
  return [...by.values()].sort((a, b) =>
    publicDateKeyFromRowDate(a.date).localeCompare(publicDateKeyFromRowDate(b.date)),
  )
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
