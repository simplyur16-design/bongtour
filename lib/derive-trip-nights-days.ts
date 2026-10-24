/**
 * 등록·정규화 — Product.tripNights / tripDays 도출 SSOT.
 * duration 문자열·제목·일정 일수에서만 추론 (DB 백필 없음).
 * REGRESSION-FREEZE[register-derive-trip-nights-days]: duration/title/schedule → tripNights/Days — manifest
 */
import { durationHintFromTitle } from '@/lib/bongtour-product-display-title-ssot'
import { inferTripNights } from '@/lib/hero-date-utils'

export type DeriveTripNightsDaysInput = {
  duration?: string | null
  title?: string | null
  /** schedule / itinerary day count (있으면 days 하한) */
  scheduleDayCount?: number | null
}

export type DeriveTripNightsDaysResult = {
  tripNights: number | null
  tripDays: number | null
  /** 비어 있던 duration 을 채울 때 쓰는 정규화 라벨 (이미 있으면 원문 유지) */
  durationNormalized: string | null
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
  if (nightsOnly) {
    const n = Number(nightsOnly[1])
    return { nights: n, days: n + 1 }
  }
  const daysOnly = t.match(/(?<!\d)(\d+)\s*일(?!\d)/)
  if (daysOnly) {
    const d = Number(daysOnly[1])
    return { nights: Math.max(0, d - 1), days: d }
  }
  return { nights: null, days: null }
}

/**
 * duration → title hint → schedule length 순으로 tripNights/tripDays 채움.
 */
export function deriveTripNightsDays(input: DeriveTripNightsDaysInput): DeriveTripNightsDaysResult {
  const durationRaw = String(input.duration || '').trim() || null
  const fromDuration = parseNightsDaysFromLabel(durationRaw)
  const titleHint = durationHintFromTitle(String(input.title || ''))
  const fromTitle = parseNightsDaysFromLabel(titleHint)

  let tripDays = fromDuration.days ?? fromTitle.days
  let tripNights = fromDuration.nights ?? fromTitle.nights ?? inferTripNights(durationRaw || titleHint)

  const sched = Number(input.scheduleDayCount)
  if (Number.isFinite(sched) && sched >= 1) {
    if (tripDays == null || tripDays < sched) tripDays = sched
    if (tripNights == null && tripDays != null) tripNights = Math.max(0, tripDays - 1)
  }

  if (tripNights != null && tripDays == null) tripDays = tripNights + 1
  if (tripDays != null && tripNights == null) tripNights = Math.max(0, tripDays - 1)

  let durationNormalized = durationRaw
  if (!durationNormalized && tripNights != null && tripDays != null) {
    durationNormalized = `${tripNights}박 ${tripDays}일`
  } else if (!durationNormalized && titleHint) {
    durationNormalized = titleHint
  }

  return { tripNights, tripDays, durationNormalized }
}

/** 등록 productData / preview draft 에 스프레드할 필드 (`duration` 은 string — preview 타입 정합) */
export function tripNightsDaysFieldsForProductWrite(
  input: DeriveTripNightsDaysInput,
): { tripNights: number | null; tripDays: number | null; duration: string } {
  const d = deriveTripNightsDays(input)
  // REGRESSION-FREEZE[register-derive-trip-nights-days]: duration string for preview draft — manifest
  return {
    tripNights: d.tripNights,
    tripDays: d.tripDays,
    duration: String(input.duration || '').trim() || d.durationNormalized || '',
  }
}
