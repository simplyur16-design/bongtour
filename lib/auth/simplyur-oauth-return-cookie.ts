/**
 * simplyur app OAuth safety net — if Auth.js loses callbackUrl and lands on `/`,
 * middleware sends the WebBrowser back to /simplyur/.../oauth-complete (never bongtour home).
 * REGRESSION-FREEZE[simplyur-oauth-home-bridge]: return cookie + home redirect — manifest
 */
import type { NextRequest, NextResponse } from 'next/server'
import { resolveOAuthStateCookieDomain } from '@/lib/oauth-state-cookie-domain'
import { getSiteOrigin } from '@/lib/site-metadata'

export const SIMPLYUR_OAUTH_RETURN_COOKIE = 'simplyur-oauth-return' as const

const MAX_AGE_SEC = 10 * 60

export function isSafeSimplyurOAuthReturnPath(raw: string | null | undefined): boolean {
  const v = (raw ?? '').trim()
  if (!v.startsWith('/') || v.startsWith('//')) return false
  // Only simplyur surface — never domestic home / admin
  if (!v.startsWith('/simplyur/')) return false
  if (v.length > 200) return false
  return true
}

function cookieBaseOptions(): {
  httpOnly: boolean
  path: string
  maxAge: number
  sameSite: 'lax' | 'none'
  secure: boolean
  domain?: string
} {
  let secure = false
  let domain: string | undefined
  try {
    const origin = getSiteOrigin()
    const hostname = new URL(origin).hostname
    secure = origin.startsWith('https://')
    if (hostname !== 'localhost' && hostname !== '127.0.0.1' && !hostname.endsWith('.local')) {
      domain = resolveOAuthStateCookieDomain(hostname)
    }
  } catch {
    /* localhost */
  }
  return {
    httpOnly: true,
    path: '/',
    maxAge: MAX_AGE_SEC,
    sameSite: secure ? 'none' : 'lax',
    secure,
    ...(domain ? { domain } : {}),
  }
}

/** Options for `cookies().set` / Response Set-Cookie */
export function simplyurOAuthReturnCookieSetOptions(path: string) {
  if (!isSafeSimplyurOAuthReturnPath(path)) {
    throw new Error('unsafe_simplyur_oauth_return_path')
  }
  return {
    name: SIMPLYUR_OAUTH_RETURN_COOKIE,
    value: path,
    ...cookieBaseOptions(),
  }
}

export function readSimplyurOAuthReturnPath(req: NextRequest): string | null {
  const raw = req.cookies.get(SIMPLYUR_OAUTH_RETURN_COOKIE)?.value ?? ''
  return isSafeSimplyurOAuthReturnPath(raw) ? raw.trim() : null
}

export function clearSimplyurOAuthReturnCookie(res: NextResponse): void {
  const base = cookieBaseOptions()
  res.cookies.set({
    name: SIMPLYUR_OAUTH_RETURN_COOKIE,
    value: '',
    httpOnly: true,
    path: '/',
    maxAge: 0,
    sameSite: base.sameSite,
    secure: base.secure,
    ...(base.domain ? { domain: base.domain } : {}),
  })
}
