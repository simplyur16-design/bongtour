'use client'

import ProductHeroCarousel from '@/app/components/detail/ProductHeroCarousel'
import PackageProductHeroInfoPanel, {
  type PackageProductHeroInfoPanelProps,
} from '@/app/components/detail/PackageProductHeroInfoPanel'
import { ProductHeroTitleLines } from '@/app/components/detail/product-detail-visual'
import {
  resolvePublicDetailHeroTitles,
  formatPublicDestinationDisplayLabel,
  scrubKrDepartureFromPlaceLabel,
} from '@/lib/bongtour-product-display-title-ssot'

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
  primaryRegion?: string | null
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
  primaryRegion,
  infoPanel,
  onChangeDepartureDate,
  showChangeDepartureCta,
  modetourStickyLocalPayLine,
}: Props) {
  // REGRESSION-FREEZE[public-detail-hero-short-listing]: 히어로 short · 옆 원 상품명 — manifest
  const heroTitles = resolvePublicDetailHeroTitles({
    title: productTitle,
    duration: infoPanel.duration || infoPanel.durationLabel,
    primaryDestination: primaryDestination ?? null,
    destination: destination ?? null,
    primaryRegion: primaryRegion ?? null,
  })
  // REGRESSION-FREEZE[public-card-no-kr-departure-place]: SEO 칩·dest 출발허브 제거 — manifest
  const seoOverlayScrubbed = heroImageSeoKeywordOverlay
    ? (() => {
        // REGRESSION-FREEZE[public-card-hero-short-title]: The Rocks 등 EN 키워드≠상품명 — manifest
        const raw = String(heroImageSeoKeywordOverlay || '').trim()
        if (/\bThe\s+Rocks\b/i.test(raw) || /^the\s+rocks\b/i.test(raw)) return null
        const s = scrubKrDepartureFromPlaceLabel(raw)
        return s || null
      })()
    : null
  const infoPanelWithCta: PackageProductHeroInfoPanelProps = {
    ...infoPanel,
    title: heroTitles.listingTitle,
    destination: formatPublicDestinationDisplayLabel(infoPanel.destination),
    primaryDestination: primaryDestination ?? infoPanel.primaryDestination ?? null,
    onChangeDepartureDate,
    showChangeDepartureCta,
    modetourStickyLocalPayLine,
  }
  return (
    <section className="relative w-full overflow-hidden" aria-label="상품 소개">
      <div className="relative w-full h-[min(46vh,380px)] min-h-[220px] sm:h-[min(52vh,440px)] sm:min-h-[300px] lg:h-[70vh] lg:min-h-[520px] lg:max-h-[720px]">
        <div
          className="absolute inset-0 z-[1]"
          style={{ filter: 'brightness(1.06) contrast(1.12) saturate(1.20)' }}
        >
          <ProductHeroCarousel
            heroUrl={heroUrl}
            daySlides={daySlides}
            productTitle={heroTitles.heroTitle}
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

        {seoOverlayScrubbed ? (
          <div className="absolute left-3 top-3 z-[35] lg:left-4">
            <span className="inline-flex items-center gap-1 rounded-md border border-white/25 bg-white/15 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
              {seoOverlayScrubbed}
            </span>
          </div>
        ) : null}

        <div className="absolute inset-x-0 bottom-0 z-[25] pointer-events-none lg:bottom-16 lg:left-8 lg:right-auto lg:inset-x-auto lg:pb-0">
          <div className="mx-auto w-full max-w-7xl px-6 pb-14 pr-6 text-white lg:mx-0 lg:max-w-xl lg:px-0 lg:pb-0 lg:pr-8 lg:pl-8 xl:pl-16">
            <div className="max-w-xl pointer-events-auto">
              <ProductHeroTitleLines
                title={heroTitles.heroTitle}
                style={{ textShadow: '0 2px 12px rgba(31,27,45,0.6)' }}
              />
              {heroTitles.heroSubtitle ? (
                <p
                  className="mt-2 text-sm font-medium text-white/90 sm:text-base"
                  style={{ textShadow: '0 2px 10px rgba(31,27,45,0.55)' }}
                >
                  {heroTitles.heroSubtitle}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {/* REGRESSION-FREEZE[public-detail-hero-info-card-inset]: max-h=히어로 기준 — 100vh 중앙배치로 위·아래 잘림 금지 — manifest */}
        <aside className="absolute right-6 top-1/2 z-[30] hidden max-h-[calc(100%-3rem)] w-[420px] -translate-y-1/2 overflow-y-auto overscroll-contain rounded-2xl bg-white p-5 shadow-xl lg:block xl:right-12 xl:w-[460px]">
          <PackageProductHeroInfoPanel {...infoPanelWithCta} showTitle />
        </aside>
      </div>

      <div className="relative z-[30] mx-4 -mt-14 rounded-2xl bg-white p-5 shadow-lg sm:-mt-12 sm:p-6 lg:hidden">
        <PackageProductHeroInfoPanel {...infoPanelWithCta} showTitle />
      </div>
    </section>
  )
}
