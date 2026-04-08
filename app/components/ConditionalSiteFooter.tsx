'use client'

import { usePathname } from 'next/navigation'
import SiteFooter from './SiteFooter'

/**
 * 공개 페이지 공통 푸터. /admin 제외.
 */
export default function ConditionalSiteFooter() {
  const pathname = usePathname()
  if (pathname?.startsWith('/admin')) return null
  return <SiteFooter />
}
