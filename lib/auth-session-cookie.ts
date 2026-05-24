import type { NextRequest } from 'next/server'

/** OAuth 수동 세션·Auth.js 공통 — `lib/naver-auth-session.ts` 와 동일 */
export const AUTH_SESSION_COOKIE_PLAIN = 'authjs.session-token'
export const AUTH_SESSION_COOKIE_SECURE = '__Secure-authjs.session-token'

/** `consent_pending` 빠른 리다이렉트( JWT 없이 ). `appendNaverSessionCookie` 가 설정·해제 */
export const CONSENT_PENDING_MARKER_COOKIE = 'bt-consent-pending'

export function hasAuthSessionCookie(req: Pick<NextRequest, 'cookies'>): boolean {
  return Boolean(
    req.cookies.get(AUTH_SESSION_COOKIE_PLAIN)?.value ||
      req.cookies.get(AUTH_SESSION_COOKIE_SECURE)?.value,
  )
}

export function hasConsentPendingMarkerCookie(req: Pick<NextRequest, 'cookies'>): boolean {
  return req.cookies.get(CONSENT_PENDING_MARKER_COOKIE)?.value === '1'
}

/** 미들웨어 matcher `has: cookie` 용 */
export const MIDDLEWARE_SESSION_COOKIE_HAS = [
  { type: 'cookie' as const, key: AUTH_SESSION_COOKIE_PLAIN },
  { type: 'cookie' as const, key: AUTH_SESSION_COOKIE_SECURE },
  { type: 'cookie' as const, key: CONSENT_PENDING_MARKER_COOKIE },
]
