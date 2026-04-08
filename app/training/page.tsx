import type { Metadata } from 'next'
import TrainingHub from '@/app/components/training/TrainingHub'
import { SITE_NAME } from '@/lib/site-metadata'

export const metadata: Metadata = {
  title: '국외연수·단체 연수',
  description:
    '기관·학교 단위 국외 연수 및 교육여행 관련 안내와 문의 접수. 일정·견적은 상담 후 안내됩니다.',
  alternates: { canonical: '/training' },
  openGraph: {
    title: `국외연수 | ${SITE_NAME}`,
    description: '국외 연수·교육여행 관련 안내와 문의 접수.',
    url: '/training',
    type: 'website',
  },
  twitter: { card: 'summary_large_image' },
}

export default function TrainingPage() {
  return <TrainingHub />
}
