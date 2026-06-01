'use client'

import { useMemo, type ReactNode } from 'react'
import {
  productIdFromDetailPathSegment,
  readProductDetailCardPreview,
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
  const preview = useMemo(() => readProductDetailCardPreview(productId), [productId])
  const { heroReady, serverReady } = useProductDetailTransition()

  const showInstant = Boolean(preview) && !heroReady && !serverReady
  const hideStreamed = showInstant

  return (
    <div className="relative min-h-screen bg-bt-page">
      {showInstant && preview ? (
        <div className="absolute inset-0 z-10 bg-bt-page">
          <ProductDetailInstantFromCard preview={preview} isMobile={isMobileUa} />
        </div>
      ) : null}
      <div className={hideStreamed ? 'invisible' : undefined} aria-busy={!serverReady}>
        {children}
      </div>
    </div>
  )
}

/** 목록 카드 preview + 서버 hero/본문 스트리밍 전환 */
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
