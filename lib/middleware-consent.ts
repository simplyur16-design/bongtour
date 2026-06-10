import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  CONSENT_PENDING_MARKER_COOKIE,
  hasConsentPendingMarkerCookie,
} from '@/lib/auth-session-cookie'

export function isConsentAllowedPath(pathname: string): boolean {
  return (
    pathname === '/auth/signup/consent' ||
    pathname.startsWith('/api/auth/signup/consent') ||
    pathname.startsWith('/api/auth/session') ||
    pathname.startsWith('/api/auth/csrf') ||
    pathname === '/api/auth/signout'
  )
}

export function redirectToConsentSignup(req: NextRequest, pathname: string): NextResponse {
  const consentUrl = new URL('/auth/signup/consent', req.url)
  consentUrl.searchParams.set('callbackUrl', pathname + req.nextUrl.search)
  return NextResponse.redirect(consentUrl)
}

/** 마커 쿠키만 있을 때 JWT 없이 리다이렉트 */
export function consentPendingFromMarkerCookie(
  req: NextRequest,
  pathname: string,
): NextResponse | null {
  if (!hasConsentPendingMarkerCookie(req)) return null
  if (isConsentAllowedPath(pathname)) return null
  return redirectToConsentSignup(req, pathname)
}

export function applyConsentPendingMarkerCookie(
  response: NextResponse,
  accountStatus: string,
  secure: boolean,
  domain?: string,
): void {
  const shared = {
    httpOnly: true as const,
    sameSite: 'lax' as const,
    path: '/',
    secure,
    ...(domain ? { domain } : {}),
  }
  if (accountStatus === 'consent_pending') {
    response.cookies.set(CONSENT_PENDING_MARKER_COOKIE, '1', {
      ...shared,
      maxAge: 30 * 24 * 60 * 60,
    })
    return
  }
  response.cookies.set(CONSENT_PENDING_MARKER_COOKIE, '', {
    ...shared,
    maxAge: 0,
  })
}
