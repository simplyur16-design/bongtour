import type { Metadata } from 'next'
import Link from 'next/link'
import Header from '@/app/components/Header'
import OverseasTravelSubMainNav from '@/app/components/travel/overseas/OverseasTravelSubMainNav'
import { SITE_NAME, absoluteUrl } from '@/lib/site-metadata'

export const metadata: Metadata = {
  title: '투어&액티비티',
  description: '현지 투어·액티비티 일정을 상담으로 맞춰 안내합니다.',
  alternates: { canonical: '/travel/overseas/tours-activities' },
  openGraph: {
    title: `투어&액티비티 | ${SITE_NAME}`,
    description: '현지 투어·액티비티 상담 안내',
    url: absoluteUrl('/travel/overseas/tours-activities'),
    type: 'website',
  },
}

export default function ToursActivitiesPage() {
  return (
    <div className="min-h-screen bg-bt-page">
      <Header />
      <OverseasTravelSubMainNav variant="links" />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">투어&액티비티</h1>
        <p className="mt-3 text-base leading-relaxed text-slate-700">
          일정·지역·인원에 맞는 현지 투어와 액티비티는 상품 구성과 예약 가능 여부를 함께 확인하는 것이 안전합니다. 원하시는
          지역이나 체험을 남겨 주시면 검토 후 연락드립니다.
        </p>
        <p className="mt-6">
          <Link
            href="/inquiry?type=travel"
            className="inline-flex items-center justify-center rounded-lg border border-teal-600 bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700"
          >
            여행 문의하기
          </Link>
        </p>
      </main>
    </div>
  )
}
