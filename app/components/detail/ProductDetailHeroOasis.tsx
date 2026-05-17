'use client'

import type { ReactNode } from 'react'
import ProductHeroCarousel from '@/app/components/detail/ProductHeroCarousel'

type CarouselProps = {
  heroUrl: string | null
  daySlides: Parameters<typeof ProductHeroCarousel>[0]['daySlides']
  productTitle?: string
  heroImageSourceType?: string | null
  heroImageIsGenerated?: boolean | null
  heroImageSeoKeywordOverlay?: string | null
  primaryDestination?: string | null
  destination?: string | null
  bgImagePhotographer?: string | null
}

type Props = CarouselProps & {
  children: ReactNode
  onPrimaryCta?: () => void
  primaryCtaLabel?: string
}

/** 상품 상세 데스크톱 — ItineraryView hero SSOT (components/itinerary/ItineraryView.tsx L169–214) */
export default function ProductDetailHeroOasis({
  children,
  onPrimaryCta,
  primaryCtaLabel = '실시간 견적 · 문의',
  bgImagePhotographer,
  ...carousel
}: Props) {
  const photographer = bgImagePhotographer?.trim() || null

  return (
    <section
      className="relative w-full overflow-hidden"
      aria-label="상품 소개"
      style={{ height: '70vh', minHeight: '520px', maxHeight: '720px' }}
    >
      <ProductHeroCarousel
        {...carousel}
        heroImagePhotographer={bgImagePhotographer ?? null}
        fillParent
        className="absolute inset-0 h-full w-full rounded-none border-0 shadow-none"
      />
      <div
        className="pointer-events-none absolute inset-0 z-[2]"
        style={{
          background:
            'linear-gradient(to top, rgba(31,27,45,0.75) 0%, rgba(31,27,45,0.30) 35%, rgba(31,27,45,0.10) 60%, transparent 80%)',
        }}
        aria-hidden
      />
      <div className="relative z-[3] flex h-full items-end">
        <div className="mx-auto w-full max-w-7xl px-6 pb-12 text-white lg:px-8 lg:pb-16">
          {children}
          {onPrimaryCta ? (
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onPrimaryCta}
                className="inline-flex items-center rounded-full bg-[#d9a81e] px-8 py-4 text-base font-semibold text-[#1F1B2D] transition hover:bg-[#c79a1c] md:text-lg"
              >
                {primaryCtaLabel} ↗
              </button>
            </div>
          ) : null}
        </div>
      </div>
      {photographer ? (
        <div className="absolute bottom-3 right-4 z-[4] text-[10px] text-white/60">
          Photo by {photographer} on Pexels
        </div>
      ) : null}
    </section>
  )
}
