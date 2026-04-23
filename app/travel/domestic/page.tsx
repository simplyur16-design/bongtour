import type { Metadata } from 'next'
import Header from '@/app/components/Header'
import DomesticHero from '@/app/components/travel/domestic/DomesticHero'
import { Suspense } from 'react'
import DomesticResultsShell from '@/app/components/travel/domestic/DomesticResultsShell'
import { ogImagesForMetadata } from '@/lib/og-images-db'
import { SITE_NAME } from '@/lib/site-metadata'

export const dynamic = 'force-dynamic'
export const revalidate = 300

export async function generateMetadata(): Promise<Metadata> {
  const images = await ogImagesForMetadata('domestic', `국내여행 상품 | ${SITE_NAME}`)
  return {
    title: '국내여행 상품',
    description:
      '국내 여행 상품을 둘러보고 일정·안내를 확인하세요. 예약·상담은 문의를 통해 순차 안내됩니다.',
    alternates: { canonical: '/travel/domestic' },
    openGraph: {
      title: `국내여행 | ${SITE_NAME}`,
      description: '국내 여행 상품을 둘러보고 일정·안내를 확인하세요.',
      url: '/travel/domestic',
      type: 'website',
      images,
    },
    twitter: { card: 'summary_large_image' },
  }
}

export default async function DomesticTravelPage() {
  return (
    <div className="min-h-screen bg-bt-page">
      <Header />
      <main>
        <DomesticHero />
        <Suspense fallback={<p className="py-16 text-center text-sm text-slate-500">상품을 불러오는 중…</p>}>
          <DomesticResultsShell />
        </Suspense>
      </main>
    </div>
  )
}
