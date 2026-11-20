/**
 * 공개 비교표에 남길 행 — 자기 자신 제외, 공급사당 1행(저장된 주간 요금이 낮은 것).
 */

export type CompareVisibleRow = {
  id: string
  slug: string | null
  supplierKey: string | null
  supplierLabel: string
  weekAdultKrw: number | null
}

export function selectVisibleCompareRows<T extends CompareVisibleRow>(
  rows: readonly T[],
  opts?: { excludeId?: string | null; excludeSlug?: string | null },
): T[] {
  const excludeId = String(opts?.excludeId || '').trim()
  const excludeSlug = String(opts?.excludeSlug || '').trim()
  const withoutSelf = rows.filter((row) => {
    if (excludeId && row.id === excludeId) return false
    if (excludeSlug && row.slug === excludeSlug) return false
    return true
  })
  const sorted = [...withoutSelf].sort((a, b) => {
    const pa = a.weekAdultKrw != null && a.weekAdultKrw > 0 ? a.weekAdultKrw : Number.POSITIVE_INFINITY
    const pb = b.weekAdultKrw != null && b.weekAdultKrw > 0 ? b.weekAdultKrw : Number.POSITIVE_INFINITY
    if (pa !== pb) return pa - pb
    return a.id.localeCompare(b.id)
  })
  const seen = new Set<string>()
  const out: T[] = []
  for (const row of sorted) {
    const key = row.supplierKey || row.supplierLabel || row.id
    if (seen.has(key)) continue
    seen.add(key)
    out.push(row)
  }
  out.sort((a, b) => a.supplierLabel.localeCompare(b.supplierLabel, 'ko') || a.id.localeCompare(b.id))
  return out
}
