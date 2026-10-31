/**
 * REGRESSION-FREEZE[register-schedule-supplier-day-count]: 공급사 원문 일수(여행기간 'N박 M일'·'M일')보다 일차가 많으면
 * 남는 일차를 만들지 않는다 (봉실장 10/31 21:18 — fit-nl-0016·ky-0027·yb-0088·hn-0152·ky-0035·ky-0038 원문 3일인데 4일차).
 */

/** '2박 3일'·'2박3일'·'3일'·'3박 5일(기내 1박)' → 일수. 못 읽으면 null */
export function registerSupplierTripDaysFromDuration(duration: string | null | undefined): number | null {
  const t = String(duration ?? '').replace(/\s+/g, ' ').trim()
  if (!t) return null
  const nd = t.match(/(\d{1,2})\s*박\s*(\d{1,2})\s*일/u)
  if (nd) {
    const d = Number(nd[2])
    return d > 0 && d <= 60 ? d : null
  }
  const d1 = t.match(/(?:^|[^\d])(\d{1,2})\s*일(?!\s*차)/u)
  if (d1) {
    const d = Number(d1[1])
    return d > 0 && d <= 60 ? d : null
  }
  return null
}

/**
 * 원문 일수: 여행기간과 상품명 속 'N일' 중 큰 값 (둘이 어긋나면 일차를 덜 빼는 쪽 — 예: 기간 '5일'·상품명 '6일' → 6).
 * 둘 다 못 읽으면 null (빼지 않음).
 */
export function registerSupplierTripDays(src: { duration?: string | null; title?: string | null }): number | null {
  const a = registerSupplierTripDaysFromDuration(src.duration ?? null)
  const b = registerSupplierTripDaysFromDuration(src.title ?? null)
  if (a == null && b == null) return null
  return Math.max(a ?? 0, b ?? 0)
}

/** 원문 일수보다 큰 일차 행을 뺀다. 일수를 모르면 그대로 */
export function trimRegisterScheduleToSupplierDays<T extends { day?: number | null }>(
  rows: T[],
  supplierDays: number | null | undefined,
): { rows: T[]; droppedDays: number[] } {
  if (!Array.isArray(rows) || !supplierDays || supplierDays <= 0) return { rows, droppedDays: [] }
  const droppedDays: number[] = []
  const kept = rows.filter((r) => {
    const d = Number(r?.day)
    if (Number.isFinite(d) && d > supplierDays) {
      droppedDays.push(d)
      return false
    }
    return true
  })
  return { rows: droppedDays.length ? kept : rows, droppedDays }
}
