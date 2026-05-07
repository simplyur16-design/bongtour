'use client'

import { useEffect } from 'react'
import { persistUtmToSession, readUtmFromUrl } from '@/lib/utm-capture'

export default function UtmCaptureProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const params = new URLSearchParams(window.location.search)
      const fromUrl = readUtmFromUrl(params)
      const referrer =
        typeof document !== 'undefined' && document.referrer ? document.referrer.trim().slice(0, 2000) : undefined
      const landingPath = `${window.location.pathname}${window.location.search}`.slice(0, 2000)
      persistUtmToSession({
        ...(fromUrl ?? {}),
        ...(referrer ? { referrer } : {}),
        landingPath,
      })
    } catch {
      /* ignore */
    }
  }, [])
  return <>{children}</>
}
