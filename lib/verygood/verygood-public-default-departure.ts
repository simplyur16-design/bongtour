/**
 * 참좋은(verygoodtour) 공개 상세 — 대표 출발 행: **KST 오늘+3일 이후** 출발일만 두고 `prices` 중
 * 성인가 최저 → 동가 시 예약가능(마감 아님) 우선 → 더 빠른 출발일 → id.
 */
import { getPriceAdult } from '@/lib/price-utils'
import { scrapeCalendarVerygoodDepartureFloorYmd } from '@/lib/scrape-date-bounds'

function verygoodReservationOpenScore(row: { status?: string }): number {
  const s = String(row.status ?? '').trim()
  if (/마감|예약\s*마감|예약마감|불가|취소/.test(s)) return 0
  if (/예약\s*가능|예약가능|^가능|대기\s*예약|대기|신청/i.test(s)) return 2
  return 1
}

function publicDateKeyFromRowDate(d: string): string {
  return d.startsWith('20') && d.length >= 10 ? d.slice(0, 10) : d
}

export function pickVerygoodPublicDefaultDepartureRow<T extends { date: string; id: string; status?: string }>(
  rows: T[]
): T | null {
  const floor = scrapeCalendarVerygoodDepartureFloorYmd()
  const pool = rows.filter((r) => {
    if (getPriceAdult(r as never) <= 0) return false
    return publicDateKeyFromRowDate(r.date) >= floor
  })
  if (pool.length === 0) return null
  return [...pool].sort((a, b) => {
    const pa = getPriceAdult(a as never)
    const pb = getPriceAdult(b as never)
    if (pa !== pb) return pa - pb
    const oa = verygoodReservationOpenScore(a)
    const ob = verygoodReservationOpenScore(b)
    if (ob !== oa) return ob - oa
    const da = publicDateKeyFromRowDate(a.date)
    const db = publicDateKeyFromRowDate(b.date)
    if (da !== db) return da.localeCompare(db)
    return a.id.localeCompare(b.id)
  })[0]!
}
