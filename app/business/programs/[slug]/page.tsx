export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import TrainingProgramDetailView from '@/components/training/TrainingProgramDetailView'
import { getPublishedTrainingProgramBySlugOrId } from '@/lib/overseas-training-program-query'
import { SITE_NAME } from '@/lib/site-metadata'

export const revalidate = 300

type Props = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const program = await getPublishedTrainingProgramBySlugOrId(slug)
  if (!program) return { title: `프로그램 | ${SITE_NAME}` }
  return {
    title: `${program.title} | 국외연수 | ${SITE_NAME}`,
    description: '국외연수 프로그램 상세. 단체 연수 상담 후 견적 안내.',
    alternates: {
      canonical: program.slug
        ? `/business/programs/${encodeURIComponent(program.slug)}`
        : `/business/programs/${program.id}`,
    },
  }
}

export default async function BusinessProgramDetailPage({ params }: Props) {
  const { slug } = await params
  const program = await getPublishedTrainingProgramBySlugOrId(slug)
  if (!program) notFound()

  return <TrainingProgramDetailView program={program} />
}
