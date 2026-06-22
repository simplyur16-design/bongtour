/**
 * 등록 일정 — 일차별 조식·중식·석식·호텔 필드 병합 SSOT.
 * REGRESSION-FREEZE[register-schedule-meal-hotel-merge]: LLM 일차 + 본문·탭 보강 — manifest
 */
export type ScheduleMealHotelFields = {
  day?: number
  hotelText?: string | null
  breakfastText?: string | null
  lunchText?: string | null
  dinnerText?: string | null
  mealSummaryText?: string | null
}

export function isEmptyMealHotelField(v: string | null | undefined): boolean {
  const t = (v ?? '').trim()
  return !t || t === '-' || t === '—' || t === '–'
}

export function scheduleRowLacksMealHotel(row: ScheduleMealHotelFields): boolean {
  return (
    isEmptyMealHotelField(row.hotelText) &&
    isEmptyMealHotelField(row.breakfastText) &&
    isEmptyMealHotelField(row.lunchText) &&
    isEmptyMealHotelField(row.dinnerText) &&
    isEmptyMealHotelField(row.mealSummaryText)
  )
}

/** 일차 대부분에 식사·호텔이 없으면 탭·본문 보강 대상 */
export function scheduleNeedsMealHotelCollect(
  rows: ScheduleMealHotelFields[] | null | undefined,
  minRatio = 0.5,
): boolean {
  const list = rows ?? []
  if (!list.length) return true
  const lacking = list.filter(scheduleRowLacksMealHotel).length
  return lacking / list.length >= minRatio
}

export function mergeScheduleMealHotelPatch<T extends ScheduleMealHotelFields>(
  base: T,
  patch: Partial<ScheduleMealHotelFields>,
): T {
  const out = { ...base }
  const keys: (keyof ScheduleMealHotelFields)[] = [
    'hotelText',
    'breakfastText',
    'lunchText',
    'dinnerText',
    'mealSummaryText',
  ]
  for (const k of keys) {
    const pv = patch[k]
    if (pv == null || typeof pv !== 'string') continue
    const p = pv.trim()
    if (!p || isEmptyMealHotelField(p)) continue
    if (!isEmptyMealHotelField(out[k] as string | null | undefined)) continue
    ;(out as Record<string, unknown>)[k] = k === 'hotelText' ? p.slice(0, 500) : p.slice(0, 500)
  }
  return out
}

/** 기존 일차(title·description 유지)에 supplement의 식사·호텔만 채움. 없는 day는 supplement 행 추가 */
export function mergeScheduleDaysPreservingExpressionMergingMealHotel<
  T extends ScheduleMealHotelFields & { day: number },
>(existing: T[], supplement: T[]): T[] {
  const byDay = new Map<number, T>()
  for (const r of existing) {
    const d = Number(r.day)
    if (!Number.isInteger(d) || d < 1) continue
    byDay.set(d, { ...r })
  }
  for (const sup of supplement) {
    const d = Number(sup.day)
    if (!Number.isInteger(d) || d < 1) continue
    const ex = byDay.get(d)
    if (!ex) {
      byDay.set(d, sup)
      continue
    }
    byDay.set(d, mergeScheduleMealHotelPatch(ex, sup))
  }
  return [...byDay.values()].sort((a, b) => a.day - b.day)
}
