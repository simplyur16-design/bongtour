import type { Metadata } from 'next'
import { connection } from 'next/server'
import TrainingHub from '@/app/components/training/TrainingHub'
import TrainingProgramsPreview from '@/components/training/TrainingProgramsPreview'
import PartnerOrganizationsSectionGate from '@/app/components/home/PartnerOrganizationsSectionGate'
import { resolveTrainingPageSectionImages } from '@/lib/home-hub-resolve-images'
import { listPublishedTrainingPrograms } from '@/lib/overseas-training-program-query'
import { ogImagesForMetadata } from '@/lib/og-images-db'
import { SITE_NAME } from '@/lib/site-metadata'
import { buildBusinessHubJsonLd, jsonLdScriptHtml } from '@/lib/seo/training-json-ld'

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
      description: '지방의회·지자체·공공기관·기업 국외연수 — 연수기관 섭외, 일정 기획, 제안서, 설명회까지 상담 후 진행합니다.',
      url: '/business',
      type: 'website',
      images,
    },
    twitter: { card: 'summary_large_image' },
  }
}

/**
 * 공공·기업·연수·전세버스·발권 — `/training`과 동일 허브 UI (`TrainingHub`).
 * REGRESSION-FREEZE[business-training-programs-empty-poison]: page connection()+list — build-skip 빈 셸 고착 금지 — manifest
 */
export default async function BusinessPage() {
  // build 시 shouldSkipDbAtBuild → [] 가 Full Route Cache + SWR에 박히면 「준비 중」만 장시간 노출됨
  await connection()
  const programs = await listPublishedTrainingPrograms({ limit: 8 })
  const { hero } = resolveTrainingPageSectionImages()
  return (
    <>
      {/* REGRESSION-FREEZE[seo-training-og-jsonld]: /business 허브 BreadcrumbList+Service JSON-LD — manifest */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScriptHtml(buildBusinessHubJsonLd()) }} />
      <TrainingHub heroImageUrl={hero} programsSlot={<TrainingProgramsPreview programs={programs} />} />
      <PartnerOrganizationsSectionGate />
    </>
  )
}
