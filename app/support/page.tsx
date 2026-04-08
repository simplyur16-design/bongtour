import type { Metadata } from 'next'
import SupportHub from '@/app/components/support/SupportHub'
import { SITE_NAME } from '@/lib/site-metadata'

export const metadata: Metadata = {
  title: '고객지원',
  description:
    '진행 절차, 답변 채널, 전화 상담, 증빙·영수증 안내, 자주 묻는 질문을 한곳에서 확인하실 수 있습니다.',
  alternates: { canonical: '/support' },
  openGraph: {
    title: `고객지원 | ${SITE_NAME}`,
    description:
      '진행 절차, 답변 채널, 전화 상담, 증빙·영수증 안내, 자주 묻는 질문을 한곳에서 확인하실 수 있습니다.',
    url: '/support',
    type: 'website',
  },
  twitter: { card: 'summary_large_image' },
}

export default function SupportPage() {
  return <SupportHub />
}
