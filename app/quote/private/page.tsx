import type { Metadata } from 'next'
import Header from '@/app/components/Header'
import PrivateQuoteFormEntry from '@/components/top-nav/PrivateQuoteFormEntry'
import { SITE_NAME } from '@/lib/site-metadata'

export const metadata: Metadata = {
  title: '단독 맞춤 견적',
  description:
    '원하시는 일정·지역 기준으로 단독 여행 견적 문의를 접수합니다. 확인 후 순차적으로 안내드립니다.',
  alternates: { canonical: '/quote/private' },
  openGraph: {
    title: `단독 맞춤 견적 | ${SITE_NAME}`,
    description: '맞춤 일정·지역 기준 단독 여행 견적 문의.',
    url: '/quote/private',
    type: 'website',
  },
  twitter: { card: 'summary_large_image' },
}

export default function PrivateQuotePage() {
  return (
    <div className="min-h-screen bg-base-muted">
      <Header />
      <PrivateQuoteFormEntry />
    </div>
  )
}
