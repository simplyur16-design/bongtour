import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import TrainingProgramDetailView from '@/components/training/TrainingProgramDetailView'
import { getPublishedTrainingProgramBySlugOrId } from '@/lib/overseas-training-program-query'
import { SITE_NAME } from '@/lib/site-metadata'
import {
  buildTrainingProgramJsonLd,
  buildTrainingProgramMetadata,
  jsonLdScriptHtml,
} from '@/lib/seo/training-json-ld'

export const revalidate = 300

type Props = {
  params: Promise<{ slug: string }>
}

// REGRESSION-FREEZE[seo-training-og-jsonld]: og:title·og:description·og:url 페이지별 + BreadcrumbList·TouristTrip — manifest
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const program = await getPublishedTrainingProgramBySlugOrId(slug)
  if (!program) return { title: { absolute: `프로그램 | ${SITE_NAME}` } }
  return buildTrainingProgramMetadata(program)
}

export default async function BusinessProgramDetailPage({ params }: Props) {
  const { slug } = await params
  const program = await getPublishedTrainingProgramBySlugOrId(slug)
  if (!program) notFound()

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScriptHtml(buildTrainingProgramJsonLd(program)) }}
      />
      <TrainingProgramDetailView program={program} />
    </>
  )
}
