'use client'

import type { ReactNode } from 'react'
import { useProductDetailTransition } from '@/components/products/product-detail-transition-context'

/** 본문 로드 후 서버 히어로 청크 제거 — Header·히어로 중복 방지 */
export default function ProductDetailHeroSlot({ children }: { children: ReactNode }) {
  const { serverReady } = useProductDetailTransition()
  if (serverReady) return null
  return children
}
