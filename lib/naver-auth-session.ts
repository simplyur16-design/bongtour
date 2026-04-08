import { encode } from 'next-auth/jwt'
import { NextResponse } from 'next/server'

const SESSION_MAX_AGE_SEC = 30 * 24 * 60 * 60

function resolvedAuthSecret(): string | undefined {
  const isProduction = process.env.NODE_ENV === 'production'
  return (
    process.env.AUTH_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    (!isProduction ? '__bongtour_dev_auth_secret_change_for_production__' : undefined)
  )
}

function baseUrlFromRequest(request: Request): string {
  const env =
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    new URL(request.url).origin
  return env.replace(/\/$/, '')
}

/** NEXTAUTH_URL 이 https 이면 __Secure- 쿠키 (Auth.js 와 동일) */
function useSecureCookie(request: Request): boolean {
  const u = process.env.NEXTAUTH_URL?.trim() || process.env.AUTH_URL?.trim()
  if (u?.startsWith('https://')) return true
  return new URL(request.url).protocol === 'https:'
}

/**
 * 수동 OAuth 완료 후 Auth.js JWT 세션 쿠키 설정 (auth.ts jwt/session 콜백과 동일 필드).
 * salt = defaultCookies(useSecure).sessionToken.name (@auth/core callback 과 동일)
 */
export async function appendNaverSessionCookie(params: {
  request: Request
  response: NextResponse
  user: {
    id: string
    name: string | null
    email: string | null
    image: string | null
    role: string | null
    accountStatus: string
  }
}): Promise<boolean> {
  const { request, response, user } = params
  const secret = resolvedAuthSecret()
  if (!secret) {
    console.error('[naver-auth-session] Missing AUTH_SECRET / NEXTAUTH_SECRET')
    return false
  }
  const secure = useSecureCookie(request)
  /** @auth/core `defaultCookies(secure).sessionToken.name` 와 동일 */
  const cookieName = `${secure ? '__Secure-' : ''}authjs.session-token`
  const salt = cookieName

  const tokenPayload: Record<string, unknown> = {
    sub: user.id,
    name: user.name,
    email: user.email,
    picture: user.image,
    id: user.id,
    role: user.role,
    accountStatus: user.accountStatus,
  }

  const jwt = await encode({
    token: tokenPayload,
    secret,
    salt,
    maxAge: SESSION_MAX_AGE_SEC,
  })

  const expires = new Date(Date.now() + SESSION_MAX_AGE_SEC * 1000)
  response.cookies.set(cookieName, jwt, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure,
    expires,
  })
  return true
}

export function redirectAfterNaverLogin(request: Request, path: string): URL {
  const base = baseUrlFromRequest(request)
  const p = path.startsWith('/') ? path : `/${path}`
  try {
    return new URL(p, base)
  } catch {
    return new URL('/', base)
  }
}
