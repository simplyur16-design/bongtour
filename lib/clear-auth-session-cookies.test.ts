import { describe, expect, it } from 'vitest'
import { NextResponse } from 'next/server'
import { clearAllAuthSessionCookies } from '@/lib/clear-auth-session-cookies'
import {
  AUTH_SESSION_COOKIE_SECURE,
  CONSENT_PENDING_MARKER_COOKIE,
} from '@/lib/auth-session-cookie'

describe('clearAllAuthSessionCookies', () => {
  it('sets maxAge 0 clears for session and consent cookies', () => {
    const prevSite = process.env.NEXT_PUBLIC_SITE_URL
    process.env.NEXT_PUBLIC_SITE_URL = 'https://bongtour.com'
    const res = NextResponse.json({ ok: true })
    clearAllAuthSessionCookies(res)
    process.env.NEXT_PUBLIC_SITE_URL = prevSite

    const cleared = res.cookies.getAll().filter((c) => c.value === '')
    const names = cleared.map((c) => c.name)
    expect(names).toContain(AUTH_SESSION_COOKIE_SECURE)
    expect(names).toContain(CONSENT_PENDING_MARKER_COOKIE)
    expect(cleared.some((c) => c.domain === '.bongtour.com')).toBe(true)
    expect(cleared.length).toBeGreaterThanOrEqual(4)
  })
})
