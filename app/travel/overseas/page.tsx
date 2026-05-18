import type { Metadata } from 'next'
import { Suspense } from 'react'
import Header from '@/app/components/Header'
import OverseasHero from '@/app/components/travel/overseas/OverseasHero'
import OverseasInteractiveShell from '@/app/components/travel/overseas/OverseasInteractiveShell'
import OverseasManagedContent from '@/app/components/travel/overseas/OverseasManagedContent'
import OverseasRegionMegaNav from '@/app/components/travel/overseas/OverseasRegionMegaNav'
import ProductsBrowseClient from '@/components/products/ProductsBrowseClient'
import { getCachedOverseasHubSeasonDestinationHeroSlides } from '@/lib/overseas-hub-season-destination-hero'
import type { OverseasEditorialBriefingPayload } from '@/lib/overseas-editorial-prioritize'
import {
  editorialRowToBriefingPayload,
  fetchPublishedOverseasEditorials,
  prioritizeEditorialsByRegionAndCountry,
} from '@/lib/overseas-editorial-prioritize'
import { resolveOverseasGeoFilterBanner } from '@/lib/overseas-destination-browse'
import { ogImagesForMetadata } from '@/lib/og-images-db'
import { SITE_NAME } from '@/lib/site-metadata'

/** 해외 허브 히어로 스포트라이트용 — 지방출발 3종만 서버에서 `OverseasHero`로 전달 */
const LOCAL_DEPARTURE_REGIONS = ['busan_dep', 'cheongju_dep', 'daegu_dep'] as const

export const revalidate = 300

export async function generateMetadata(): Promise<Metadata> {
  const images = await ogImagesForMetadata('overseas', `해외여행 상품 | ${SITE_NAME}`)
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

export default async function OverseasTravelPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const perfPage = process.env.BONGTOUR_PERF_LOG === '1' // PERF-LOG: 측정 후 제거
  const tPage0 = perfPage ? performance.now() : 0 // PERF-LOG: 측정 후 제거
  const sp = (await searchParams) ?? {}
  const region = typeof sp.region === 'string' ? sp.region : null
  const country = typeof sp.country === 'string' ? sp.country : null
  const overseasGeoFilterBanner = await resolveOverseasGeoFilterBanner(sp)
  const selectedRegionSlug =
    region && (LOCAL_DEPARTURE_REGIONS as readonly string[]).includes(region) ? region : null

  const [editorialAll, seasonDestinationHeroSlides] = await Promise.all([
    fetchPublishedOverseasEditorials().catch(
      (): Awaited<ReturnType<typeof fetchPublishedOverseasEditorials>> => [],
    ),
    getCachedOverseasHubSeasonDestinationHeroSlides(),
  ])

  let overseasEditorialBriefing: OverseasEditorialBriefingPayload | null = null
  try {
    const prioritized = prioritizeEditorialsByRegionAndCountry(editorialAll, region, country)
    overseasEditorialBriefing = editorialRowToBriefingPayload(prioritized[0], 220)
  } catch {
    // 목록은 브리핑 없이 표시
  }

  if (perfPage) {
    console.log(
      '[page-rsc-perf]',
      JSON.stringify({ route: '/travel/overseas', rscRenderMs: Math.round(performance.now() - tPage0) }),
    ) // PERF-LOG: 측정 후 제거
  }

  return (
    <div className="min-h-screen bg-bt-page">
      <Header />
      <OverseasRegionMegaNav />
      <main>
        <OverseasHero
          selectedCountrySlug={country}
          selectedRegionSlug={selectedRegionSlug}
          seasonDestinationHeroSlides={seasonDestinationHeroSlides}
        />

        <Suspense fallback={<p className="py-16 text-center text-sm text-slate-500">상품을 불러오는 중…</p>}>
          <ProductsBrowseClient
            basePath="/travel/overseas"
            defaultScope="overseas"
            pageTitle="해외여행 상품"
            hidePageHeading
            overseasEditorialBriefing={overseasEditorialBriefing}
            overseasGeoFilterBanner={overseasGeoFilterBanner}
          />
        </Suspense>

        <OverseasInteractiveShell
          postProductSlot={
            <>
              <OverseasManagedContent
                region={region}
                country={country}
                omitEditorialSection
              />
            </>
          }
        />
      </main>
    </div>
  )
}
