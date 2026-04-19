/**
 * 카카오 OAuth2 (authorization code) — 공개 origin, redirect_uri, state 쿠키.
 * 네이버 OAuth(`lib/naver-oauth-public.ts`)와 동일 원칙.
 *
 * 운영 콘솔: Redirect URI + 비즈니스 인증 리다이렉트 URI → 동일 `…/api/auth/kakao/callback`.
 * `KAKAO_CLIENT_SECRET` 은 「카카오 로그인」Client Secret (callback/route 토큰 교환). 설정 절차: `.env.example` · `env.local.social-login.example`.
 */

import type { NextResponse } from 'next/server'
import { publicOriginIfLoopbackRequest } from '@/lib/oauth-loopback-public-origin'

export const KAKAO_OAUTH_STATE_COOKIE = 'kakao_oauth_state'
export const KAKAO_OAUTH_REDIRECT_COOKIE = 'kakao_oauth_redirect'
const KAKAO_CALLBACK_PATH = '/api/auth/kakao/callback'
const STATE_MAX_AGE_SEC = 60 * 10

function stripTrailingSlash(u: string): string {
  return u.replace(/\/+$/, '')
}

export function maskKakaoState(s: string | undefined | null): string {
  if (!s) return '(empty)'
  if (s.length <= 8) return `len=${s.length}`
  return `${s.slice(0, 8)}…len=${s.length}`
}

export function maskKakaoClientId(id: string | undefined): string {
  if (!id) return '(empty)'
  if (id.length < 8) return '***'
  return `${id.slice(0, 6)}…`
}

function parseOrigin(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  try {
    const u = new URL(t.includes('://') ? t : `https://${t}`)
    return stripTrailingSlash(u.origin)
  } catch {
    return null
  }
}

/** KAKAO_OAUTH_PUBLIC_ORIGIN → (비운영 localhost) → NEXTAUTH_URL 등 → 요청 Host */
export function resolveKakaoOAuthPublicOrigin(request: Request): string {
  const explicit = process.env.KAKAO_OAUTH_PUBLIC_ORIGIN?.trim()
  if (explicit) {
    const o = parseOrigin(explicit)
    if (o) return o
  }

  const isProd = process.env.NODE_ENV === 'production'

  if (!isProd) {
    for (const raw of [process.env.NEXTAUTH_URL, process.env.AUTH_URL]) {
      const o = raw ? parseOrigin(raw) : null
      if (!o) continue
      const h = new URL(o).hostname
      if (h === 'localhost' || h === '127.0.0.1') return o
    }
    return 'http://localhost:3000'
  }

  for (const raw of [
    process.env.NEXTAUTH_URL,
    process.env.AUTH_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ]) {
    const o = raw ? parseOrigin(raw) : null
    if (o) return o
  }

  const hostRaw = (request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '')
    .split(',')[0]
    ?.trim()
  const host = hostRaw?.replace(/:\d+$/, '') ?? ''
  if (!host) {
    try {
      return stripTrailingSlash(new URL(request.url).origin)
    } catch {
      return 'http://localhost:3000'
    }
  }
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')
  const fp = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase()
  const proto = fp === 'https' || fp === 'http' ? fp : isLocal ? 'http' : 'https'
  return `${proto}://${host}`
}

/** loopback 이면 env 콜백 무시하고 로컬 callback. 그 외 KAKAO_CALLBACK_URL 또는 origin + 경로 */
export function resolveKakaoRedirectUri(request: Request): string {
  const loop = publicOriginIfLoopbackRequest(request)
  if (loop) return `${loop}${KAKAO_CALLBACK_PATH}`
  const fromEnv = process.env.KAKAO_CALLBACK_URL?.trim()
  if (fromEnv) return fromEnv
  return `${resolveKakaoOAuthPublicOrigin(request)}${KAKAO_CALLBACK_PATH}`
}

function resolveCookieDomainFromHostname(hostname: string): string | undefined {
  const raw = process.env.KAKAO_OAUTH_COOKIE_DOMAIN?.trim() ?? process.env.NAVER_OAUTH_COOKIE_DOMAIN?.trim()
  if (raw) {
    const h = raw.replace(/^\./, '')
    return `.${h}`
  }
  if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.local')) {
    return undefined
  }
  if (hostname.startsWith('www.')) {
    return `.${hostname.slice(4)}`
  }
  return undefined
}

export type KakaoOAuthStateCookieOptions = {
  httpOnly: true
  secure: boolean
  sameSite: 'lax'
  path: '/'
  maxAge: number
  domain?: string
}

export function buildKakaoOAuthStateCookieOptions(request: Request): KakaoOAuthStateCookieOptions {
  const publicOrigin = resolveKakaoOAuthPublicOrigin(request)
  const secure = publicOrigin.startsWith('https://')
  let hostname = ''
  try {
    hostname = new URL(publicOrigin).hostname
  } catch {
    hostname = ''
  }
  const domain = resolveCookieDomainFromHostname(hostname)
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: STATE_MAX_AGE_SEC,
    ...(domain ? { domain } : {}),
  }
}

export function clearKakaoOAuthStateCookies(res: NextResponse, request: Request): void {
  const o = buildKakaoOAuthStateCookieOptions(request)
  const cleared: KakaoOAuthStateCookieOptions = { ...o, maxAge: 0 }
  res.cookies.set(KAKAO_OAUTH_STATE_COOKIE, '', cleared)
  res.cookies.set(KAKAO_OAUTH_REDIRECT_COOKIE, '', cleared)
}

export function kakaoOAuthVerboseLog(): boolean {
  return process.env.KAKAO_OAUTH_DEBUG === '1' || process.env.NODE_ENV !== 'production'
}

export function kakaoOAuthLog(stage: string, payload: Record<string, unknown>): void {
  if (!kakaoOAuthVerboseLog()) return
  console.log(`[kakao-oauth] ${stage}`, payload)
}
