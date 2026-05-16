import type { Metadata } from 'next'
import Header from './components/Header'
import { HomeHubCardDebugServerPanel } from './components/home/HomeHubCardDebugServerPanel'
import { pickHomeHubTravelCardCover } from '@/lib/home-hub-travel-card-cover'
import { getHomeHubCardHybridResolutionDetail } from '@/lib/home-hub-card-hybrid-core'
import { getHomeHubActiveFile } from '@/lib/home-hub-resolve-images'
import HomeMobileHub from './components/home/HomeMobileHub'
import SeasonCurationHero from './components/home/SeasonCurationHero'
import SeasonProductGrid from './components/home/SeasonProductGrid'
import HomeTrustSection from './components/home/HomeTrustSection'
import PersonaCuratedDestinations from './components/home/PersonaCuratedDestinations'
import AirHotelProductGrid from './components/home/AirHotelProductGrid'
import ServiceInfoCards from './components/home/ServiceInfoCards'
import CustomerReviewsSection from './components/home/CustomerReviewsSection'
import SiteJsonLd from '@/app/components/seo/SiteJsonLd'
import { HOME_PAGE_DESCRIPTION, HOME_PAGE_TITLE } from '@/lib/home-page-metadata'
import { DEFAULT_OG_IMAGE_PATH, SITE_NAME } from '@/lib/site-metadata'
import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'
import MobileDestinationSearch from './components/home/MobileDestinationSearch'

/** 5분 ISR — 허브 카드 풀·시즌 큐레이션은 최대 5분 지연 후 반영. */
export const revalidate = 300

export const metadata: Metadata = {
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
    images: [{ url: DEFAULT_OG_IMAGE_PATH, alt: SITE_NAME }],
  },
  twitter: {
    title: HOME_PAGE_TITLE,
    description: HOME_PAGE_DESCRIPTION,
  },
}

/** 메인: 밝은 헤더 + 시즌 히어로(PC) / 모바일 허브 + 추천·B2G·후기 */
export default async function Home() {
  const [overseasCover, domesticCover] = await Promise.all([
    pickHomeHubTravelCardCover('overseas'),
    pickHomeHubTravelCardCover('domestic'),
  ])

  const hubActive = getHomeHubActiveFile()
  const hubSnap = hubActive ? { images: hubActive.images, imageSourceModes: hubActive.imageSourceModes } : null
  const overseasDetail = getHomeHubCardHybridResolutionDetail('overseas', {
    activeSnapshot: hubSnap,
    productPoolOverseasUrl: overseasCover?.imageSrc ?? null,
    productPoolDomesticUrl: domesticCover?.imageSrc ?? null,
  })
  const domesticDetail = getHomeHubCardHybridResolutionDetail('domestic', {
    activeSnapshot: hubSnap,
    productPoolOverseasUrl: overseasCover?.imageSrc ?? null,
    productPoolDomesticUrl: domesticCover?.imageSrc ?? null,
  })

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
          <div className="block lg:hidden">
            <div className={SITE_CONTENT_CLASS}>
              <MobileDestinationSearch />
            </div>
            <HomeMobileHub />
            <HomeTrustSection />
            <CustomerReviewsSection />
          </div>
          <div className="hidden lg:block">
            <SeasonCurationHero sectionId="season-curation-main" />
            <SeasonProductGrid />
            <div className="relative border-t border-bt-border-soft/80 bg-gradient-to-b from-bt-bg-lavender-soft/70 to-transparent pt-3 md:pt-4">
              <HomeHubCardDebugServerPanel
                overseasPick={overseasCover}
                domesticPick={domesticCover}
                overseasDetail={overseasDetail}
                domesticDetail={domesticDetail}
              />
            </div>
          </div>
        </section>
        <div className="hidden lg:block">
          <PersonaCuratedDestinations />
          <AirHotelProductGrid />
          <ServiceInfoCards />
          <HomeTrustSection />
          <CustomerReviewsSection />
        </div>
      </main>
    </div>
  )
}
