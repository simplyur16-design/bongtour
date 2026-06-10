import type { NextResponse } from 'next/server'
import {
  AUTH_SESSION_COOKIE_PLAIN,
  AUTH_SESSION_COOKIE_SECURE,
  CONSENT_PENDING_MARKER_COOKIE,
} from '@/lib/auth-session-cookie'
import { getSiteOrigin } from '@/lib/site-metadata'
import { resolveOAuthStateCookieDomain } from '@/lib/oauth-state-cookie-domain'

function sessionCookieSecureFromEnv(): boolean {
  return getSiteOrigin().startsWith('https://')
}

function registrableCookieDomain(): string | undefined {
  try {
    return resolveOAuthStateCookieDomain(new URL(getSiteOrigin()).hostname)
  } catch {
    return undefined
  }
}

function clearOne(
  res: NextResponse,
  name: string,
  secure: boolean,
  domain?: string,
): void {
  res.cookies.set(name, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure,
    maxAge: 0,
    expires: new Date(0),
    ...(domain ? { domain } : {}),
  })
}

/**
 * 로그아웃 시 host-only·registrable domain 등 남아 있을 수 있는 세션 쿠키를 모두 제거.
 * (www/apex 쿠키 정책 변경 전후 중복 쿠키 대응)
 */
export function clearAllAuthSessionCookies(res: NextResponse): void {
  const secure = sessionCookieSecureFromEnv()
  const domain = registrableCookieDomain()
  const names = secure
    ? [AUTH_SESSION_COOKIE_SECURE, AUTH_SESSION_COOKIE_PLAIN]
    : [AUTH_SESSION_COOKIE_PLAIN, AUTH_SESSION_COOKIE_SECURE]

  for (const name of names) {
    clearOne(res, name, secure, undefined)
    if (domain) clearOne(res, name, secure, domain)
    // legacy NextAuth v4 name (마이그레이션 잔존)
    if (name.includes('authjs')) {
      const legacy = name.replace('authjs', 'next-auth')
      clearOne(res, legacy, secure, undefined)
      if (domain) clearOne(res, legacy, secure, domain)
    }
  }

  clearOne(res, CONSENT_PENDING_MARKER_COOKIE, secure, undefined)
  if (domain) clearOne(res, CONSENT_PENDING_MARKER_COOKIE, secure, domain)
}
