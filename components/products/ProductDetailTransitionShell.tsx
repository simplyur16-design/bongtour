'use client'

import { useLayoutEffect, useState, type ReactNode } from 'react'
import {
  productIdFromDetailPathSegment,
  readProductDetailCardPreview,
  type ProductDetailCardPreview,
} from '@/lib/product-detail-card-preview'
import { isMobileUserAgent } from '@/lib/product-detail-viewport-from-ua'
import ProductDetailInstantFromCard from '@/components/products/ProductDetailInstantFromCard'
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

  return (
    <>
      {showCardOverlay && preview ? (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-bt-page overscroll-none">
          <ProductDetailInstantFromCard preview={preview} isMobile={isMobileUa} />
        </div>
      ) : null}
      {/* invisible 대신 hidden — 부분 스트림 높이로 스크롤 튐 방지 */}
      <div className={serverReady ? undefined : 'hidden'}>{children}</div>
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
