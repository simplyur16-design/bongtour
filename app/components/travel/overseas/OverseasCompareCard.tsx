'use client'

import Link from 'next/link'
import Image from 'next/image'
import type { GalleryProduct } from '@/app/api/gallery/route'
import { formatOriginSourceForDisplay } from '@/lib/supplier-origin'

function formatDate(iso: string | null): string {
  if (!iso) return '일정 협의'
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

function formatPrice(krw: number | null): string {
  if (krw == null || krw <= 0) return '문의'
  if (krw >= 10000) return `${Math.floor(krw / 10000).toLocaleString()}만원~`
  return `${krw.toLocaleString()}원~`
}

type Props = {
  product: GalleryProduct
  priority?: boolean
  /** 본문 하단 보조 유형 (패키지 / 자유·에어텔) — 사진 위에는 노출하지 않음 */
  productTypeLabel: string
}

/**
 * 해외 랜딩용 비교 카드 — 사진 위는 공급사만, 유형은 본문 보조.
 */
export default function OverseasCompareCard({ product, priority = false, productTypeLabel }: Props) {
  const priceStr = formatPrice(product.priceKrw)
  const hasPrice = product.priceKrw != null && product.priceKrw > 0
  const url = product.imageSet?.[0] ?? product.coverImageUrl
  const supplier = formatOriginSourceForDisplay(product.originSource)

  return (
    <article className="overflow-hidden rounded-xl border border-bt-border-soft bg-bt-surface shadow-sm transition hover:border-bt-link/35 hover:shadow-md">
      <div className="flex flex-col sm:flex-row">
        <Link href={`/products/${product.id}`} className="relative block shrink-0 sm:w-[200px] lg:w-[240px]">
          <div className="relative aspect-[16/10] w-full sm:aspect-auto sm:h-full sm:min-h-[168px]">
            <Image
              src={url}
              alt=""
              fill
              className="object-cover"
              sizes="(max-width:640px) 100vw, 240px"
              priority={priority}
            />
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/50 via-black/10 to-transparent"
              aria-hidden
            />
            <p className="absolute left-2.5 top-2.5 right-2 z-10 text-[10px] font-semibold leading-tight tracking-wide text-white drop-shadow-md">
              {supplier}
            </p>
          </div>
        </Link>
        <div className="flex min-w-0 flex-1 flex-col justify-between px-4 py-3 sm:py-4">
          <div>
            <Link href={`/products/${product.id}`}>
              <h3 className="line-clamp-2 text-base font-bold leading-snug tracking-tight text-bt-strong sm:text-lg">
                {product.title}
              </h3>
            </Link>
            <p className="mt-2 text-sm text-bt-muted">
              <span className="font-semibold text-bt-body">출발</span>{' '}
              <span className="text-bt-body">{formatDate(product.departureDate)}</span>
              <span className="mx-2 text-bt-disabled">|</span>
              <span className="font-semibold text-bt-body">일정</span>{' '}
              <span className="text-bt-body">{product.duration}</span>
            </p>
            {product.primaryDestination ? (
              <p className="mt-1 text-[11px] text-bt-meta">대표 목적지 · {product.primaryDestination}</p>
            ) : null}
          </div>

          <div className="mt-4 space-y-3 border-t border-bt-border-soft pt-3">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-bt-subtle">성인 1인 참고가</p>
              <p className={`mt-0.5 text-xl font-bold tracking-tight ${hasPrice ? 'text-bt-price' : 'text-bt-muted'}`}>
                {priceStr}
              </p>
              <p className="mt-1 text-[10px] text-bt-subtle">출발일·좌석에 따라 상이 · 상담 시 확정</p>
            </div>

            <p className="text-[11px] leading-relaxed text-bt-meta">
              혜택·무이자·할인 조건은 상담 시 확인해 주세요.
            </p>

            {productTypeLabel ? (
              <p className="text-[10px] text-bt-meta">
                <span className="font-medium text-bt-subtle">유형</span> · {productTypeLabel}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2 pt-1">
              <Link
                href={`/products/${product.id}`}
                className="inline-flex rounded-lg border border-bt-cta-secondary-border bg-bt-cta-secondary px-3 py-2 text-xs font-semibold text-bt-cta-secondary-text transition hover:bg-bt-surface-soft"
              >
                상세 보기
              </Link>
              <Link
                href={`/inquiry?type=travel&source=/travel/overseas&productHint=${encodeURIComponent(product.title.slice(0, 80))}`}
                className="inline-flex rounded-lg bg-bt-cta-primary px-3 py-2 text-xs font-semibold text-bt-cta-primary-fg transition hover:bg-bt-cta-primary-hover"
              >
                상담 신청
              </Link>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}
