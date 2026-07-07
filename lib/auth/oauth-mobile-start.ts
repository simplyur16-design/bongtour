/** simplyur 앱 WebBrowser — GET OAuth 시작 (NextAuth v5는 POST /api/auth/signin/* 만 지원) */

export const OAUTH_MOBILE_START_PROVIDERS = ['google', 'apple'] as const
export type OAuthMobileStartProvider = (typeof OAUTH_MOBILE_START_PROVIDERS)[number]

export function isOAuthMobileStartProvider(v: string): v is OAuthMobileStartProvider {
  return (OAUTH_MOBILE_START_PROVIDERS as readonly string[]).includes(v)
}

/** 오픈 리다이렉트 방지 — same-origin 상대 경로만 */
export function safeOAuthCallbackUrl(
  raw: string | null | undefined,
  fallback = '/simplyur/en/my-esim',
): string {
  const v = (raw ?? '').trim()
  if (v.startsWith('/') && !v.startsWith('//')) return v
  return fallback
}
