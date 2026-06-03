'use client'

import { useEffect, useLayoutEffect, useState, type ReactNode } from 'react'
import {
  clearProductDetailCardPreviewFor,
  productIdFromDetailPathSegment,
  readProductDetailCardPreview,
  type ProductDetailCardPreview,
} from '@/lib/product-detail-card-preview'
import { isMobileUserAgent } from '@/lib/product-detail-viewport-from-ua'
import ProductDetailInstantFromCard from '@/components/products/ProductDetailInstantFromCard'
import ProductDetailPageSkeleton from '@/components/products/ProductDetailPageSkeleton'
import {
  ProductDetailTransitionProvider,
  useProductDetailTransition,
} from '@/components/products/product-detail-transition-context'

function ProductDetailTransitionShellInner({
  idOrSlug,
  isMobileUa,
  children,
}: {
  idOrSlug: string
  isMobileUa: boolean
  children: ReactNode
}) {
  const productId = productIdFromDetailPathSegment(idOrSlug)
  const [preview, setPreview] = useState<ProductDetailCardPreview | null>(null)
  const { serverReady } = useProductDetailTransition()

  useLayoutEffect(() => {
    window.scrollTo(0, 0)
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual'
    }
  }, [idOrSlug])

  useLayoutEffect(() => {
    setPreview(readProductDetailCardPreview(productId))
  }, [productId])

  const showCardOverlay = Boolean(preview) && !serverReady

  useEffect(() => {
    if (serverReady && preview) {
      clearProductDetailCardPreviewFor(preview)
      setPreview(null)
    }
  }, [serverReady, preview])

  const showSkeleton = !serverReady && !showCardOverlay

  return (
    <>
      {showCardOverlay && preview ? (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-bt-page overscroll-none">
          <ProductDetailInstantFromCard preview={preview} isMobile={isMobileUa} />
        </div>
      ) : null}
      <div className="relative min-h-[72vh]">
        {showSkeleton ? (
          <div className="pointer-events-none absolute inset-0 z-[5]">
            <ProductDetailPageSkeleton />
          </div>
        ) : null}
        {/* hidden 제거 — 서버 HTML 즉시 노출, 스켈레톤은 hydration 전 보조 */}
        <div className="relative z-[1]">{children}</div>
      </div>
    </>
  )
}

/** 목록 카드 preview(고정 오버레이) → 서버 본문 1회 교체 */
export default function ProductDetailTransitionShell({
  idOrSlug,
  userAgent,
  children,
}: {
  idOrSlug: string
  userAgent: string | null
  children: ReactNode
}) {
  const isMobileUa = isMobileUserAgent(userAgent)

  return (
    <ProductDetailTransitionProvider>
      <ProductDetailTransitionShellInner idOrSlug={idOrSlug} isMobileUa={isMobileUa}>
        {children}
      </ProductDetailTransitionShellInner>
    </ProductDetailTransitionProvider>
  )
}
