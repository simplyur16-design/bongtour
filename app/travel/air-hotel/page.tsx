import type { Metadata } from 'next'
import { Suspense } from 'react'
import Header from '@/app/components/Header'
import AirHotelBrowseSlot from '@/app/components/travel/air-hotel/AirHotelBrowseSlot'
import AirHotelHero from '@/app/components/travel/air-hotel/AirHotelHero'
import AirHotelHeroLoading from '@/app/components/travel/air-hotel/AirHotelHeroLoading'
import { getCachedAirHotelSeasonCuration } from '@/lib/air-hotel-season-curation-content'
import { SITE_NAME } from '@/lib/site-metadata'

// REGRESSION-FREEZE[air-hotel-hub-isr-cdn]: force-static + no request query await — private no-store 금지 — manifest
/** 요청 query 미사용 → CDN/Full Route Cache. ?scope=&type= 는 클라 URL SSOT. */
export const dynamic = 'force-static'
export const revalidate = 300

export const metadata: Metadata = {
  title: '항공+호텔',
  description:
    '항공과 호텔을 함께 준비하고, 추천일정까지 참고할 수 있는 자유여행 상품을 만나보세요.',
  alternates: { canonical: '/travel/air-hotel' },
  openGraph: {
    title: `항공+호텔 | ${SITE_NAME}`,
    description: '항공·호텔 중심 자유여행 상품',
    url: '/travel/air-hotel',
    type: 'website',
  },
}

async function AirHotelSeasonSection() {
  try {
    const data = await getCachedAirHotelSeasonCuration()
    return <AirHotelHero slides={data?.heroSlides ?? []} />
  } catch (e) {
    console.error('[AirHotelSeasonSection]', e)
    return <AirHotelHero slides={[]} />
  }
}

export default async function AirHotelPage() {
  return (
    <div className="min-h-screen bg-bt-page">
      <Header />
      <main>
        <Suspense fallback={<AirHotelHeroLoading />}>
          <AirHotelSeasonSection />
        </Suspense>

        <AirHotelBrowseSlot />
      </main>
    </div>
  )
}
