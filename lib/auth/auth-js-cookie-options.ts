import { resolveOAuthStateCookieDomain } from '@/lib/oauth-state-cookie-domain'
import { getSiteOrigin } from '@/lib/site-metadata'

/** Auth.js session·OAuth state 쿠키 — www/apex 공유 (운영만 registrable domain) */
export function authJsCookieOptions(): {
  httpOnly: boolean
  sameSite: 'lax'
  path: string
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
    /* localhost fallback */
  }
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure,
    ...(domain ? { domain } : {}),
  }
}

export function authJsCookiePrefix(): string {
  return authJsCookieOptions().secure ? '__Secure-' : ''
}
