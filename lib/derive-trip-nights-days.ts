/**
 * 표시·비교 시점 — Product.tripNights / tripDays 도출 SSOT.
 * duration · title · 일정 일수에서만 추론 (DB 백필 없음).
 * 「5일」만 있을 때 nights를 days-1로 지어내지 않는다 (3박5일 혼입 방지).
 */

export type DeriveTripNightsDaysInput = {
  duration?: string | null
  title?: string | null
  /** schedule / itinerary day count — days가 비었을 때만 채움 */
  scheduleDayCount?: number | null
  /** DB에 이미 있으면 우선 (표시 SSOT; 백필 아님) */
  tripNights?: number | null
  tripDays?: number | null
}

export type DeriveTripNightsDaysResult = {
  tripNights: number | null
  tripDays: number | null
  /** 공개·비교 한 줄 라벨 */
  label: string | null
}

/** title에서 N박M일 / M일 힌트 (bongtour durationHintFromTitle 와 동일 규칙, 순환 import 방지) */
function durationHintFromTitleLocal(title: string): string | null {
  const hay = String(title || '')
  const nm = hay.match(/(\d+)\s*박\s*(\d+)\s*일/)
  if (nm) return `${nm[1]}박 ${nm[2]}일`
  const only = hay.match(/(?<!\d)(\d+)\s*일(?!\d)/)
  if (only) return `${only[1]}일`
  return null
}

function parseNightsDaysFromLabel(label: string | null | undefined): {
  nights: number | null
  days: number | null
} {
  const t = String(label || '').trim()
  if (!t) return { nights: null, days: null }
  const nm = t.match(/(\d+)\s*박\s*(\d+)\s*일/)
  if (nm) {
    return { nights: Number(nm[1]), days: Number(nm[2]) }
  }
  const nightsOnly = t.match(/(\d+)\s*박/)
  if (nightsOnly && !/(\d+)\s*일/.test(t)) {
    const n = Number(nightsOnly[1])
    return { nights: n, days: n + 1 }
  }
  const daysOnly = t.match(/(?<!\d)(\d+)\s*일(?!\d)/)
  if (daysOnly) {
    const d = Number(daysOnly[1])
    // days-only: nights 미확정 (4박5일 가정 금지)
    return { nights: null, days: d }
  }
  return { nights: null, days: null }
}

export function formatTripNightsDaysLabel(
  tripNights: number | null,
  tripDays: number | null,
): string | null {
  if (tripNights != null && tripDays != null) return `${tripNights}박 ${tripDays}일`
  if (tripDays != null) return `${tripDays}일`
  if (tripNights != null) return `${tripNights}박`
  return null
}

/**
 * duration → title hint → (optional) DB scalars → schedule length 순.
 * days-only 라벨에서는 nights를 발명하지 않는다.
 */
export function deriveTripNightsDays(input: DeriveTripNightsDaysInput): DeriveTripNightsDaysResult {
  const durationRaw = String(input.duration || '').trim() || null
  const fromDuration = parseNightsDaysFromLabel(durationRaw)
  const titleHint = durationHintFromTitleLocal(String(input.title || ''))
  const fromTitle = parseNightsDaysFromLabel(titleHint)

  let tripDays = fromDuration.days ?? fromTitle.days
  let tripNights = fromDuration.nights ?? fromTitle.nights

  const dbN = Number(input.tripNights)
  const dbD = Number(input.tripDays)
  if (tripNights == null && Number.isFinite(dbN) && dbN >= 0) tripNights = dbN
  if (tripDays == null && Number.isFinite(dbD) && dbD >= 1) tripDays = dbD

  const sched = Number(input.scheduleDayCount)
  if (Number.isFinite(sched) && sched >= 1 && tripDays == null) {
    tripDays = sched
  }

  // nights만 알 때 days = nights+1 은 표준 패키지 관례
  if (tripNights != null && tripDays == null) tripDays = tripNights + 1
  // days만 알 때 nights 발명 금지

  return {
    tripNights,
    tripDays,
    label: formatTripNightsDaysLabel(tripNights, tripDays),
  }
}

/**
 * 비교 매칭 — days·nights 숫자 기준.
 * 한쪽만 nights가 있으면 불일치(「5일」↔「4박 5일」 혼입 방지).
 */
export function compareTripLengthMatch(
  a: DeriveTripNightsDaysInput,
  b: DeriveTripNightsDaysInput,
): boolean {
  const da = deriveTripNightsDays(a)
  const db = deriveTripNightsDays(b)
  if (da.tripDays == null || db.tripDays == null) return false
  if (da.tripDays !== db.tripDays) return false
  if (da.tripNights == null && db.tripNights == null) return true
  if (da.tripNights == null || db.tripNights == null) return false
  return da.tripNights === db.tripNights
}
