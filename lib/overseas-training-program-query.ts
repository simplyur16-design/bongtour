import { prisma } from '@/lib/prisma'
import { shouldSkipDbAtBuild } from '@/lib/build-time-db'
// REGRESSION-FREEZE[business-training-programs-empty-poison]: build skip OK — hub uses connection() — manifest
import {
  parseTrainingAudience,
  parseTrainingCategory,
  trainingAudienceMatchesFilter,
  type TrainingAudience,
  type TrainingCategory,
} from '@/lib/overseas-training-taxonomy'
import { shuffleTrainingProgramsByPeriod } from '@/lib/training-program-list-shuffle'

export const OVERSEAS_TRAINING_LISTING_KIND = 'overseas_training' as const

export const trainingProgramPublicSelect = {
  id: true,
  slug: true,
  title: true,
  originalTitle: true,
  destination: true,
  destinationRaw: true,
  primaryDestination: true,
  duration: true,
  bgImageUrl: true,
  bgImageIsGenerated: true,
  bgImageSource: true,
  bgImagePhotographer: true,
  summary: true,
  schedule: true,
  trainingDescription: true,
  prepChecklistJson: true,
  fixedDepartureWeekday: true,
  durationDays: true,
  trainingCategory: true,
  trainingAudience: true,
  originUrl: true,
} as const

export type TrainingProgramPublicRow = {
  id: string
  slug: string | null
  title: string
  originalTitle: string | null
  destination: string | null
  destinationRaw: string | null
  primaryDestination: string | null
  duration: string | null
  bgImageUrl: string | null
  bgImageIsGenerated: boolean
  bgImageSource: string | null
  bgImagePhotographer: string | null
  summary: string | null
  schedule: string | null
  trainingDescription: string | null
  prepChecklistJson: string | null
  fixedDepartureWeekday: number | null
  durationDays: number | null
  trainingCategory: string | null
  trainingAudience: string | null
  originUrl: string | null
}

export function trainingProgramPublicPath(row: { id: string; slug: string | null }): string {
  const slug = row.slug?.trim()
  return slug ? `/business/programs/${encodeURIComponent(slug)}` : `/business/programs/${row.id}`
}

export async function listPublishedTrainingPrograms(args?: {
  limit?: number
  audience?: TrainingAudience | null
  category?: TrainingCategory | null
}): Promise<TrainingProgramPublicRow[]> {
  if (shouldSkipDbAtBuild()) return []
  const limit = args?.limit ?? 50
  const poolCap = 100
  const rows = await prisma.product.findMany({
    where: {
      listingKind: OVERSEAS_TRAINING_LISTING_KIND,
      registrationStatus: 'registered',
    },
    select: trainingProgramPublicSelect,
    orderBy: [{ id: 'asc' }],
    take: poolCap,
  })

  const filtered = rows.filter((r) => {
    if (args?.category) {
      const c = parseTrainingCategory(r.trainingCategory)
      if (c !== args.category) return false
    }
    if (args?.audience && !trainingAudienceMatchesFilter(r.trainingAudience, args.audience)) {
      return false
    }
    return true
  }) as TrainingProgramPublicRow[]

  const shuffled = shuffleTrainingProgramsByPeriod(filtered)
  return shuffled.slice(0, Math.min(limit, poolCap))
}

export async function getPublishedTrainingProgramBySlugOrId(
  slugOrId: string
): Promise<TrainingProgramPublicRow | null> {
  const key = slugOrId.trim()
  if (!key) return null
  if (shouldSkipDbAtBuild()) return null

  const bySlug = await prisma.product.findFirst({
    where: {
      slug: key,
      listingKind: OVERSEAS_TRAINING_LISTING_KIND,
      registrationStatus: 'registered',
    },
    select: trainingProgramPublicSelect,
  })
  if (bySlug) return bySlug as TrainingProgramPublicRow

  const byId = await prisma.product.findFirst({
    where: {
      id: key,
      listingKind: OVERSEAS_TRAINING_LISTING_KIND,
      registrationStatus: 'registered',
    },
    select: trainingProgramPublicSelect,
  })
  return (byId as TrainingProgramPublicRow | null) ?? null
}

export function parsePrepChecklistJson(raw: string | null | undefined): Array<{
  title: string
  items: string[]
}> {
  if (!raw?.trim()) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null
        const o = entry as Record<string, unknown>
        const title = typeof o.title === 'string' ? o.title.trim() : ''
        const items = Array.isArray(o.items)
          ? o.items.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((s) => s.trim())
          : []
        if (!title && items.length === 0) return null
        return { title: title || '준비 사항', items }
      })
      .filter((x): x is { title: string; items: string[] } => Boolean(x))
  } catch {
    return []
  }
}
