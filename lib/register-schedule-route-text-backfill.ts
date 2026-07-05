/**
 * 등록 schedule — imageKeyword apply 전 routeText 최소 보정 (서버 post-augment·클라이언트 preview 공용).
 */
export type RegisterScheduleRouteTextBackfillRow = {
  day: number
  title?: string | null
  description?: string | null
  routeText?: string | null
}

/** 마지막·기내박 일차 — routeText 없을 때 title로 최소 보정 */
export function backfillEmptyScheduleRouteTextFromTitle<T extends RegisterScheduleRouteTextBackfillRow>(
  rows: T[],
): T[] {
  if (!rows.length) return rows
  const maxDay = Math.max(...rows.map((r) => Number(r.day)).filter((d) => d > 0))
  return rows.map((row) => {
    const day = Number(row.day)
    if (day <= 0 || String(row.routeText ?? '').trim()) return row
    const title = String(row.title ?? '').trim()
    if (!title) return row
    if (day === maxDay && /^(?:인천|김포|ICN|GMP)$/iu.test(title)) {
      return { ...row, routeText: title }
    }
    if (/^기내박$/u.test(title)) {
      return { ...row, routeText: '기내박' }
    }
    return row
  })
}

/** description/title 1줄에 `A - B - C` 동선이 있으면 routeText로 승격 */
export function backfillScheduleRouteTextFromDescriptionOrTitle<T extends RegisterScheduleRouteTextBackfillRow>(
  rows: T[],
): T[] {
  return rows.map((row) => {
    if (String(row.routeText ?? '').trim()) return row
    for (const src of [String(row.description ?? '').trim(), String(row.title ?? '').trim()]) {
      if (!src) continue
      const firstLine = src.split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? ''
      if (!firstLine || firstLine.length < 8) continue
      if (/\s[-–—→]\s|[-–—→].*[-–—→]/u.test(firstLine)) {
        return { ...row, routeText: firstLine.slice(0, 500) }
      }
    }
    return row
  })
}

export function prepareRegisterScheduleRowsForImageKeywordApply<T extends RegisterScheduleRouteTextBackfillRow>(
  rows: T[],
): T[] {
  return backfillScheduleRouteTextFromDescriptionOrTitle(backfillEmptyScheduleRouteTextFromTitle(rows))
}
