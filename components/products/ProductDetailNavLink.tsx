'use client'

import Link from 'next/link'
import { type ComponentProps, type ReactNode } from 'react'
import {
  saveProductDetailCardPreview,
  type ProductDetailCardPreview,
} from '@/lib/product-detail-card-preview'

type Props = Omit<ComponentProps<typeof Link>, 'href' | 'prefetch'> & {
  href: string
  preview: ProductDetailCardPreview
  children: ReactNode
}

/**
 * 상품 상세 — viewport/touch/hover prefetch 없음(목록·2×2 캐러셀 다수 카드 시 RSC 폭주 방지).
 * 클릭 시 카드 preview만 저장.
 */
export default function ProductDetailNavLink({
  href,
  preview,
  children,
  onClick,
  ...rest
}: Props) {
  return (
    <Link
      href={href}
      prefetch={false}
      scroll
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
