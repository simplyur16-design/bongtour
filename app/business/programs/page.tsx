import type { Metadata } from 'next'
import TrainingProgramsCatalog from '@/components/training/TrainingProgramsCatalog'
import { listPublishedTrainingPrograms } from '@/lib/overseas-training-program-query'
import {
  buildTrainingProgramsListJsonLd,
  buildTrainingProgramsListMetadata,
  jsonLdScriptHtml,
  TRAINING_PROGRAMS_TITLE,
} from '@/lib/seo/training-json-ld'

export const revalidate = 300

// REGRESSION-FREEZE[seo-training-og-jsonld]: 페이지별 og(홈 기본값 금지)·BreadcrumbList+ItemList — manifest
export const metadata: Metadata = {
  ...buildTrainingProgramsListMetadata(),
  title: { absolute: TRAINING_PROGRAMS_TITLE },
}

type Props = {
  searchParams: Promise<{ audience?: string; category?: string }>
}

export default async function BusinessProgramsPage({ searchParams }: Props) {
  const sp = await searchParams
  const programs = await listPublishedTrainingPrograms({ limit: 100 })

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScriptHtml(buildTrainingProgramsListJsonLd(programs)) }}
      />
      <TrainingProgramsCatalog
        programs={programs}
        initialAudience={sp.audience ?? null}
        initialCategory={sp.category ?? null}
      />
    </>
  )
}
