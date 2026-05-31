'use client'

import ProductHeroCarousel from '@/app/components/detail/ProductHeroCarousel'
import FitItineraryHeroInfoPanel, {
  type FitItineraryHeroInfoPanelProps,
} from '@/app/components/detail/FitItineraryHeroInfoPanel'
import { ProductHeroTitleLines } from '@/app/components/detail/product-detail-visual'

type CarouselProps = {
  heroUrl: string | null
  daySlides: Parameters<typeof ProductHeroCarousel>[0]['daySlides']
  productTitle: string
  heroImageSourceType?: string | null
  heroImagePhotographer?: string | null
  heroImageIsGenerated?: boolean | null
  heroImageSeoKeywordOverlay?: string | null
  primaryDestination?: string | null
  destination?: string | null
}

type Props = CarouselProps & {
  infoPanel: Omit<
    FitItineraryHeroInfoPanelProps,
    'onChangeDepartureDate' | 'showChangeDepartureCta' | 'modetourStickyLocalPayLine'
  >
  onChangeDepartureDate: () => void
  showChangeDepartureCta?: boolean
  modetourStickyLocalPayLine?: string | null
  supplierLabel?: string | null
  airtelRegionLine?: string | null
  onScrollToExampleItinerary?: () => void
}

/** 자유여행 상세 — 패키지와 동일 풀폭 히어로 + 좌측 제목 + 우측 정보 카드(데스크톱) / 모바일 스택 */
export default function FitItineraryHeroSection({
  heroUrl,
  daySlides,
  productTitle,
  heroImageSourceType,
  heroImagePhotographer,
  heroImageIsGenerated,
  heroImageSeoKeywordOverlay,
  primaryDestination,
  destination,
  infoPanel,
  onChangeDepartureDate,
  showChangeDepartureCta,
  modetourStickyLocalPayLine,
  supplierLabel,
  airtelRegionLine,
  onScrollToExampleItinerary,
}: Props) {
  const infoPanelWithCta: FitItineraryHeroInfoPanelProps = {
    ...infoPanel,
    onChangeDepartureDate,
    showChangeDepartureCta,
    modetourStickyLocalPayLine,
  }
  return (
    <section className="relative w-full overflow-hidden" aria-label="상품 소개">
      <div
        className="relative w-full"
        style={{ height: '70vh', minHeight: '520px', maxHeight: '720px' }}
      >
        <div
          className="absolute inset-0 z-[1]"
          style={{ filter: 'brightness(1.06) contrast(1.12) saturate(1.20)' }}
        >
          <ProductHeroCarousel
            heroUrl={heroUrl}
            daySlides={daySlides}
            productTitle={productTitle}
            heroImageSourceType={heroImageSourceType ?? null}
            heroImagePhotographer={heroImagePhotographer ?? null}
            heroImageIsGenerated={heroImageIsGenerated ?? null}
            heroImageSeoKeywordOverlay={heroImageSeoKeywordOverlay ?? null}
            primaryDestination={primaryDestination ?? null}
            destination={destination ?? null}
            fillParent
            className="absolute inset-0 h-full w-full rounded-none border-0 shadow-none"
          />
        </div>

        <div
          className="pointer-events-none absolute inset-0 z-[10] bg-gradient-to-r from-black/45 via-black/15 to-black/30"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 z-[10]"
          style={{
            background:
              'linear-gradient(to top, rgba(31,27,45,0.55) 0%, rgba(31,27,45,0.20) 40%, transparent 70%)',
          }}
          aria-hidden
        />

        {heroImageSeoKeywordOverlay ? (
          <div className="absolute left-3 top-3 z-[35] lg:left-4">
            <span className="inline-flex items-center gap-1 rounded-md border border-white/25 bg-white/15 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
              {heroImageSeoKeywordOverlay}
            </span>
          </div>
        ) : null}

        <div className="absolute inset-x-0 bottom-0 z-[25] pointer-events-none">
          <div className="mx-auto w-full max-w-7xl px-6 pb-14 pr-6 text-white lg:px-8 lg:pb-20 lg:pr-48">
            <div className="max-w-4xl pointer-events-auto">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-[#d9a81e] px-3 py-1 text-xs font-bold text-[#1F1B2D] shadow-md md:text-sm">
                  예시일정
                </span>
                {supplierLabel ? (
                  <span className="inline-flex items-center rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm md:text-sm">
                    {supplierLabel}
                  </span>
                ) : null}
                {airtelRegionLine ? (
                  <span
                    className="text-sm font-semibold text-white md:text-base"
                    style={{ textShadow: '0 2px 12px rgba(31,27,45,0.6)' }}
                  >
                    {airtelRegionLine}
                  </span>
                ) : null}
              </div>

              <ProductHeroTitleLines
                title={productTitle}
                className="max-w-xl text-2xl font-bold leading-[1.35] tracking-[0.02em] sm:text-3xl lg:text-4xl lg:leading-[1.35]"
                style={{ textShadow: '0 2px 12px rgba(31,27,45,0.6)' }}
              />

              {onScrollToExampleItinerary ? (
                <button
                  type="button"
                  onClick={onScrollToExampleItinerary}
                  className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-[#d9a81e] px-5 py-2.5 text-[15px] font-bold tracking-wide text-white shadow-md transition hover:bg-[#c89619] md:gap-2 md:px-6 md:py-3 md:text-[18px]"
                >
                  예시일정보기
                  <span aria-hidden className="text-[0.9em] leading-none">
                    →
                  </span>
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <aside className="absolute right-6 top-1/2 z-[30] hidden max-h-[min(760px,calc(100vh-96px))] w-[420px] -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-5 shadow-xl lg:block xl:right-12 xl:w-[460px]">
          <FitItineraryHeroInfoPanel {...infoPanelWithCta} showTitle={false} />
        </aside>
      </div>

      <div className="relative z-[30] mx-4 -mt-8 rounded-2xl bg-white p-6 shadow-lg lg:hidden">
        <FitItineraryHeroInfoPanel {...infoPanelWithCta} showTitle />
      </div>
    </section>
  )
}
