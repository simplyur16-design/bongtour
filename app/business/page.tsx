import type { Metadata } from 'next'
import TrainingHub from '@/app/components/training/TrainingHub'
import PartnerOrganizationsSectionGate from '@/app/components/home/PartnerOrganizationsSectionGate'
import { resolveTrainingPageSectionImages } from '@/lib/home-hub-resolve-images'
import { ogImagesForMetadata } from '@/lib/og-images-db'
import { SITE_NAME } from '@/lib/site-metadata'

export const revalidate = 300

export async function generateMetadata(): Promise<Metadata> {
  const images = await ogImagesForMetadata('training', `공공·기업 연수·단체 | ${SITE_NAME}`)
  return {
    title: '공공·기업 연수·단체',
    description:
      '정부·공공·기업 목적의 국외 연수·교육여행 안내와 문의 접수. 연수·전세버스·발권·통역 운영은 상담 후 안내됩니다.',
    alternates: { canonical: '/business' },
    openGraph: {
      title: `공공·기업 | ${SITE_NAME}`,
      description: '공공·기업 연수·교육여행 관련 안내와 문의 접수.',
      url: '/business',
      type: 'website',
      images,
    },
    twitter: { card: 'summary_large_image' },
  }
}

/** 공공·기업·연수·전세버스·발권 — `/training`과 동일 허브 UI (`TrainingHub`). */
export default function BusinessPage() {
  const { hero, interpret } = resolveTrainingPageSectionImages()
  return (
    <>
      <TrainingHub heroImageUrl={hero} interpretImageUrl={interpret} />
      <PartnerOrganizationsSectionGate />
    </>
  )
}
