/**
 * 공개 화면 출발일 상태 라벨 정규화 (표시 전용 — DB statusRaw 는 원문 유지).
 *
 * REGRESSION-FREEZE[departure-status-public-label]
 *  - '100% 출발' / '100%출발' → '출발확정'
 *  - '출발예정' → '예약가능' ('출발예정일' 같은 날짜 문구는 유지)
 *  - 신규 상품도 공개 렌더 경로(뷰모델·상세 예약현황 줄)에서 자동 적용.
 */
const RULES: Array<[RegExp, string]> = [
  [/100\s*%\s*출발(?:\s*확정)?/g, '출발확정'],
  [/출발\s*예정(?!\s*일)/g, '예약가능'],
]

export function toPublicDepartureStatusLabel(raw: string | null | undefined): string | undefined {
  if (raw == null) return undefined
  let t = String(raw).trim()
  if (!t) return t
  for (const [re, to] of RULES) t = t.replace(re, to)
  return t.replace(/(출발확정|예약가능)(\s*[·/,]\s*\1)+/g, '$1')
}
