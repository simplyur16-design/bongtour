'use client'

import { useEffect, useLayoutEffect, type ReactNode } from 'react'
import {
  clearProductDetailCardPreview,
  productIdFromDetailPathSegment,
} from '@/lib/product-detail-card-preview'
import {
  ProductDetailTransitionProvider,
  useProductDetailTransition,
} from '@/components/products/product-detail-transition-context'

function ProductDetailTransitionShellInner({
  idOrSlug,
  children,
}: {
  idOrSlug: string
  children: ReactNode
}) {
  const productId = productIdFromDetailPathSegment(idOrSlug)
  const { serverReady } = useProductDetailTransition()

  useLayoutEffect(() => {
    window.scrollTo(0, 0)
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual'
    }
  }, [idOrSlug])

  // REGRESSION-FREEZE[product-detail-departure-url-no-searchparams]: InstantFromCard 오버레이 금지 — 히어로·카드 깜빡임
  // 목록 카드 UI ≠ 상세 히어로/가격 카드 → 덮었다 걷히면 사진·카드가 통째로 교체되어 보임.
  useEffect(() => {
    if (serverReady) clearProductDetailCardPreview(productId)
  }, [serverReady, productId])

  return (
    <div className="relative min-h-[72vh]">
      <div className="relative z-[1]">{children}</div>
    </div>
  )
}

/** 상세 진입 스크롤·로딩 플래그. 카드 preview 오버레이는 쓰지 않음(히어로 깜빡임). */
export default function ProductDetailTransitionShell({
  idOrSlug,
  userAgent: _userAgent,
  children,
}: {
  idOrSlug: string
  userAgent: string | null
  children: ReactNode
}) {
  return (
    <ProductDetailTransitionProvider>
      <ProductDetailTransitionShellInner idOrSlug={idOrSlug}>{children}</ProductDetailTransitionShellInner>
    </ProductDetailTransitionProvider>
  )
}
