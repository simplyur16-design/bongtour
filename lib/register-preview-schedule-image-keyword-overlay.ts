/**
 * 미리보기 병합: LLM `schedule[]`이 우선일 때 일차별 `imageKeyword`가 비어 있으면
 * 결정적(schedule_section) 일정에서 보강한다.
 */
export function overlayScheduleImageKeywordsFromFallbackSchedule(
  primarySchedule: unknown,
  fallbackSchedule: unknown,
): unknown {
  const primList = Array.isArray(primarySchedule) ? primarySchedule : []
  const fallList = Array.isArray(fallbackSchedule) ? fallbackSchedule : []
  if (!primList.length || !fallList.length) return primarySchedule

  const fallByDay = new Map<number, string>()
  for (const s of fallList) {
    const rec = s as Record<string, unknown>
    const d = Number(rec.day) || 0
    const kw = String(rec.imageKeyword ?? '').trim()
    if (d > 0 && kw) fallByDay.set(d, kw)
  }
  if (!fallByDay.size) return primarySchedule

  return primList.map((s) => {
    const rec = s as Record<string, unknown>
    const d = Number(rec.day) || 0
    const pk = String(rec.imageKeyword ?? '').trim()
    if (pk || d <= 0) return s
    const fk = fallByDay.get(d)
    if (!fk) return s
    return { ...rec, imageKeyword: fk }
  })
}
