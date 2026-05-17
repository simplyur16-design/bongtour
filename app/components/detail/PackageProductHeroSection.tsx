'use client'

import ProductHeroCarousel from '@/app/components/detail/ProductHeroCarousel'
import PackageProductHeroInfoPanel, {
  type PackageProductHeroInfoPanelProps,
} from '@/app/components/detail/PackageProductHeroInfoPanel'
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
    PackageProductHeroInfoPanelProps,
    'onChangeDepartureDate' | 'showChangeDepartureCta' | 'modetourStickyLocalPayLine'
  >
  onChangeDepartureDate: () => void
  showChangeDepartureCta?: boolean
  modetourStickyLocalPayLine?: string | null
}

/** 패키지(travel/private/semi) 상세 — 풀폭 히어로 + 좌측 제목 + 우측 정보 카드(데스크톱) / 모바일 스택 */
export default function PackageProductHeroSection({
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
}: Props) {
  const infoPanelWithCta: PackageProductHeroInfoPanelProps = {
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

        <div className="absolute bottom-16 left-8 z-[20] hidden max-w-xl pr-8 lg:block lg:bottom-24 lg:left-16">
          <ProductHeroTitleLines
            title={productTitle}
            style={{ textShadow: '0 2px 12px rgba(31,27,45,0.6)' }}
          />
        </div>

        <aside className="absolute right-6 top-1/2 z-[30] hidden max-h-[min(760px,calc(100vh-96px))] w-[420px] -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-5 shadow-xl lg:block xl:right-12 xl:w-[460px]">
          <PackageProductHeroInfoPanel {...infoPanelWithCta} showTitle={false} />
        </aside>
      </div>

      <div className="relative z-[30] mx-4 -mt-8 rounded-2xl bg-white p-6 shadow-lg lg:hidden">
        <PackageProductHeroInfoPanel {...infoPanelWithCta} showTitle />
      </div>
    </section>
  )
}
