import type { Metadata } from 'next'
import Header from './components/Header'
import MainHero from './components/MainHero'
import HomeHubFour from './components/home/HomeHubFour'
import { HomeHubCardDebugServerPanel } from './components/home/HomeHubCardDebugServerPanel'
import { pickHomeHubTravelCardCover } from '@/lib/home-hub-travel-card-cover'
import { getHomeHubCardHybridResolutionDetail } from '@/lib/home-hub-card-hybrid-core'
import { getHomeHubActiveFile } from '@/lib/home-hub-resolve-images'
import HomeMobileHub from './components/home/HomeMobileHub'
import { getSeasonCurationSlidesForMobileHome } from '@/lib/home-season-pick'
import PartnerOrganizationsSection from './components/home/PartnerOrganizationsSection'
import SiteJsonLd from '@/app/components/seo/SiteJsonLd'
import { SITE_NAME } from '@/lib/site-metadata'

/** `home-hub-active.json` 갱신이 빌드 없이 메인에 반영되도록(정적 프리렌더 고정 방지). */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '해외·국내 여행 상품 안내',
  description:
    '해외·국내 패키지와 여행 상품을 둘러보고, 출발 일정과 안내를 확인하세요. 예약·상담은 문의를 통해 순차 안내됩니다.',
  alternates: { canonical: '/' },
  openGraph: {
    title: `${SITE_NAME} — 해외·국내 여행`,
    description:
      '해외·국내 패키지와 여행 상품을 둘러보고, 출발 일정과 안내를 확인하세요. 예약·상담은 문의를 통해 순차 안내됩니다.',
    url: '/',
  },
}

/** 메인: 밝은 헤더 + 통합 라이트 상단 + 비주얼 허브 (하단 회사정보는 전역 SiteFooter) */
export default async function Home() {
  /** 해외·국내 스코프 혼선 추적을 쉽게 하기 위해 순차 호출(결과는 각각 overseas / domestic 전용). */
  const overseasCover = await pickHomeHubTravelCardCover('overseas')
  const domesticCover = await pickHomeHubTravelCardCover('domestic')

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

  const homeSeasonSlides = await getSeasonCurationSlidesForMobileHome()

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
          <PartnerOrganizationsSection />
        </div>
      </main>
    </div>
  )
}
