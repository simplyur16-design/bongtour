/**
 * 사진 채움(process-images)이 일정 JSON을 다시 쓸 때 일차 동선(routeText)이 빠지지 않게 한다 — 순수 함수.
 * 10/31 첫 배치: 48개 모두 routeText가 지워져 사진 전 검증(verify)이 day*_route_empty 로 실패,
 * 자동 검사 verify_failed 48 + 등록대기 큐(registerPrePhotoQueueReady)에서 빠짐.
 * REGRESSION-FREEZE[process-images-preserve-route-text]: 사진 채움 뒤에도 일정 routeText 유지 — manifest
 */
export function preserveScheduleRouteText<T extends { day?: unknown; routeText?: string | null }>(
  next: readonly T[],
  prev: ReadonlyArray<{ day?: unknown; routeText?: string | null } | null | undefined>,
): T[] {
  const byDay = new Map<number, string>()
  for (const p of prev) {
    const r = String(p?.routeText ?? '').trim()
    const d = Number(p?.day)
    if (r && Number.isFinite(d) && !byDay.has(d)) byDay.set(d, r)
  }
  return next.map((row, i) => {
    if (String(row.routeText ?? '').trim()) return row
    const fromDay = byDay.get(Number(row.day))
    const fromIndex = String(prev[i]?.routeText ?? '').trim()
    const routeText = fromDay ?? (fromIndex || null)
    return routeText ? { ...row, routeText } : row
  })
}
