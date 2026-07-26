'use client'

import Header from '@/app/components/Header'
import SafeImage from '@/app/components/SafeImage'
import { COVER_IMAGE_LIST_NEXT_QUALITY } from '@/lib/cover-image-quality'
import { isSrcOptimizableByNextImage } from '@/lib/is-src-optimizable-by-next-image'
import { formatOriginSourceForDisplay } from '@/lib/supplier-origin'
import type { ProductDetailCardPreview } from '@/lib/product-detail-card-preview'
import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'

/** 목록 카드와 동일한 정보 — pulse 스켈레톤 없음 */
export default function ProductDetailInstantFromCard({
  preview,
  isMobile,
}: {
  preview: ProductDetailCardPreview
  isMobile: boolean
}) {
  const imageUrl = preview.imageUrl?.trim() ?? ''
  const optimizable = Boolean(imageUrl) && isSrcOptimizableByNextImage(imageUrl)

  const body = (
    <div className={isMobile ? 'px-4 py-4 space-y-4' : `${SITE_CONTENT_CLASS} py-6 space-y-4`}>
      <p className="text-[11px] font-medium text-slate-500">
        {formatOriginSourceForDisplay(preview.originSource)}
      </p>
      <h1 className={isMobile ? 'text-xl font-bold text-slate-900' : 'text-2xl font-bold text-slate-900'}>
        {preview.title}
      </h1>
      {preview.primaryDestination ? (
        <p className="text-sm text-slate-600">{preview.primaryDestination}</p>
      ) : null}
      <div
        className={
          isMobile
            ? 'relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-slate-100'
            : 'relative aspect-[16/9] w-full max-h-[420px] overflow-hidden rounded-xl bg-slate-100'
        }
      >
        {imageUrl ? (
          <SafeImage
            src={imageUrl}
            alt=""
            fill
            className="object-cover"
            sizes={isMobile ? '100vw' : '(max-width: 1024px) 80vw, 960px'}
            priority
            quality={COVER_IMAGE_LIST_NEXT_QUALITY}
            {...(optimizable ? {} : { unoptimized: true })}
          />
        ) : null}
      </div>
      <div className="flex flex-wrap items-end justify-between gap-2">
        {preview.priceLabel ? (
          <span className="text-lg font-bold text-slate-900">{preview.priceLabel}</span>
        ) : null}
        {preview.duration ? <span className="text-sm text-slate-500">{preview.duration}</span> : null}
      </div>
    </div>
  )

  if (isMobile) {
    return (
      <>
        <Header />
        {body}
      </>
    )
  }

  return (
    <>
      <Header />
      {body}
    </>
  )
}
