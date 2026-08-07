/**
 * 메인 시즌 큐레이션(+1/+2/+3월 MonthlyCurationContent).
 * REGRESSION-FREEZE[season-curation-keep-orphan-product-cards]: build empty must not poison Data Cache — manifest
 */
import { unstable_cache } from 'next/cache'
import { shouldSkipDbAtBuild } from '@/lib/build-time-db'
import { prisma } from '@/lib/prisma'
import { getSeoulYearMonthNow } from '@/lib/monthly-curation'
import { getPublishedOverseasMonthlyCurationsForMonth } from '@/lib/home-season-pick'
import type { HomeSeasonPickDTO } from '@/lib/home-season-pick-shared'
import { getCurrentCycle, type SeasonCurationCycle } from '@/lib/season-curation'

export function shiftSeoulYearMonth(yearMonth: string, deltaMonths: number): string {
  const [yStr, mStr] = yearMonth.split('-')
  let y = Number(yStr)
  let m = Number(mStr) - 1 + deltaMonths
  y += Math.floor(m / 12)
  m = ((m % 12) + 12) % 12
  return `${y}-${String(m + 1).padStart(2, '0')}`
}

async function loadNextThreeMonthsSlidesUncached(): Promise<HomeSeasonPickDTO[]> {
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

/** `unstable_cache` revalidateTag SSOT (publish cron·수동 무효화). v4: build empty 미캐시 */
export const SEASON_CURATION_HERO_CACHE_TAG = 'season-curation-hero-slides-v4'
export const SEASON_CURATION_NEXT_THREE_MONTHS_CACHE_TAG = 'season-curation-next-three-months-v4'

const HERO_MAX_PER_MONTH = 5

/** PC 히어로: +1·+2·+3월 각 최대 5건(최대 15장). */
async function loadHeroSlidesUncached(): Promise<HomeSeasonPickDTO[]> {
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

/** 30분 — 발행·상품 비공개 후 홈이 반나절 비는 것 방지 (태그 무효화가 SSOT) */
const SEASON_CURATION_CACHE_REVALIDATE_SEC = 1_800

const cachedHeroSlides = unstable_cache(
  async () => loadHeroSlidesUncached(),
  [SEASON_CURATION_HERO_CACHE_TAG],
  { revalidate: SEASON_CURATION_CACHE_REVALIDATE_SEC, tags: [SEASON_CURATION_HERO_CACHE_TAG] },
)

const cachedNextThreeMonthsSlides = unstable_cache(
  async () => loadNextThreeMonthsSlidesUncached(),
  [SEASON_CURATION_NEXT_THREE_MONTHS_CACHE_TAG],
  {
    revalidate: SEASON_CURATION_CACHE_REVALIDATE_SEC,
    tags: [SEASON_CURATION_NEXT_THREE_MONTHS_CACHE_TAG],
  },
)

/** build 단계 빈 배열이 Data Cache에 박히지 않도록 skip을 캐시 바깥에 둔다. */
export async function getCachedSeasonCurationHeroSlides(): Promise<HomeSeasonPickDTO[]> {
  if (shouldSkipDbAtBuild()) return []
  return cachedHeroSlides()
}

export async function getCachedSeasonCurationNextThreeMonthsSlides(): Promise<HomeSeasonPickDTO[]> {
  if (shouldSkipDbAtBuild()) return []
  return cachedNextThreeMonthsSlides()
}

async function loadSeasonLinkedProductIdsUncached(): Promise<string[]> {
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

const cachedSeasonLinkedProductIds = unstable_cache(
  async () => loadSeasonLinkedProductIdsUncached(),
  ['season-linked-product-ids-v2'],
  { revalidate: SEASON_CURATION_CACHE_REVALIDATE_SEC },
)

export async function getCachedSeasonLinkedProductIds(): Promise<string[]> {
  if (shouldSkipDbAtBuild()) return []
  return cachedSeasonLinkedProductIds()
}

/** 페르소나 등 — 매 요청 Prisma cycle 조회 방지 (홈 ISR과 맞춤 5분) */
export const SEASON_CURATION_CURRENT_CYCLE_CACHE_TAG = 'season-curation-current-cycle-v1'

const cachedCurrentCycle = unstable_cache(
  async (): Promise<SeasonCurationCycle> => getCurrentCycle(new Date()),
  [SEASON_CURATION_CURRENT_CYCLE_CACHE_TAG],
  { revalidate: 300, tags: [SEASON_CURATION_CURRENT_CYCLE_CACHE_TAG] },
)

export async function getCachedCurrentCycle(): Promise<SeasonCurationCycle> {
  if (shouldSkipDbAtBuild()) {
    return getCurrentCycle(new Date())
  }
  return cachedCurrentCycle()
}
