import type { Metadata } from 'next'
import TrainingProgramsCatalog from '@/components/training/TrainingProgramsCatalog'
import { listPublishedTrainingPrograms } from '@/lib/overseas-training-program-query'
import { SITE_NAME } from '@/lib/site-metadata'

export const revalidate = 300

export const metadata: Metadata = {
  title: `국외연수 프로그램 | ${SITE_NAME}`,
  description: '공무·기업 국외연수 프로그램 카탈로그. 가격은 상담 후 안내합니다.',
  alternates: { canonical: '/business/programs' },
}

type Props = {
  searchParams: Promise<{ audience?: string; category?: string }>
}

export default async function BusinessProgramsPage({ searchParams }: Props) {
  const sp = await searchParams
  const programs = await listPublishedTrainingPrograms({ limit: 100 })

  return (
    <TrainingProgramsCatalog
      programs={programs}
      initialAudience={sp.audience ?? null}
      initialCategory={sp.category ?? null}
    />
  )
}
