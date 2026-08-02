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
import { isAdminOnlyRole, isAdminToolRole } from '@/lib/admin-roles'
import { isAdminPanelRole, isAffiliationReviewerRole, isMembersViewerRole } from '@/lib/user-role'
import {
  consentPendingFromMarkerCookie,
  isConsentAllowedPath,
  redirectToConsentSignup,
} from '@/lib/middleware-consent'
import { authDebugLog } from '@/lib/auth/auth-debug'
import {
  isSimplyurSurfacePath,
  SIMPLYUR_SURFACE_HEADER,
  SIMPLYUR_SURFACE_VALUE,
} from '@/lib/surface/simplyur-surface'
import { isMobileUserAgent } from '@/lib/product-detail-viewport-from-ua'

// REGRESSION-FREEZE[simplyur-surface-layout-p2]: simplyur surface 헤더 — manifest

const BYPASS_COOKIE_MAX_AGE = 60 * 60 // 1시간

const isDev = process.env.NODE_ENV === 'development'

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

/** nginx 뒤 HTTPS — Auth.js 는 `__Secure-authjs.session-token` 사용, getToken 은 secureCookie 필수 */
function isSecureAuthCookieRequest(req: NextRequest): boolean {
  const proto = (req.headers.get('x-forwarded-proto') ?? '').split(',')[0]?.trim()
  if (proto === 'https') return true
  if (proto === 'http') return false
  return req.nextUrl.protocol === 'https:'
}

async function readSessionToken(req: NextRequest): Promise<MiddlewareToken | null> {
  if (!resolvedAuthSecret) return null
  try {
    const token = await getToken({
      req,
      secret: resolvedAuthSecret,
      secureCookie: isSecureAuthCookieRequest(req),
    })
    return (token as MiddlewareToken | null) ?? null
  } catch (e) {
    console.warn('[middleware] getToken failed', e)
    return null
  }
}

export async function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl

  const requestHeaders = new Headers(req.headers)
  if (isSimplyurSurfacePath(pathname)) {
    requestHeaders.set(SIMPLYUR_SURFACE_HEADER, SIMPLYUR_SURFACE_VALUE)
  }
  const forward = () => NextResponse.next({ request: { headers: requestHeaders } })

  if (isStaticOrPublicAsset(pathname)) {
    return forward()
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
      authDebugLog('middleware-admin', {
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
      authDebugLog('admin-bypass', '개발용 임시 접속:', req.url)
    }
    const res = forward()
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
    return forward()
  }

  if (isAdminApiRoute && adminApiServiceBearerOk(req)) {
    return forward()
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
    const affiliationAdminPage = pathname.startsWith('/admin/bongsim/affiliation-cards')
    const affiliationApi = pathname.startsWith('/api/admin/affiliation-cards')

    if (isAdminApiRoute && isStaff) {
      const membersApi = pathname.startsWith('/api/admin/members') && req.method === 'GET'
      const quickActionsApi = pathname.startsWith('/api/admin/quick-actions/')
      if (!membersApi && !quickActionsApi && !affiliationApi) {
        recordAdminApiSecurityEvent(getClientIp(req.headers), '403', pathname)
        return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
      }
    }

    if (isAdminApiRoute && pathname.startsWith('/api/admin/staff')) {
      if (!isAdminOnlyRole(role)) {
        recordAdminApiSecurityEvent(getClientIp(req.headers), '403', pathname)
        return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
      }
    }

    // STAFF: 회원 관리 + 소속 명함 승인만 (그 외 /admin → 회원 관리)
    if (
      isAdminRoute &&
      isStaff &&
      !pathname.startsWith('/admin/members') &&
      !affiliationAdminPage
    ) {
      return NextResponse.redirect(new URL('/admin/members', req.url))
    }

    const quickActionsApi = pathname.startsWith('/api/admin/quick-actions/')
    const staffApi = pathname.startsWith('/api/admin/staff')
    const staffAdminPage = pathname.startsWith('/admin/staff')
    const membersPath =
      pathname.startsWith('/admin/members') || pathname.startsWith('/api/admin/members')
    const affiliationPath = affiliationAdminPage || affiliationApi

    let allowed: boolean
    if (quickActionsApi) {
      allowed = isAdminToolRole(role)
    } else if (staffApi || staffAdminPage) {
      allowed = isAdminOnlyRole(role)
    } else if (membersPath) {
      allowed = isMembersViewerRole(role)
    } else if (affiliationPath) {
      allowed = isAffiliationReviewerRole(role)
    } else {
      allowed = isAdminPanelRole(role)
    }
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

  // REGRESSION-FREEZE[home-single-device-ssr]: mobile UA → /m rewrite (URL은 /) — manifest
  // consent/admin 가드 이후에만 — pending 유저가 / 에서 우회되지 않게.
  if (pathname === '/' || pathname === '/m') {
    const mobile = isMobileUserAgent(req.headers.get('user-agent'))
    let homeRes: NextResponse
    if (pathname === '/' && mobile) {
      const url = req.nextUrl.clone()
      url.pathname = '/m'
      homeRes = NextResponse.rewrite(url, { request: { headers: requestHeaders } })
    } else if (pathname === '/m' && !mobile) {
      const url = req.nextUrl.clone()
      url.pathname = '/'
      homeRes = NextResponse.rewrite(url, { request: { headers: requestHeaders } })
    } else {
      homeRes = forward()
    }
    // UA rewrite가 private no-store로 굳지 않게 CDN 힌트 + Vary
    homeRes.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
    homeRes.headers.set('Vary', 'User-Agent')
    return homeRes
  }

  return forward()
}

/**
 * 익명 공개 페이지는 matcher 미실행 → Edge JWT 비용 없음.
 * 로그인·consent_pending(세션 쿠키·`bt-consent-pending`)만 넓은 패턴에 매칭.
 *
 * `source`·`key`는 반드시 문자열 리터럴 — Next 빌드가 config를 정적으로 분석함.
 * 값 SSOT: `lib/auth-session-cookie.ts` (`AUTH_SESSION_COOKIE_*`, `CONSENT_PENDING_MARKER_COOKIE`)
 */
export const config = {
  matcher: [
    '/',
    '/m',
    '/simplyur',
    '/simplyur/:path*',
    '/admin',
    '/admin/:path*',
    '/api/admin/:path*',
    {
      source:
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:ico|png|jpg|jpeg|gif|webp|svg|woff2?|txt|xml)$).*)',
      has: [{ type: 'cookie', key: 'authjs.session-token' }],
    },
    {
      source:
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:ico|png|jpg|jpeg|gif|webp|svg|woff2?|txt|xml)$).*)',
      has: [{ type: 'cookie', key: '__Secure-authjs.session-token' }],
    },
    {
      source:
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:ico|png|jpg|jpeg|gif|webp|svg|woff2?|txt|xml)$).*)',
      has: [{ type: 'cookie', key: 'bt-consent-pending' }],
    },
  ],
}
