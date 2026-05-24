import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { resolvedAuthSecret } from './auth.config'
import {
  ADMIN_BYPASS_COOKIE_NAME,
  isAdminBypassAllowed,
  isDevAdminBypassRuntimeAllowed,
} from '@/lib/admin-bypass'
import { getAdminServiceBearerSecret, getDevAdminBypassSecret } from '@/lib/admin-secrets'
import {
  checkAdminApiRateLimit,
  classifyAdminApi,
  getClientIp,
  recordAdminApiSecurityEvent,
} from '@/lib/admin-api-security'
import { isAdminPanelRole, isMembersViewerRole } from '@/lib/user-role'
import {
  AUTH_SESSION_COOKIE_PLAIN,
  AUTH_SESSION_COOKIE_SECURE,
  CONSENT_PENDING_MARKER_COOKIE,
} from '@/lib/auth-session-cookie'
import {
  consentPendingFromMarkerCookie,
  isConsentAllowedPath,
  redirectToConsentSignup,
} from '@/lib/middleware-consent'

const BYPASS_COOKIE_MAX_AGE = 60 * 60 // 1시간

const isDev = process.env.NODE_ENV === 'development'

/** 정적·public 파일 — matcher 와 동일 제외 패턴 */
const PUBLIC_PAGE_MATCHER_SOURCE =
  '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:ico|png|jpg|jpeg|gif|webp|svg|woff2?|txt|xml)$).*)'

type MiddlewareToken = {
  id?: string
  sub?: string
  role?: string | null
  accountStatus?: string
}

function isBypassAllowed(req: NextRequest): boolean {
  return isAdminBypassAllowed({
    cookieValue: req.cookies.get(ADMIN_BYPASS_COOKIE_NAME)?.value,
    authQuery: req.nextUrl.searchParams.get('auth') ?? undefined,
  })
}

function adminApiServiceBearerOk(req: NextRequest): boolean {
  const secret = getAdminServiceBearerSecret()
  if (!secret) return false
  const auth = req.headers.get('authorization') ?? req.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return false
  return auth.slice(7).trim() === secret
}

function isStaticOrPublicAsset(pathname: string): boolean {
  return (
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/images/') ||
    pathname.startsWith('/image/') ||
    pathname.startsWith('/logos/') ||
    /\.(?:ico|png|jpg|jpeg|gif|webp|svg|woff2?|txt|xml)$/i.test(pathname)
  )
}

async function readSessionToken(req: NextRequest): Promise<MiddlewareToken | null> {
  if (!resolvedAuthSecret) return null
  try {
    const token = await getToken({ req, secret: resolvedAuthSecret })
    return (token as MiddlewareToken | null) ?? null
  } catch (e) {
    console.warn('[middleware] getToken failed', e)
    return null
  }
}

export async function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl

  if (isStaticOrPublicAsset(pathname)) {
    return NextResponse.next()
  }

  const markerRedirect = consentPendingFromMarkerCookie(req, pathname)
  if (markerRedirect) return markerRedirect

  const isAdminRoute = pathname.startsWith('/admin')
  const isAdminApiRoute = pathname.startsWith('/api/admin/')
  const needsSessionDecode =
    isAdminRoute ||
    isAdminApiRoute ||
    !isConsentAllowedPath(pathname)

  let token: MiddlewareToken | null = null
  if (needsSessionDecode) {
    token = await readSessionToken(req)
    const accountStatus = token?.accountStatus ?? 'active'
    if (token && accountStatus === 'consent_pending' && !isConsentAllowedPath(pathname)) {
      return redirectToConsentSignup(req, pathname)
    }
  }

  const bypassParam = searchParams.get('auth')

  if (isDev && isAdminRoute && isDevAdminBypassRuntimeAllowed()) {
    const cookie = req.cookies.get(ADMIN_BYPASS_COOKIE_NAME)?.value
    if (bypassParam || cookie) {
      const hasSecret = Boolean(getDevAdminBypassSecret())
      const bypassAllowed = isBypassAllowed(req)
      console.log('[middleware admin]', {
        pathname,
        authQuery: bypassParam ?? null,
        cookiePresent: Boolean(cookie),
        BONGTOUR_DEV_ADMIN_BYPASS: process.env.BONGTOUR_DEV_ADMIN_BYPASS ?? null,
        dev_admin_bypass_secret_set: hasSecret,
        isBypassAllowed: bypassAllowed,
        hasAuthSession: Boolean(token),
        willRedirectToSignin: isAdminRoute && !token && !bypassAllowed,
      })
    }
  }

  if (isAdminApiRoute) {
    const ip = getClientIp(req.headers)
    const cls = classifyAdminApi(pathname, req.method)
    const { limited, retryAfterSec } = await checkAdminApiRateLimit(ip, cls)
    if (cls === 'expensive') recordAdminApiSecurityEvent(ip, 'expensive', pathname)
    if (limited) {
      recordAdminApiSecurityEvent(ip, '429', pathname)
      return NextResponse.json(
        { error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' },
        { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
      )
    }
  }

  if (isAdminRoute && isBypassAllowed(req)) {
    const secret = getDevAdminBypassSecret()
    if (isDev && secret && bypassParam === secret) {
      console.log('[admin bypass] 개발용 임시 접속:', req.url)
    }
    const res = NextResponse.next()
    if (secret && bypassParam === secret) {
      res.cookies.set(ADMIN_BYPASS_COOKIE_NAME, secret, {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: BYPASS_COOKIE_MAX_AGE,
        path: '/',
      })
    }
    return res
  }

  if (isAdminApiRoute && isBypassAllowed(req)) {
    return NextResponse.next()
  }

  if (isAdminApiRoute && adminApiServiceBearerOk(req)) {
    return NextResponse.next()
  }

  if (isAdminRoute || isAdminApiRoute) {
    if (!token) {
      if (isAdminApiRoute) {
        recordAdminApiSecurityEvent(getClientIp(req.headers), '401', pathname)
        return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
      }
      const signInUrl = new URL('/auth/signin', req.url)
      signInUrl.searchParams.set('callbackUrl', pathname + req.nextUrl.search)
      return NextResponse.redirect(signInUrl)
    }

    const role = token.role ?? null
    const isStaff = role === 'STAFF'

    if (isAdminApiRoute && isStaff) {
      const membersApi = pathname.startsWith('/api/admin/members') && req.method === 'GET'
      if (!membersApi) {
        recordAdminApiSecurityEvent(getClientIp(req.headers), '403', pathname)
        return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
      }
    }

    if (isAdminRoute && isStaff && !pathname.startsWith('/admin/members')) {
      return NextResponse.redirect(new URL('/admin/members', req.url))
    }

    const membersPath =
      pathname.startsWith('/admin/members') || pathname.startsWith('/api/admin/members')
    const allowed = membersPath ? isMembersViewerRole(role) : isAdminPanelRole(role)
    if (!allowed) {
      if (isAdminApiRoute) {
        recordAdminApiSecurityEvent(getClientIp(req.headers), '403', pathname)
        return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
      }
      const denied = new URL('/auth/error', req.url)
      denied.searchParams.set('error', 'AccessDenied')
      return NextResponse.redirect(denied)
    }
  }

  return NextResponse.next()
}

/**
 * 익명 공개 페이지는 matcher 미실행 → Edge JWT 비용 없음.
 * 로그인·consent_pending(`bt-consent-pending` 또는 세션 쿠키)만 넓은 패턴에 매칭.
 */
export const config = {
  matcher: [
    '/admin',
    '/admin/:path*',
    '/api/admin/:path*',
    {
      source: PUBLIC_PAGE_MATCHER_SOURCE,
      has: [{ type: 'cookie', key: AUTH_SESSION_COOKIE_PLAIN }],
    },
    {
      source: PUBLIC_PAGE_MATCHER_SOURCE,
      has: [{ type: 'cookie', key: AUTH_SESSION_COOKIE_SECURE }],
    },
    {
      source: PUBLIC_PAGE_MATCHER_SOURCE,
      has: [{ type: 'cookie', key: CONSENT_PENDING_MARKER_COOKIE }],
    },
  ],
}
