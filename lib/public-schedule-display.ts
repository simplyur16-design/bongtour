/** 공개 상세 일정 — 내부 placeholder를 사용자에게 노출하지 않음 */

const PLACEHOLDER = /^(없음|없음\.?|n\/a|na|\?|[-–—_]+)$/i

export function isScheduleUserPlaceholder(s: string | null | undefined): boolean {
  const t = (s ?? '').replace(/\s+/g, ' ').trim()
  if (!t) return true
  if (PLACEHOLDER.test(t)) return true
  if (/^없음\b/i.test(t)) {
    const rest = t.replace(/^없음\b[,，\s]*/i, '').trim()
    if (!rest) return true
  }
  return false
}

/** DAY 블록 제목: title이 placeholder면 description 첫 실질 줄 */
export function resolvePublicScheduleDayTitle(title: string | null | undefined, description: string | null | undefined): string | null {
  const t = title?.replace(/\s+/g, ' ').trim()
  if (t && !isScheduleUserPlaceholder(t)) return t
  const lines = (description ?? '').replace(/\r/g, '\n').split('\n')
  for (const ln of lines) {
    const s = ln.replace(/\s+/g, ' ').trim()
    if (s && !isScheduleUserPlaceholder(s)) return s.length > 120 ? `${s.slice(0, 117)}…` : s
  }
  return null
}
