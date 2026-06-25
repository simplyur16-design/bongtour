/**
 * 메인 시즌 큐레이션(+1/+2/+3월 MonthlyCurationContent) — 6h 캐시.
 */
import { unstable_cache } from 'next/cache'
import { shouldSkipDbAtBuild } from '@/lib/build-time-db'
import { prisma } from '@/lib/prisma'
import { getSeoulYearMonthNow } from '@/lib/monthly-curation'
import { getPublishedOverseasMonthlyCurationsForMonth } from '@/lib/home-season-pick'
import type { HomeSeasonPickDTO } from '@/lib/home-season-pick-shared'

export function shiftSeoulYearMonth(yearMonth: string, deltaMonths: number): string {
  const [yStr, mStr] = yearMonth.split('-')
  let y = Number(yStr)
  let m = Number(mStr) - 1 + deltaMonths
  y += Math.floor(m / 12)
  m = ((m % 12) + 12) % 12
  return `${y}-${String(m + 1).padStart(2, '0')}`
}

async function loadNextThreeMonthsSlidesUncached(): Promise<HomeSeasonPickDTO[]> {
  if (shouldSkipDbAtBuild()) return []
  const base = getSeoulYearMonthNow()
  const m1 = shiftSeoulYearMonth(base, 1)
  const m2 = shiftSeoulYearMonth(base, 2)
  const m3 = shiftSeoulYearMonth(base, 3)
  const [a, b, c] = await Promise.all([
    getPublishedOverseasMonthlyCurationsForMonth(m1),
    getPublishedOverseasMonthlyCurationsForMonth(m2),
    getPublishedOverseasMonthlyCurationsForMonth(m3),
  ])

  return [...a, ...b, ...c]
}

/** `unstable_cache` revalidateTag SSOT (publish cron·수동 무효화) */
export const SEASON_CURATION_HERO_CACHE_TAG = 'season-curation-hero-slides-v2'
export const SEASON_CURATION_NEXT_THREE_MONTHS_CACHE_TAG = 'season-curation-next-three-months-v1'

const HERO_MAX_PER_MONTH = 5

/** PC 히어로: +1·+2·+3월 각 최대 5건(최대 15장). */
async function loadHeroSlidesUncached(): Promise<HomeSeasonPickDTO[]> {
  if (shouldSkipDbAtBuild()) return []
  const base = getSeoulYearMonthNow()
  const m1 = shiftSeoulYearMonth(base, 1)
  const m2 = shiftSeoulYearMonth(base, 2)
  const m3 = shiftSeoulYearMonth(base, 3)
  const [raw1, raw2, raw3] = await Promise.all([
    getPublishedOverseasMonthlyCurationsForMonth(m1),
    getPublishedOverseasMonthlyCurationsForMonth(m2),
    getPublishedOverseasMonthlyCurationsForMonth(m3),
  ])

  const a = raw1.slice(0, HERO_MAX_PER_MONTH)
  const b = raw2.slice(0, HERO_MAX_PER_MONTH)
  const c = raw3.slice(0, HERO_MAX_PER_MONTH)
  return [...a, ...b, ...c].slice(0, HERO_MAX_PER_MONTH * 3)
}

export const getCachedSeasonCurationHeroSlides = unstable_cache(
  async () => loadHeroSlidesUncached(),
  [SEASON_CURATION_HERO_CACHE_TAG],
  { revalidate: 21_600, tags: [SEASON_CURATION_HERO_CACHE_TAG] },
)

export const getCachedSeasonCurationNextThreeMonthsSlides = unstable_cache(
  async () => loadNextThreeMonthsSlidesUncached(),
  [SEASON_CURATION_NEXT_THREE_MONTHS_CACHE_TAG],
  { revalidate: 21_600, tags: [SEASON_CURATION_NEXT_THREE_MONTHS_CACHE_TAG] },
)

async function loadSeasonLinkedProductIdsUncached(): Promise<string[]> {
  if (shouldSkipDbAtBuild()) return []
  const base = getSeoulYearMonthNow()
  const m1 = shiftSeoulYearMonth(base, 1)
  const m2 = shiftSeoulYearMonth(base, 2)
  const rows = await prisma.monthlyCurationContent.findMany({
    where: {
      pageScope: 'overseas',
      isPublished: true,
      monthKey: { in: [m1, m2] },
      linkedProductId: { not: null },
    },
    select: { linkedProductId: true },
  })
  const out: string[] = []
  const seen = new Set<string>()
  for (const r of rows) {
    const id = (r.linkedProductId ?? '').trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

export const getCachedSeasonLinkedProductIds = unstable_cache(
  async () => loadSeasonLinkedProductIdsUncached(),
  ['season-linked-product-ids-v1'],
  { revalidate: 21_600 },
)
