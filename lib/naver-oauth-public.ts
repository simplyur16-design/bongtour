/**
 * 네이버 OAuth2 (authorization code) — 공개 origin, redirect_uri, state 쿠키 옵션.
 * authorize / callback 이 동일한 redirect_uri·쿠키 규칙을 쓰도록 단일화.
 */

import type { NextResponse } from 'next/server'

export const NAVER_OAUTH_STATE_COOKIE = 'naver_oauth_state'
export const NAVER_OAUTH_REDIRECT_COOKIE = 'naver_oauth_redirect'
const NAVER_CALLBACK_PATH = '/api/auth/naver/callback'
const STATE_MAX_AGE_SEC = 60 * 10

function stripTrailingSlash(u: string): string {
  return u.replace(/\/+$/, '')
}

export function maskNaverState(s: string | undefined | null): string {
  if (!s) return '(empty)'
  if (s.length <= 8) return `len=${s.length}`
  return `${s.slice(0, 8)}…len=${s.length}`
}

export function maskNaverClientId(id: string | undefined): string {
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

/**
 * 공개 사이트 origin (authorize 의 redirect_uri·쿠키 Secure 판단에 동일 사용).
 * 우선순위: NAVER_OAUTH_PUBLIC_ORIGIN → (비운영 시 localhost 우선) → NEXTAUTH_URL 등 → 운영 시 요청 Host.
 */
export function resolveNaverOAuthPublicOrigin(request: Request): string {
  const explicit = process.env.NAVER_OAUTH_PUBLIC_ORIGIN?.trim()
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

/**
 * 네이버에 넘기는 redirect_uri (= 토큰 교환 시 동일 값).
 * NAVER_CALLBACK_URL 이 있으면 그대로(레거시·콘솔과 문자열 일치), 없으면 origin + 고정 경로.
 */
export function resolveNaverRedirectUri(request: Request): string {
  const fromEnv = process.env.NAVER_CALLBACK_URL?.trim()
  if (fromEnv) return fromEnv
  return `${resolveNaverOAuthPublicOrigin(request)}${NAVER_CALLBACK_PATH}`
}

function resolveCookieDomainFromHostname(hostname: string): string | undefined {
  const raw = process.env.NAVER_OAUTH_COOKIE_DOMAIN?.trim()
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

export type NaverOAuthStateCookieOptions = {
  httpOnly: true
  secure: boolean
  sameSite: 'lax'
  path: '/'
  maxAge: number
  domain?: string
}

/** state / redirect 쿠키 — authorize·callback 삭제 시 동일 옵션 사용 */
export function buildNaverOAuthStateCookieOptions(request: Request): NaverOAuthStateCookieOptions {
  const publicOrigin = resolveNaverOAuthPublicOrigin(request)
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

export function clearNaverOAuthStateCookies(res: NextResponse, request: Request): void {
  const o = buildNaverOAuthStateCookieOptions(request)
  const cleared: NaverOAuthStateCookieOptions = { ...o, maxAge: 0 }
  res.cookies.set(NAVER_OAUTH_STATE_COOKIE, '', cleared)
  res.cookies.set(NAVER_OAUTH_REDIRECT_COOKIE, '', cleared)
}

export function naverOAuthVerboseLog(): boolean {
  return process.env.NAVER_OAUTH_DEBUG === '1' || process.env.NODE_ENV !== 'production'
}

export function naverOAuthLog(stage: string, payload: Record<string, unknown>): void {
  if (!naverOAuthVerboseLog()) return
  console.log(`[naver-oauth] ${stage}`, payload)
}
