/**
 * 공개 상세 미팅 블록: meetingDefault + meetingExtra 조합 시 중복·포함 관계 정리.
 * 저장/직렬화와 무관 — 최종 노출 SSOT.
 */

function normalizeForCompare(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

export type MeetingBlockResolved = { line1: string; line2: string | null }

/**
 * - 완전 동일 / 한 줄이 다른 줄에 포함 → 한 줄만 (더 긴 쪽 우선)
 * - 서로 다른 정보만 → line1=본문 우선, line2=추가
 */
export function resolveMeetingBlockForPublic(
  meetingDefault: string,
  meetingExtraRaw: string | null | undefined
): MeetingBlockResolved {
  const rawD = (meetingDefault ?? '').trim()
  const rawE = (meetingExtraRaw ?? '').trim()
  if (!rawE) return { line1: rawD, line2: null }

  const d = normalizeForCompare(rawD)
  const e = normalizeForCompare(rawE)
  if (d === e) return { line1: rawD, line2: null }
  if (d.includes(e)) return { line1: rawD, line2: null }
  if (e.includes(d)) return { line1: rawE, line2: null }
  return { line1: rawD, line2: rawE }
}
