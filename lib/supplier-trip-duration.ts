/**
 * 공급사 공통 — 상품 기간(박·일)과 출발 행 기간 비교 (참좋은·롯데 등).
 * 교원 `kyowontour-trip-duration-filter` 의 순수 함수를 공급사 중립 이름으로 다시 내보낸다.
 * 가격·기간을 추정하거나 만들어 내지 않는다.
 */
import {
  formatKyowontourTripDuration,
  kyowontourTripDurationEquals,
  parseKyowontourTripDurationLabel,
  resolveKyowontourProductTripDuration,
  type KyowontourTripDuration,
} from '@/lib/kyowontour-trip-duration-filter'

export type SupplierTripDuration = KyowontourTripDuration

export const parseSupplierTripDurationLabel = parseKyowontourTripDurationLabel
export const resolveSupplierProductTripDuration = resolveKyowontourProductTripDuration
export const supplierTripDurationEquals = kyowontourTripDurationEquals
export const formatSupplierTripDuration = formatKyowontourTripDuration

/** 숫자 박·일 쌍 → 기간 (참좋은 TourNight·TourDay). 못 읽으면 null. */
export function supplierTripDurationFromNumbers(nights: unknown, days: unknown): SupplierTripDuration | null {
  const n = typeof nights === 'number' ? nights : typeof nights === 'string' && nights.trim() ? Number(nights) : NaN
  const d = typeof days === 'number' ? days : typeof days === 'string' && days.trim() ? Number(days) : NaN
  if (!Number.isFinite(n) || !Number.isFinite(d) || n < 0 || d <= 0) return null
  return { nights: n, days: d }
}

export type SupplierTripDurationFilterStats = {
  kept: number
  droppedMismatch: number
  keptUnknown: number
  /** 응답에서 본 기간 라벨별 행 수 ('3박4일' → n, 못 읽음 → '?') */
  seen: Record<string, number>
}

/**
 * 행 목록을 기대 기간으로 거른다.
 * - expected 없음: 거르지 않음(지금 동작). 응답에 기간이 2개 이상이면 경고만.
 * - expected 있음: 기간이 다른 행 버림. 기간을 못 읽는 행은 남기고 경고.
 */
export function filterRowsBySupplierTripDuration<T>(
  rows: readonly T[],
  rowDuration: (row: T) => SupplierTripDuration | null,
  expected: SupplierTripDuration | null | undefined,
  label: string,
): { rows: T[]; warnings: string[]; stats: SupplierTripDurationFilterStats } {
  const seen: Record<string, number> = {}
  const out: T[] = []
  let droppedMismatch = 0
  let keptUnknown = 0
  for (const r of rows) {
    const got = rowDuration(r)
    const key = got ? formatSupplierTripDuration(got) : '?'
    seen[key] = (seen[key] ?? 0) + 1
    if (!expected) {
      out.push(r)
      continue
    }
    if (!got) {
      keptUnknown++
      out.push(r)
      continue
    }
    if (supplierTripDurationEquals(got, expected)) out.push(r)
    else droppedMismatch++
  }
  const warnings: string[] = []
  const known = Object.keys(seen).filter((k) => k !== '?')
  if (!expected) {
    if (known.length > 1) {
      warnings.push(
        `${label}: 기간 섞임 경고 — 상품 기간을 몰라 거르지 않음 (응답 기간 ${known.map((k) => `${k} ${seen[k]}건`).join(', ')})`,
      )
    }
  } else {
    if (droppedMismatch > 0) {
      warnings.push(
        `${label}: 상품 기간 ${formatSupplierTripDuration(expected)}과 다른 출발 ${droppedMismatch}건 제외 (응답 기간 ${Object.entries(seen).map(([k, v]) => `${k} ${v}건`).join(', ')})`,
      )
    }
    if (keptUnknown > 0) warnings.push(`${label}: 기간을 읽지 못한 출발 ${keptUnknown}건은 남김`)
  }
  return { rows: out, warnings, stats: { kept: out.length, droppedMismatch, keptUnknown, seen } }
}
