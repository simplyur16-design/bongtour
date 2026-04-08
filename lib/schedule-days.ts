/**
 * schedule JSON 문자열에서 일차 수 반환. (관리자 목록 `데이터 불완전`은 0일 때만 사용)
 */
export function countScheduleDays(schedule: string | null): number {
  if (!schedule || typeof schedule !== 'string') return 0
  try {
    const parsed = JSON.parse(schedule) as unknown
    if (!Array.isArray(parsed)) return 0
    return parsed.length
  } catch {
    return 0
  }
}
