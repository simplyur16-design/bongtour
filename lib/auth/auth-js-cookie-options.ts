import { resolveOAuthStateCookieDomain } from '@/lib/oauth-state-cookie-domain'
import { getSiteOrigin } from '@/lib/site-metadata'

type CookieOpts = {
  httpOnly: boolean
  sameSite: 'lax' | 'none'
  path: string
  secure: boolean
  domain?: string
}

function baseCookieContext(): { secure: boolean; domain?: string } {
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
  return { secure, ...(domain ? { domain } : {}) }
}

/** Auth.js session cookie — first-party navigations (SameSite=Lax) */
export function authJsCookieOptions(): CookieOpts {
  const { secure, domain } = baseCookieContext()
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure,
    ...(domain ? { domain } : {}),
  }
}

/**
 * OAuth PKCE / state / nonce / callbackUrl — must survive Google/Apple return.
 * Apple uses response_mode=form_post (cross-site POST); SameSite=Lax cookies are dropped →
 * Auth.js falls back to site home (bongtour.com/). simplyur app Google/Apple hit this.
 * REGRESSION-FREEZE[auth-js-oauth-cookies-samesite-none]: OAuth cookies SameSite=None;Secure — manifest
 */
export function authJsOAuthCookieOptions(): CookieOpts {
  const { secure, domain } = baseCookieContext()
  // SameSite=None requires Secure; on http localhost keep Lax
  if (!secure) {
    return authJsCookieOptions()
  }
  return {
    httpOnly: true,
    sameSite: 'none',
    path: '/',
    secure: true,
    ...(domain ? { domain } : {}),
  }
}

export function authJsCookiePrefix(): string {
  return authJsCookieOptions().secure ? '__Secure-' : ''
}
