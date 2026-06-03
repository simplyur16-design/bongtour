'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useRef, type ComponentProps, type ReactNode } from 'react'
import {
  saveProductDetailCardPreview,
  type ProductDetailCardPreview,
} from '@/lib/product-detail-card-preview'

type Props = Omit<ComponentProps<typeof Link>, 'href' | 'prefetch'> & {
  href: string
  preview: ProductDetailCardPreview
  children: ReactNode
}

const HOVER_PREFETCH_MS = 400

/**
 * 상품 상세 — 목록에서 viewport prefetch 끔(자유여행 등 다수 카드 시 RSC 폭주 방지).
 * 마우스 hover 시에만 지연 prefetch + 클릭 시 카드 preview 저장.
 */
export default function ProductDetailNavLink({
  href,
  preview,
  children,
  onClick,
  onMouseEnter,
  ...rest
}: Props) {
  const router = useRouter()
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancelHoverPrefetch = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
  }, [])

  const scheduleHoverPrefetch = useCallback(() => {
    cancelHoverPrefetch()
    hoverTimerRef.current = setTimeout(() => {
      hoverTimerRef.current = null
      router.prefetch(href)
    }, HOVER_PREFETCH_MS)
  }, [cancelHoverPrefetch, router, href])

  return (
    <Link
      href={href}
      prefetch={false}
      scroll
      onMouseEnter={(e) => {
        scheduleHoverPrefetch()
        onMouseEnter?.(e)
      }}
      onMouseLeave={cancelHoverPrefetch}
      onClick={(e) => {
        cancelHoverPrefetch()
        saveProductDetailCardPreview({ ...preview, href, savedAt: Date.now() })
        onClick?.(e)
      }}
      {...rest}
    >
      {children}
    </Link>
  )
}
