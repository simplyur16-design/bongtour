'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { isProductDetailRouteLoading } from '@/components/products/product-detail-transition-context'
import SiteFooter from './SiteFooter'

/**
 * 공개 페이지 공통 푸터. /admin 제외.
 */
export default function ConditionalSiteFooter() {
  const pathname = usePathname() ?? ''
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    const sync = () => setDetailLoading(isProductDetailRouteLoading())
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-bt-detail-loading'],
    })
    return () => observer.disconnect()
  }, [pathname])

  if (pathname?.startsWith('/admin')) return null
  if (pathname?.startsWith('/simplyur')) return null
  if (detailLoading) return null
  return <SiteFooter />
}
