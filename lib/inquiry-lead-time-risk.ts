/**
 * MVP `leadTimeRisk` 휴리스틱.
 * TODO(P2+): `lead_time_rule` 테이블·상품 유형별 리드타임 정책으로 교체 가능.
 *
 * payloadJson에 목표 월이 있으면 현재 달력 기준으로 촉박도만 대략 분류한다.
 * 허용 필드(첫 매칭만 사용): targetYearMonth, desiredYearMonth, departureYearMonth, travelYearMonth — 값 형식 `YYYY-MM`.
 */

export type LeadTimeRiskLevel = 'normal' | 'late' | 'urgent'

const TARGET_MONTH_KEYS = [
  'targetYearMonth',
  'desiredYearMonth',
  'departureYearMonth',
  'travelYearMonth',
] as const

const YM_RE = /^(\d{4})-(\d{2})$/

export function pickTargetYearMonthFromPayload(
  payload: Record<string, unknown> | null
): { year: number; month: number; raw: string } | null {
  if (!payload) return null
  for (const key of TARGET_MONTH_KEYS) {
    const v = payload[key]
    if (typeof v !== 'string') continue
    const s = v.trim()
    const m = YM_RE.exec(s)
    if (!m) continue
    const year = Number(m[1])
    const month = Number(m[2])
    if (month < 1 || month > 12) continue
    return { year, month, raw: s }
  }
  return null
}

/**
 * 달 단위 차이: target의 월 시작 vs now의 월 시작 (대략적인 "몇 달 남음").
 * - diff < 0: 이미 지난 달 → urgent
 * - diff === 0: 이번 달 출발 의도 → urgent (MVP: 매우 촉박으로 간주)
 * - diff === 1: 다음 달 → late
 * - diff >= 2: normal
 */
export function computeLeadTimeRisk(
  payload: Record<string, unknown> | null,
  now: Date = new Date()
): LeadTimeRiskLevel {
  const picked = pickTargetYearMonthFromPayload(payload)
  if (!picked) return 'normal'

  const cy = now.getFullYear()
  const cm = now.getMonth() + 1
  const diff = (picked.year - cy) * 12 + (picked.month - cm)

  if (diff < 0) return 'urgent'
  if (diff === 0) return 'urgent'
  if (diff === 1) return 'late'
  return 'normal'
}
