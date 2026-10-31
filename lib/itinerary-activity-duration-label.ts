/**
 * 톤 1031(봉실장 23:50): 예시 일정 활동의 소요시간 표시 — 값이 비었거나 0·null·숫자가 아니면 표시하지 않는다('0분' 방지).
 * 톤 1031 프롬프트가 durationMinutes 를 null 로 받고, 공개 상세 모델이 null 을 0 으로 채워서 '0분'이 보였다.
 */
export function formatItineraryActivityDurationLabel(minutes: number | string | null | undefined): string | null {
  if (minutes == null) return null
  const n = typeof minutes === 'number' ? minutes : Number(String(minutes).trim())
  if (String(minutes).trim() === '' || !Number.isFinite(n) || n <= 0) return null
  return `${Math.round(n)}분`
}
