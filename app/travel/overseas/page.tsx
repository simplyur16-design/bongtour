import type { Metadata } from 'next'
import { Suspense } from 'react'
import Header from '@/app/components/Header'
import OverseasBrowseSlot from '@/app/components/travel/overseas/OverseasBrowseSlot'
import OverseasHeroLoading from '@/app/components/travel/overseas/OverseasHeroLoading'
import OverseasHeroSlot from '@/app/components/travel/overseas/OverseasHeroSlot'
import OverseasInteractiveShell from '@/app/components/travel/overseas/OverseasInteractiveShell'
import OverseasManagedContent from '@/app/components/travel/overseas/OverseasManagedContent'
import OverseasRegionMegaNav from '@/app/components/travel/overseas/OverseasRegionMegaNav'
import { ogImagesForMetadata } from '@/lib/og-images-db'
import { SITE_NAME } from '@/lib/site-metadata'

// REGRESSION-FREEZE[overseas-hub-isr-cdn]: force-static + no request query await — private no-store 금지 — manifest
/** 요청 query 미사용 → CDN/Full Route Cache. ?region=&country= 는 클라 URL SSOT. */
export const dynamic = 'force-static'
export const revalidate = 300

export async function generateMetadata(): Promise<Metadata> {
  let images: Awaited<ReturnType<typeof ogImagesForMetadata>> = []
  try {
    images = await ogImagesForMetadata('overseas', `해외여행 상품 | ${SITE_NAME}`)
  } catch (e) {
    console.error('[overseas-page] generateMetadata og image failed', e)
  }
  return {
    title: '해외여행 상품',
    description:
      '해외 패키지 상품을 지역·조건에 맞게 찾아보세요. 출발 일정과 안내는 상품별로 확인할 수 있으며, 예약·상담은 문의를 통해 안내됩니다.',
    alternates: { canonical: '/travel/overseas' },
    openGraph: {
      title: `해외여행 | ${SITE_NAME}`,
      description:
        '해외 패키지 상품을 지역·조건에 맞게 찾아보세요. 출발 일정과 안내는 상품별로 확인할 수 있습니다.',
      url: '/travel/overseas',
      type: 'website',
      images,
    },
    twitter: { card: 'summary_large_image' },
  }
}

export default async function OverseasTravelPage() {
  return (
    <div className="min-h-screen bg-bt-page">
      <Header />
      <OverseasRegionMegaNav />
      <main>
        <Suspense fallback={<OverseasHeroLoading />}>
          <OverseasHeroSlot
            selectedCountrySlug={null}
            selectedRegionSlug={null}
            initialSearchParamsString=""
          />
        </Suspense>

        <OverseasBrowseSlot />

        <OverseasInteractiveShell
          postProductSlot={
            <Suspense fallback={null}>
              <OverseasManagedContent omitEditorialSection omitMonthlyCuration />
            </Suspense>
          }
        />
      </main>
    </div>
  )
}
