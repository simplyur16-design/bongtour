import type { Metadata } from 'next'
import TrainingHub from '@/app/components/training/TrainingHub'
import PartnerOrganizationsSectionGate from '@/app/components/home/PartnerOrganizationsSectionGate'
import { resolveTrainingPageSectionImages } from '@/lib/home-hub-resolve-images'
import { ogImagesForMetadata } from '@/lib/og-images-db'
import { SITE_NAME } from '@/lib/site-metadata'

/** `home-hub-active.json` 갱신이 곧바로 반영되도록(관리자 저장 후 새로고침 시 두 장 URL 일치) */
export const dynamic = 'force-dynamic'
export const revalidate = 300

export async function generateMetadata(): Promise<Metadata> {
  const images = await ogImagesForMetadata('training', `국외연수·단체 연수 | ${SITE_NAME}`)
  return {
    title: '국외연수·단체 연수',
    description:
      '기관·학교 단위 국외 연수 및 교육여행 관련 안내와 문의 접수. 일정·견적은 상담 후 안내됩니다.',
    alternates: { canonical: '/training' },
    openGraph: {
      title: `국외연수 | ${SITE_NAME}`,
      description: '국외 연수·교육여행 관련 안내와 문의 접수.',
      url: '/training',
      type: 'website',
      images,
    },
    twitter: { card: 'summary_large_image' },
  }
}

export default function TrainingPage() {
  const { hero, interpret } = resolveTrainingPageSectionImages()
  return (
    <>
      <TrainingHub heroImageUrl={hero} interpretImageUrl={interpret} />
      <PartnerOrganizationsSectionGate />
    </>
  )
}
