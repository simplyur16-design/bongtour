/**
 * 사실 가져오기 bundle → 변환 시 detail 재수집 skip 게이트.
 * REGRESSION-FREEZE[register-facts-fetch-resilience]: route coverage gate — manifest
 */
export function registerPrefetchScheduleHasRouteCoverage(
  schedule: Array<{ day?: number; routeText?: string | null }>,
): boolean {
  const days = schedule.filter((d) => Number(d.day) > 0)
  if (days.length === 0) return false
  const maxDay = Math.max(...days.map((d) => Number(d.day)))
  const needRoute = days.filter((d) => Number(d.day) < maxDay || days.length === 1)
  return needRoute.every((d) => String(d.routeText ?? '').trim().length > 0)
}
