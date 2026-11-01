/**
 * 자유여행 추천일정 일수 — 기본값 4일 금지(사장님 11/01 19:01).
 * 순서: 상품 duration 'M일' → 'N박'(N+1) → 원문 ItineraryDay 행 수 → schedule 일차 수. 모두 없으면 null(생성하지 않고 사유 기록).
 * REGRESSION-FREEZE[fit-gemini-recommended-itinerary-1101]: 일수 기본값 4 금지 — manifest
 */
export function parseTripDaysFromDurationText(text: string | null | undefined): number | null {
  const t = String(text ?? '')
  const m = t.match(/(\d{1,2})\s*일/)
  if (m) {
    const n = parseInt(m[1]!, 10)
    if (Number.isFinite(n) && n >= 1 && n <= 40) return n
  }
  const b = t.match(/(\d{1,2})\s*박/)
  if (b) {
    const n = parseInt(b[1]!, 10)
    if (Number.isFinite(n) && n >= 0 && n <= 39) return n + 1
  }
  return null
}

function maxScheduleDay(schedule: string | null | undefined): number {
  if (!schedule?.trim()) return 0
  try {
    const arr = JSON.parse(schedule) as unknown
    if (!Array.isArray(arr)) return 0
    let max = 0
    for (const r of arr) {
      const d = Math.floor(Number((r as { day?: unknown })?.day))
      if (Number.isFinite(d) && d > max && d <= 40) max = d
    }
    return max
  } catch {
    return 0
  }
}

export type FitTotalDaysSource = 'duration' | 'title' | 'itinerary_days' | 'schedule'

export function resolveFitTotalDays(input: {
  duration?: string | null
  title?: string | null
  itineraryDayCount?: number | null
  schedule?: string | null
}): { days: number; source: FitTotalDaysSource } | null {
  const fromDur = parseTripDaysFromDurationText(input.duration)
  if (fromDur) return { days: fromDur, source: 'duration' }
  const fromTitle = parseTripDaysFromDurationText(input.title)
  if (fromTitle) return { days: fromTitle, source: 'title' }
  const rows = Math.floor(Number(input.itineraryDayCount ?? 0))
  if (Number.isFinite(rows) && rows >= 1 && rows <= 40) return { days: rows, source: 'itinerary_days' }
  const sched = maxScheduleDay(input.schedule)
  if (sched >= 1) return { days: sched, source: 'schedule' }
  return null
}
