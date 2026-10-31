/**
 * 교원이지(kyowontour) 출발 달력 — 상품 기간(박·일) 거르기.
 *
 * `differentDepartDate` 는 6자 masterCode 기준이라 같은 마스터에 2박3일·3박4일 출발이 섞여 온다
 * (예: CTP221 — 같은 TW02 접미사도 3박4일일 수 있음). 응답 행의 `dN`('2박3일') 으로만 기간을 판단한다.
 * 가격·기간을 추정하거나 만들어 내지 않는다. 상품 기간을 모르면 거르지 않고 경고만 남긴다.
 */

export type KyowontourTripDuration = { nights: number; days: number }

/** '2박3일' · '2박 3일' · '2 박 3 일' → { nights, days }. 못 읽으면 null. */
export function parseKyowontourTripDurationLabel(raw: unknown): KyowontourTripDuration | null {
  if (raw == null) return null
  const m = /(\d{1,2})\s*박\s*(\d{1,2})\s*일/u.exec(String(raw))
  if (!m) return null
  const nights = Number(m[1])
  const days = Number(m[2])
  if (!Number.isFinite(nights) || !Number.isFinite(days) || nights < 0 || days <= 0) return null
  return { nights, days }
}

/** 상품 기간: tripNights·tripDays 둘 다 있으면 우선, 아니면 duration 문자열('2박 3일'). */
export function resolveKyowontourProductTripDuration(
  product:
    | {
        duration?: string | null
        tripNights?: number | null
        tripDays?: number | null
      }
    | null
    | undefined,
): KyowontourTripDuration | null {
  if (!product) return null
  const n = product.tripNights
  const d = product.tripDays
  if (typeof n === 'number' && typeof d === 'number' && Number.isFinite(n) && Number.isFinite(d) && n >= 0 && d > 0) {
    return { nights: n, days: d }
  }
  return parseKyowontourTripDurationLabel(product.duration ?? null)
}

/** 캘린더 행 원본(rawJson 또는 dayAirList 항목)의 dN → 기간. 없으면 null. */
export function kyowontourRowTripDuration(raw: unknown): KyowontourTripDuration | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  return parseKyowontourTripDurationLabel(o.dN ?? o.dn ?? o.DN ?? null)
}

export function kyowontourTripDurationEquals(
  a: KyowontourTripDuration | null | undefined,
  b: KyowontourTripDuration | null | undefined,
): boolean {
  return !!a && !!b && a.nights === b.nights && a.days === b.days
}

export function formatKyowontourTripDuration(d: KyowontourTripDuration | null | undefined): string {
  return d ? `${d.nights}박${d.days}일` : '?'
}

export type KyowontourTripDurationMatch = 'match' | 'mismatch' | 'unknown'

export function classifyKyowontourRowTripDuration(
  raw: unknown,
  expected: KyowontourTripDuration | null | undefined,
): KyowontourTripDurationMatch {
  if (!expected) return 'unknown'
  const got = kyowontourRowTripDuration(raw)
  if (!got) return 'unknown'
  return kyowontourTripDurationEquals(got, expected) ? 'match' : 'mismatch'
}

/**
 * 같은 출발일 행 병합 규칙 (byDate Map 용).
 * - 기대 기간이 없으면: 지금 동작 그대로 — 나중 행이 덮어씀(true).
 * - 새 행이 기간 불일치: 버림(false) — 호출부에서 먼저 걸러야 하지만 안전장치.
 * - 기존 행이 기간 일치이고 새 행이 dN 없음(unknown): 기존 유지(false).
 * - 그 밖: 나중 행이 덮어씀(true).
 */
export function shouldReplaceKyowontourSameDateRow(
  existingRaw: unknown | null | undefined,
  incomingRaw: unknown,
  expected: KyowontourTripDuration | null | undefined,
): boolean {
  if (!expected) return true
  const inc = classifyKyowontourRowTripDuration(incomingRaw, expected)
  if (inc === 'mismatch') return false
  if (existingRaw == null) return true
  const ex = classifyKyowontourRowTripDuration(existingRaw, expected)
  if (ex === 'match' && inc === 'unknown') return false
  return true
}
