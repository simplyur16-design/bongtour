'use client'

import { useEffect } from 'react'
import { clearProductDetailCardPreview } from '@/lib/product-detail-card-preview'
import { ProductDetailServerReadySignal as MarkServerReady } from '@/components/products/product-detail-transition-context'

export default function ProductDetailServerReadySignal({ productId }: { productId: string }) {
  return (
    <>
      <MarkServerReady />
      <ClearPreviewOnReady productId={productId} />
    </>
  )
}

function ClearPreviewOnReady({ productId }: { productId: string }) {
  useEffect(() => {
    clearProductDetailCardPreview(productId)
  }, [productId])
  return null
}
