'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, type ComponentProps, type ReactNode } from 'react'
import {
  saveProductDetailCardPreview,
  type ProductDetailCardPreview,
} from '@/lib/product-detail-card-preview'

type Props = Omit<ComponentProps<typeof Link>, 'href' | 'prefetch'> & {
  href: string
  preview: ProductDetailCardPreview
  children: ReactNode
}

/** 상품 상세 — prefetch + 카드 즉시 껍데기용 preview 저장 */
export default function ProductDetailNavLink({
  href,
  preview,
  children,
  onClick,
  onMouseEnter,
  onFocus,
  onTouchStart,
  ...rest
}: Props) {
  const router = useRouter()

  const warm = useCallback(() => {
    router.prefetch(href)
  }, [router, href])

  return (
    <Link
      href={href}
      prefetch
      scroll
      onMouseEnter={(e) => {
        warm()
        onMouseEnter?.(e)
      }}
      onFocus={(e) => {
        warm()
        onFocus?.(e)
      }}
      onTouchStart={(e) => {
        warm()
        onTouchStart?.(e)
      }}
      onClick={(e) => {
        saveProductDetailCardPreview({ ...preview, href, savedAt: Date.now() })
        onClick?.(e)
      }}
      {...rest}
    >
      {children}
    </Link>
  )
}
