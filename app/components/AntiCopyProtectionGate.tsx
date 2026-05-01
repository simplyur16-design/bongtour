'use client'

import { useAntiCopyProtection } from '@/lib/hooks/use-anti-copy-protection'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo } from 'react'

function isAntiCopyExcludedPath(pathname: string): boolean {
  const p = (pathname.split('?')[0] || '/').replace(/\/$/, '') || '/'
  if (p === '/admin' || p.startsWith('/admin/')) return true
  if (p === '/auth' || p.startsWith('/auth/')) return true
  if (p === '/api' || p.startsWith('/api/')) return true
  if (p === '/privacy' || p.startsWith('/privacy/')) return true
  if (p === '/terms' || p.startsWith('/terms/')) return true
  if (p === '/travel/esim/policy' || p.startsWith('/travel/esim/policy/')) return true
  return false
}

export default function AntiCopyProtectionGate() {
  const pathname = usePathname() ?? '/'
  const active = useMemo(() => !isAntiCopyExcludedPath(pathname), [pathname])

  useAntiCopyProtection(active)

  useEffect(() => {
    const root = document.documentElement
    if (active) root.setAttribute('data-anti-copy', 'on')
    else root.removeAttribute('data-anti-copy')
    return () => {
      root.removeAttribute('data-anti-copy')
    }
  }, [active])

  return null
}
