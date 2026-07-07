/** OAuth는 인앱 브라우저(Safari/Chrome) 세션 — RN fetch API 쿠키와 분리됨 */

let webOAuthSessionAt: number | null = null

const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000

export function markWebOAuthSession(): void {
  webOAuthSessionAt = Date.now()
}

export function clearWebOAuthSession(): void {
  webOAuthSessionAt = null
}

export function hasRecentWebOAuthSession(maxAgeMs = DEFAULT_MAX_AGE_MS): boolean {
  if (webOAuthSessionAt == null) return false
  return Date.now() - webOAuthSessionAt < maxAgeMs
}
