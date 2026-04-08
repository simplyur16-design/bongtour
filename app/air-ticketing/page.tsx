import type { Metadata } from 'next'
import AirTicketingHub from '@/app/components/air-ticketing/AirTicketingHub'
import { SITE_NAME } from '@/lib/site-metadata'

export const metadata: Metadata = {
  title: '항공권 예매 및 발권',
  description:
    '항공권 예매·발권, 법인카드 결제, 증빙·현금영수증 안내. Bong투어는 항공 예약·발권 시스템을 활용해 항공권 예매를 진행할 수 있습니다.',
  alternates: { canonical: '/air-ticketing' },
  openGraph: {
    title: `항공권 예매 및 발권 | ${SITE_NAME}`,
    description:
      '항공권 예매·발권, 법인카드 결제, 증빙·현금영수증 안내를 확인하세요.',
    url: '/air-ticketing',
    type: 'website',
  },
  twitter: { card: 'summary_large_image' },
}

export default function AirTicketingPage() {
  return <AirTicketingHub />
}
