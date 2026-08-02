import type { Metadata } from 'next'
import Header from './components/Header'
import { HomeHubCardDebugServerPanel } from './components/home/HomeHubCardDebugServerPanel'
import { getCachedHomeHubTravelCardCover } from '@/lib/home-page-data-cached'
import { getHomeHubCardHybridResolutionDetail } from '@/lib/home-hub-card-hybrid-core'
import { getHomeHubActiveFile } from '@/lib/home-hub-resolve-images'
import SeasonCurationHero from './components/home/SeasonCurationHero'
import SeasonProductGrid from './components/home/SeasonProductGrid'
import HomeTrustSection from './components/home/HomeTrustSection'
import PersonaCuratedDestinations from './components/home/PersonaCuratedDestinations'
import AirHotelProductGrid from './components/home/AirHotelProductGrid'
import ServiceInfoCards from './components/home/ServiceInfoCards'
import CustomerReviewsSection from './components/home/CustomerReviewsSection'
import SiteJsonLd from '@/app/components/seo/SiteJsonLd'
import { HOME_PAGE_DESCRIPTION, HOME_PAGE_TITLE } from '@/lib/home-page-metadata'
import { ogImagesForMetadata } from '@/lib/og-images-db'
import { getSeasonalDefaultOgImagePath } from '@/lib/og-image-seasonal'
import { SITE_NAME } from '@/lib/site-metadata'

/** 5분 ISR — request headers 미사용 → CDN/Full Route Cache 가능. 모바일은 middleware가 `/m`으로 rewrite. */
export const revalidate = 300

export async function generateMetadata(): Promise<Metadata> {
  let images: Awaited<ReturnType<typeof ogImagesForMetadata>> = [
    { url: getSeasonalDefaultOgImagePath(), width: 1200, height: 630, alt: SITE_NAME },
  ]
  try {
    images = await ogImagesForMetadata('default', SITE_NAME)
  } catch (e) {
    console.error('[home-page] generateMetadata og image failed', e)
  }
  return {
    title: { absolute: HOME_PAGE_TITLE },
    description: HOME_PAGE_DESCRIPTION,
    alternates: { canonical: '/' },
    openGraph: {
      type: 'website',
      locale: 'ko_KR',
      siteName: SITE_NAME,
      title: HOME_PAGE_TITLE,
      description: HOME_PAGE_DESCRIPTION,
      url: '/',
      images,
    },
    twitter: {
      card: 'summary_large_image',
      title: HOME_PAGE_TITLE,
      description: HOME_PAGE_DESCRIPTION,
      images: images.map((i) => i.url),
    },
  }
}

/** 메인 PC 트리 — 모바일 UA는 middleware rewrite → `app/m/page.tsx` */
export default async function Home() {
  // REGRESSION-FREEZE[home-cold-skip-hub-cover-pool]: prod skips product_pool cover scan — manifest
  // REGRESSION-FREEZE[home-single-device-ssr]: desktop tree only; mobile at /m — manifest
  let overseasCover: Awaited<ReturnType<typeof getCachedHomeHubTravelCardCover>> = null
  let overseasDetail: ReturnType<typeof getHomeHubCardHybridResolutionDetail> =
    getHomeHubCardHybridResolutionDetail('overseas', {
      activeSnapshot: null,
      productPoolOverseasUrl: null,
      productPoolDomesticUrl: null,
    })

  if (process.env.NODE_ENV !== 'production') {
    try {
      overseasCover = await getCachedHomeHubTravelCardCover('overseas')
    } catch (e) {
      console.error('[Home] overseas hub cover', e)
    }

    const hubActive = getHomeHubActiveFile()
    const hubSnap = hubActive ? { images: hubActive.images, imageSourceModes: hubActive.imageSourceModes } : null
    try {
      overseasDetail = getHomeHubCardHybridResolutionDetail('overseas', {
        activeSnapshot: hubSnap,
        productPoolOverseasUrl: overseasCover?.imageSrc ?? null,
        productPoolDomesticUrl: null,
      })
    } catch (e) {
      console.error('[Home] overseas hub detail', e)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-bt-page">
      <SiteJsonLd />
      <Header hideMobileNav />
      <main className="flex-1">
        <section
          className="relative overflow-x-hidden bg-gradient-to-b from-white via-bt-bg-lavender-soft to-bt-bg-lavender/80"
          aria-label="Bong투어 메인 소개 및 서비스 허브"
        >
          <div
            className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_90%_60%_at_15%_-10%,rgba(143,122,200,0.11),transparent_50%)]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_70%_50%_at_90%_10%,rgba(167,139,200,0.09),transparent_45%)]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.55)_0%,transparent_50%)]"
            aria-hidden
          />
          <SeasonCurationHero sectionId="season-curation-main" />
          <SeasonProductGrid />
          <div className="relative border-t border-bt-border-soft/80 bg-gradient-to-b from-bt-bg-lavender-soft/70 to-transparent pt-3 md:pt-4">
            <HomeHubCardDebugServerPanel overseasPick={overseasCover} overseasDetail={overseasDetail} />
          </div>
        </section>
        <PersonaCuratedDestinations />
        <AirHotelProductGrid />
        <ServiceInfoCards />
        <HomeTrustSection />
        <CustomerReviewsSection />
      </main>
    </div>
  )
}
