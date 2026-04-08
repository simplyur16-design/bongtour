import type { Metadata } from 'next'
import CharterBusLanding from '@/app/components/charter-bus/CharterBusLanding'
import { SITE_NAME } from '@/lib/site-metadata'

export const metadata: Metadata = {
  title: '전세버스',
  description:
    '단체·행사·관광 등 전세버스 이용 안내와 문의 접수. 일정·차량은 상담 후 확정됩니다.',
  alternates: { canonical: '/charter-bus' },
  openGraph: {
    title: `전세버스 | ${SITE_NAME}`,
    description: '단체·행사용 전세버스 이용 안내와 문의 접수.',
    url: '/charter-bus',
    type: 'website',
  },
  twitter: { card: 'summary_large_image' },
}

export default function CharterBusPage() {
  return <CharterBusLanding />
}
