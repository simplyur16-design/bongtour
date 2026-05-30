import type { Metadata } from 'next'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import Header from '@/app/components/Header'
import AirHotelHero from '@/app/components/travel/air-hotel/AirHotelHero'
import ProductsBrowseClient from '@/components/products/ProductsBrowseClient'
import { getCachedAirHotelSeasonCuration } from '@/lib/air-hotel-season-curation-content'
import { SITE_NAME } from '@/lib/site-metadata'

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
  const data = await getCachedAirHotelSeasonCuration()
  return <AirHotelHero slides={data?.heroSlides ?? []} />
}

export default async function AirHotelPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const perfPage = process.env.BONGTOUR_PERF_LOG === '1' // PERF-LOG: 측정 후 제거
  const tPage0 = perfPage ? performance.now() : 0 // PERF-LOG: 측정 후 제거
  const sp = (await searchParams) ?? {}
  const scope = typeof sp.scope === 'string' ? sp.scope : null
  const type = typeof sp.type === 'string' ? sp.type : null
  if (!scope || !type) {
    redirect('/travel/air-hotel?scope=overseas&type=airtel')
  }
  if (scope !== 'overseas' && scope !== 'domestic') {
    const t = type === 'airtel' || type === 'free' ? type : 'airtel'
    redirect(`/travel/air-hotel?scope=overseas&type=${encodeURIComponent(t)}`)
  }

  if (perfPage) {
    console.log(
      '[page-rsc-perf]',
      JSON.stringify({ route: '/travel/air-hotel', rscRenderMs: Math.round(performance.now() - tPage0) }),
    ) // PERF-LOG: 측정 후 제거
  }

  return (
    <div className="min-h-screen bg-bt-page">
      <Header />
      <main>
        <Suspense fallback={null}>
          <AirHotelSeasonSection />
        </Suspense>

        <Suspense fallback={<p className="py-16 text-center text-sm text-slate-500">상품을 불러오는 중…</p>}>
          <ProductsBrowseClient
            basePath="/travel/air-hotel"
            defaultScope="overseas"
            pageTitle="항공+호텔"
            hidePageHeading
          />
        </Suspense>
      </main>
    </div>
  )
}
