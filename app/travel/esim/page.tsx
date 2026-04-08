import type { Metadata } from 'next'
import Header from '@/app/components/Header'
import OverseasTravelSubMainNav from '@/app/components/travel/overseas/OverseasTravelSubMainNav'
import { SITE_NAME } from '@/lib/site-metadata'

export const metadata: Metadata = {
  title: 'E-sim',
  description: '여행 전 간편하게 준비하는 데이터 연결 상품입니다.',
  alternates: { canonical: '/travel/esim' },
  openGraph: {
    title: `E-sim | ${SITE_NAME}`,
    description: '여행용 E-sim',
    url: '/travel/esim',
    type: 'website',
  },
}

export default function EsimPage() {
  return (
    <div className="min-h-screen bg-bt-page">
      <Header />
      <OverseasTravelSubMainNav variant="links" />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">E-sim</h1>
        <p className="mt-4 text-base leading-relaxed text-slate-700">
          여행 전 간편하게 준비하는 데이터 연결 상품입니다.
        </p>
        <div
          className="mt-10 min-h-[12rem] rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/80 p-6 text-center text-sm text-slate-500"
          aria-label="E-sim 상품 영역 (준비 중)"
        >
          향후 API·상품 목록 연결 예정 영역입니다.
        </div>
      </main>
    </div>
  )
}
