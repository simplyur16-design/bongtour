import type { Metadata } from 'next'
import nextDynamic from 'next/dynamic'
import Header from './components/Header'
import MainHero from './components/MainHero'

const HomeHubFour = nextDynamic(() => import('./components/home/HomeHubFour'), {
  ssr: false,
  loading: () => (
    <div
      className="mx-auto max-w-6xl px-3 py-6 sm:px-5"
      aria-hidden
    >
      <div className="grid min-h-[20rem] grid-cols-2 gap-3 rounded-2xl bg-slate-100/80 sm:gap-4 md:gap-5" />
    </div>
  ),
})
import { HomeHubCardDebugServerPanel } from './components/home/HomeHubCardDebugServerPanel'
import { pickHomeHubTravelCardCover } from '@/lib/home-hub-travel-card-cover'
import { getHomeHubCardHybridResolutionDetail } from '@/lib/home-hub-card-hybrid-core'
import { getHomeHubActiveFile } from '@/lib/home-hub-resolve-images'
import HomeMobileHub from './components/home/HomeMobileHub'
import { getSeasonCurationSlidesForMobileHome } from '@/lib/home-season-pick'
import { normalizeHomeSeasonSlidesForClient } from '@/lib/home-season-pick-shared'
import PartnerOrganizationsSectionGate from './components/home/PartnerOrganizationsSectionGate'
import SiteJsonLd from '@/app/components/seo/SiteJsonLd'
import { HOME_PAGE_DESCRIPTION, HOME_PAGE_TITLE } from '@/lib/home-page-metadata'

/** 5분 ISR — 허브 카드 풀·시즌 큐레이션은 최대 5분 지연 후 반영. */
export const revalidate = 300

export const metadata: Metadata = {
  title: { absolute: HOME_PAGE_TITLE },
  description: HOME_PAGE_DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: {
    title: HOME_PAGE_TITLE,
    description: HOME_PAGE_DESCRIPTION,
    url: '/',
  },
  twitter: {
    title: HOME_PAGE_TITLE,
    description: HOME_PAGE_DESCRIPTION,
  },
}

/** 메인: 밝은 헤더 + 통합 라이트 상단 + 비주얼 허브 (하단 회사정보는 전역 SiteFooter) */
export default async function Home() {
  const [overseasCover, domesticCover, homeSeasonSlidesRaw] = await Promise.all([
    pickHomeHubTravelCardCover('overseas'),
    pickHomeHubTravelCardCover('domestic'),
    getSeasonCurationSlidesForMobileHome(),
  ])
  const homeSeasonSlides = normalizeHomeSeasonSlidesForClient(homeSeasonSlidesRaw)

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
      <Header />
      <main className="flex-1">
        <section
          className="relative overflow-x-hidden bg-gradient-to-b from-white via-slate-50 to-slate-100/95"
          aria-label="Bong투어 메인 소개 및 서비스 허브"
        >
          <div
            className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_90%_60%_at_15%_-10%,rgba(56,189,248,0.12),transparent_50%)]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_70%_50%_at_90%_10%,rgba(15,118,110,0.08),transparent_45%)]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.55)_0%,transparent_50%)]"
            aria-hidden
          />
          <div className="block lg:hidden">
            <HomeMobileHub seasonSlides={homeSeasonSlides} />
          </div>
          <div className="hidden lg:block">
            <MainHero />
            <div className="relative border-t border-slate-200/70 bg-gradient-to-b from-slate-50/50 to-transparent pt-3 md:pt-4">
              <HomeHubFour
                overseasHubImageSrc={overseasCover?.imageSrc ?? null}
                domesticHubImageSrc={domesticCover?.imageSrc ?? null}
              />
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
          <PartnerOrganizationsSectionGate />
        </div>
      </main>
    </div>
  )
}
