import { NextResponse } from 'next/server'
import NextAuth from 'next-auth'
import authConfig from './auth.config'
import {
  ADMIN_BYPASS_COOKIE_NAME,
  isAdminBypassAllowed,
  isDevAdminBypassRuntimeAllowed,
} from '@/lib/admin-bypass'
import {
  checkAdminApiRateLimit,
  classifyAdminApi,
  getClientIp,
  recordAdminApiSecurityEvent,
} from '@/lib/admin-api-security'
import { isAdminPanelRole, isMembersViewerRole } from '@/lib/user-role'

const BYPASS_COOKIE_MAX_AGE = 60 * 60 // 1시간

function isBypassAllowed(req: { nextUrl: URL; cookies: { get: (n: string) => { value: string } | undefined } }): boolean {
  return isAdminBypassAllowed({
    cookieValue: req.cookies.get(ADMIN_BYPASS_COOKIE_NAME)?.value,
    authQuery: req.nextUrl.searchParams.get('auth') ?? undefined,
  })
}

/** Python 스케줄러 등: `Authorization: Bearer <ADMIN_BYPASS_SECRET>` — 세션 없이 /api/admin/* 통과 */
function adminApiServiceBearerOk(req: { headers: Headers }): boolean {
  const secret = process.env.ADMIN_BYPASS_SECRET?.trim()
  if (!secret) return false
  const auth = req.headers.get('authorization') ?? req.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return false
  return auth.slice(7).trim() === secret
}

const isDev = process.env.NODE_ENV === 'development'

/** Edge 번들에 `@/auth`(Prisma·jose JWE 전체)를 넣지 않기 위해 `auth.config`만 사용 */
const { auth } = NextAuth(authConfig)

export default auth(async (req) => {
  const { pathname, searchParams } = req.nextUrl

  // matcher 에서 제외되더라도, 정적 자산이 미들웨어를 타면 auth·bypass·레이트리밋이 끼어들 수 있어 즉시 통과.
  // (경로 끝이 .js/.css 인 경우는 admin URL과 충돌할 수 있어 제외하지 않음 — `/_next/` 로 충분)
  if (
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/images/') ||
    pathname.startsWith('/image/') ||
    pathname.startsWith('/logos/') ||
    /\.(?:ico|png|jpg|jpeg|gif|webp|svg|woff2?|txt|xml)$/i.test(pathname)
  ) {
    return NextResponse.next()
  }

  const isAdminRoute = pathname.startsWith('/admin')
  const isAdminApiRoute = pathname.startsWith('/api/admin/')
  const bypassParam = searchParams.get('auth')

  // 바이패스 시도(?auth= 또는 쿠키)가 있을 때만 상세 로그 — 매 navigation 마다 찍히는 것을 줄임
  if (isDev && isAdminRoute && isDevAdminBypassRuntimeAllowed()) {
    const cookie = req.cookies.get(ADMIN_BYPASS_COOKIE_NAME)?.value
    if (bypassParam || cookie) {
      const hasSecret = Boolean(process.env.ADMIN_BYPASS_SECRET && process.env.ADMIN_BYPASS_SECRET.length > 0)
      const bypassAllowed = isBypassAllowed(req)
      console.log('[middleware admin]', {
        pathname,
        authQuery: bypassParam ?? null,
        cookiePresent: Boolean(cookie),
        BONGTOUR_DEV_ADMIN_BYPASS: process.env.BONGTOUR_DEV_ADMIN_BYPASS ?? null,
        ADMIN_BYPASS_SECRET_set: hasSecret,
        isBypassAllowed: bypassAllowed,
        hasAuthSession: Boolean(req.auth?.user),
        willRedirectToSignin: isAdminRoute && !req.auth?.user && !bypassAllowed,
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
        { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
      )
    }
  }

  // 개발 전용 bypass: ADMIN_BYPASS_SECRET env가 있고 쿼리/쿠키 일치 시에만 인증 생략
  if (isAdminRoute && isBypassAllowed(req)) {
    const secret = process.env.ADMIN_BYPASS_SECRET
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

  /**
   * 개발 전용: 페이지와 동일한 바이패스 쿠키·?auth= 일치 시 /api/admin/* 도 세션 검사 생략.
   * 운영·VERCEL_ENV=production·BONGTOUR_DEV_ADMIN_BYPASS 미설정 시 isBypassAllowed 는 항상 false.
   * 레이트리밋은 위에서 이미 적용됨.
   */
  if (isAdminApiRoute && isBypassAllowed(req)) {
    return NextResponse.next()
  }

  if (isAdminApiRoute && adminApiServiceBearerOk(req)) {
    return NextResponse.next()
  }

  if (isAdminRoute || isAdminApiRoute) {
    const session = req.auth
    if (!session?.user) {
      if (isAdminApiRoute) {
        recordAdminApiSecurityEvent(getClientIp(req.headers), '401', pathname)
        return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
      }
      const signInUrl = new URL('/auth/signin', req.url)
      signInUrl.searchParams.set('callbackUrl', pathname + req.nextUrl.search)
      return NextResponse.redirect(signInUrl)
    }
    const role = (session.user as { role?: string }).role
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
})

/**
 * `/_next/static`, `/_next/image`, favicon, public 파일은 여기에 매칭되지 않음 → 이 미들웨어가 실행되지 않는다.
 * (CSS 경고 시: docs/SECURITY-POLICY.md §5 — 실패 URL 실측 후 분류.)
 */
export const config = {
  matcher: ['/admin', '/admin/:path*', '/api/admin/:path*'],
}
