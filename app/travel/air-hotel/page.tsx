import type { Metadata } from 'next'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import Header from '@/app/components/Header'
import OverseasTravelSubMainNav from '@/app/components/travel/overseas/OverseasTravelSubMainNav'
import ProductsBrowseClient from '@/components/products/ProductsBrowseClient'
import { SITE_NAME } from '@/lib/site-metadata'

export const dynamic = 'force-dynamic'

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

export default async function AirHotelPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
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

  return (
    <div className="min-h-screen bg-bt-page">
      <Header />
      <OverseasTravelSubMainNav variant="links" />
      <main>
        <section className="border-b border-bt-border bg-gradient-to-b from-slate-50 to-white">
          <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">항공+호텔</h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
              항공과 호텔을 함께 준비하고, 추천일정까지 참고할 수 있는 자유여행 상품을 만나보세요.
            </p>
          </div>
        </section>

        <Suspense fallback={<p className="py-16 text-center text-sm text-slate-500">상품을 불러오는 중…</p>}>
          <ProductsBrowseClient
            basePath="/travel/air-hotel"
            defaultScope="overseas"
            pageTitle="항공+호텔"
            hidePageHeading
          />
        </Suspense>

        <section className="border-t border-bt-border bg-slate-50">
          <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
            <h2 className="text-sm font-semibold text-slate-800">추천일정·안내</h2>
            <p className="mt-2 text-sm text-slate-600">
              상품별 추천일정·호텔·항공 구성은 상세 페이지에서 확인할 수 있습니다. 이 영역은 추후 큐레이션·추천 코스 연결용으로
              확장할 수 있습니다.
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}
