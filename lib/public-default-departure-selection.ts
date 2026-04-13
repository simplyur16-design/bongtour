/**
 * 공개 상세 — 기본 대표 출발 행 선택 정책(전체 수집분·성인가 기준).
 * row 타입·데이터 소스는 공급사별 상세에서 넘기고, 비교 규칙만 공통화한다.
 */
import { getPriceAdult, isScheduleAdultBookable } from '@/lib/price-utils'

export function publicDateKeyFromRowDate(d: string): string {
  return d.startsWith('20') && d.length >= 10 ? d.slice(0, 10) : d
}

function sortByAdultPriceTiePolicy<T extends { date: string; id: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const pa = getPriceAdult(a as never)
    const pb = getPriceAdult(b as never)
    if (pa !== pb) return pa - pb
    const ba = isScheduleAdultBookable(a as never) ? 1 : 0
    const bb = isScheduleAdultBookable(b as never) ? 1 : 0
    if (bb !== ba) return bb - ba
    const da = publicDateKeyFromRowDate(a.date)
    const db = publicDateKeyFromRowDate(b.date)
    if (da !== db) return da.localeCompare(db)
    return a.id.localeCompare(b.id)
  })
}

/**
 * 예약가능 행 전체 중 **성인가(getPriceAdult)** 최저 1행.
 * 동가 → 예약가능(이미 true)·더 빠른 출발일 → id.
 */
export function pickGloballyCheapestDepartureRowByAdultPrice<T extends { date: string; id: string }>(
  rows: T[]
): T | null {
  const pool = rows.filter((r) => isScheduleAdultBookable(r as never))
  if (pool.length === 0) return null
  return sortByAdultPriceTiePolicy(pool)[0] ?? null
}

/** 사용자가 고른 일자 — 그날 예약가능 행만 두고 성인가 동일 정책으로 1행 */
export function pickBookableRowForDateKey<T extends { date: string; id: string }>(
  rows: T[],
  dateKey: string
): T | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null
  const pool = rows.filter(
    (r) => publicDateKeyFromRowDate(r.date) === dateKey && isScheduleAdultBookable(r as never)
  )
  if (pool.length === 0) return null
  return sortByAdultPriceTiePolicy(pool)[0] ?? null
}

/** 동일 일자의 아무 출발 행 1건(예약불가·가격 0 포함). on-demand 후보 선택용. */
export function pickAnyRowForDateKey<T extends { date: string; id: string }>(rows: T[], dateKey: string): T | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null
  const pool = rows.filter((r) => publicDateKeyFromRowDate(r.date) === dateKey)
  if (pool.length === 0) return null
  return sortByAdultPriceTiePolicy(pool)[0] ?? null
}
