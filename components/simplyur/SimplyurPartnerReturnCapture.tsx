'use client'

/**
 * Affiliate return bridge — simplyurtrip → simplyur checkout → back.
 * REGRESSION-FREEZE[simplyur-affiliate-return]: capture return_to for partner — keep allowlist tight.
 */

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

export const SIMPLYUR_PARTNER_RETURN_KEY = 'simplyur_partner_return_to'

type PartnerReturnPayload = {
  returnTo: string
  partner: string | null
  at: number
}

function isAllowedReturnUrl(raw: string): boolean {
  try {
    const u = new URL(raw)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false

    const host = u.hostname.toLowerCase()
    const port = u.port || (u.protocol === 'https:' ? '443' : '80')

    // Production trip app (brand: simplyurtrip, domain: simplyur.com)
    if (host === 'simplyur.com' || host === 'www.simplyur.com') {
      return u.protocol === 'https:'
    }

    // Local simplyurtrip (port 3010)
    if (
      (host === 'localhost' || host === '127.0.0.1') &&
      (port === '3010' || u.port === '3010')
    ) {
      return true
    }

    // Optional extra origins: comma-separated full origins
    const extra = (process.env.NEXT_PUBLIC_SIMPLYURTRIP_RETURN_ORIGINS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    for (const origin of extra) {
      try {
        if (new URL(origin).origin === u.origin) return true
      } catch {
        /* ignore bad env entry */
      }
    }

    return false
  } catch {
    return false
  }
}

export function SimplyurPartnerReturnCapture() {
  const searchParams = useSearchParams()

  useEffect(() => {
    const returnTo = (searchParams?.get('return_to') ?? '').trim()
    const partner = (searchParams?.get('partner') ?? '').trim()
    if (!returnTo || !isAllowedReturnUrl(returnTo)) return
    try {
      const payload: PartnerReturnPayload = {
        returnTo,
        partner: partner || null,
        at: Date.now(),
      }
      sessionStorage.setItem(SIMPLYUR_PARTNER_RETURN_KEY, JSON.stringify(payload))
    } catch {
      /* ignore */
    }
  }, [searchParams])

  return null
}

export function readSimplyurPartnerReturn(): PartnerReturnPayload | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(SIMPLYUR_PARTNER_RETURN_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PartnerReturnPayload
    const href = (parsed.returnTo ?? '').trim()
    if (!href || !isAllowedReturnUrl(href)) return null
    return { ...parsed, returnTo: href }
  } catch {
    return null
  }
}

export function readSimplyurPartnerReturnTo(): string | null {
  return readSimplyurPartnerReturn()?.returnTo ?? null
}

export function clearSimplyurPartnerReturn(): void {
  try {
    sessionStorage.removeItem(SIMPLYUR_PARTNER_RETURN_KEY)
  } catch {
    /* ignore */
  }
}
