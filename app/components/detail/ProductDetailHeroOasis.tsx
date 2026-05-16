'use client'

import type { ReactNode } from 'react'
import ProductHeroCarousel from '@/app/components/detail/ProductHeroCarousel'
import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'
import {
  SUBPAGE_CARD_IMAGE_GRADIENT_CLASS,
  SUBPAGE_CARD_IMAGE_WASH_CLASS,
} from '@/lib/subpage-design-system'

type CarouselProps = {
  heroUrl: string | null
  daySlides: Parameters<typeof ProductHeroCarousel>[0]['daySlides']
  productTitle?: string
  heroImageSourceType?: string | null
  heroImageIsGenerated?: boolean | null
  heroImageSeoKeywordOverlay?: string | null
  primaryDestination?: string | null
  destination?: string | null
}

type Props = CarouselProps & {
  children: ReactNode
  onPrimaryCta?: () => void
  primaryCtaLabel?: string
}

/** 상품 상세 데스크톱 — 풀폭 히어로 + 좌측 카피·CTA (오아시스 패턴) */
export default function ProductDetailHeroOasis({
  children,
  onPrimaryCta,
  primaryCtaLabel = '실시간 견적 · 문의',
  ...carousel
}: Props) {
  return (
    <section className="relative w-full overflow-hidden bg-bt-text-navy" aria-label="상품 소개">
      <div className="relative min-h-[min(52vw,420px)] w-full lg:min-h-[460px]">
        <ProductHeroCarousel
          {...carousel}
          fillParent
          className="absolute inset-0 h-full w-full rounded-none border-0 shadow-none"
        />
        <div className={SUBPAGE_CARD_IMAGE_WASH_CLASS} aria-hidden />
        <div
          className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-r from-black/85 via-black/50 to-black/15 lg:via-black/40 lg:to-transparent"
          aria-hidden
        />
        <div className={SUBPAGE_CARD_IMAGE_GRADIENT_CLASS} aria-hidden />
        <div
          className={`${SITE_CONTENT_CLASS} relative z-10 flex min-h-[min(52vw,420px)] flex-col justify-end pb-8 pt-20 lg:min-h-[460px] lg:justify-center lg:pb-12 lg:pt-24`}
        >
          <div className="max-w-xl text-white">{children}</div>
          {onPrimaryCta ? (
            <div className="mt-6 max-w-xl">
              <button
                type="button"
                onClick={onPrimaryCta}
                className="inline-flex w-full items-center justify-center rounded-full bg-bt-coral px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-bt-coral/90 sm:w-auto"
              >
                {primaryCtaLabel}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
