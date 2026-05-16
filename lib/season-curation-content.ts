/**
 * 메인 시즌 큐레이션(+1/+2월 MonthlyCurationContent) — 6h 캐시.
 * 월별 행이 비면 발행 풀에서 보출한다.
 */
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getSeoulYearMonthNow } from '@/lib/monthly-curation'
import {
  getPublishedOverseasMonthlyCurationsForMonth,
  getPublishedOverseasSeasonCurationSlides,
} from '@/lib/home-season-pick'
import type { HomeSeasonPickDTO } from '@/lib/home-season-pick-shared'

export function shiftSeoulYearMonth(yearMonth: string, deltaMonths: number): string {
  const [yStr, mStr] = yearMonth.split('-')
  let y = Number(yStr)
  let m = Number(mStr) - 1 + deltaMonths
  y += Math.floor(m / 12)
  m = ((m % 12) + 12) % 12
  return `${y}-${String(m + 1).padStart(2, '0')}`
}

async function loadNextTwoMonthsSlidesUncached(): Promise<HomeSeasonPickDTO[]> {
  const base = getSeoulYearMonthNow()
  const m1 = shiftSeoulYearMonth(base, 1)
  const m2 = shiftSeoulYearMonth(base, 2)
  const [first, second] = await Promise.all([
    getPublishedOverseasMonthlyCurationsForMonth(m1),
    getPublishedOverseasMonthlyCurationsForMonth(m2),
  ])

  let a = [...first]
  let b = [...second]
  const used = new Set<string>([...a, ...b].map((s) => s.id))

  if (a.length === 0 || b.length === 0) {
    const pool = await getPublishedOverseasSeasonCurationSlides()
    if (a.length === 0) {
      a = pool.filter((p) => !used.has(p.id)).slice(0, 6)
      a.forEach((p) => used.add(p.id))
    }
    if (b.length === 0) {
      b = pool.filter((p) => !used.has(p.id)).slice(0, 6)
      b.forEach((p) => used.add(p.id))
    }
  }

  return [...a, ...b]
}

const HERO_MAX_PER_MONTH = 5

/** PC 히어로: +1월·+2월 각 최대 5건(최대 10장). 부족 시 발행 풀 보출. */
async function loadHeroSlidesUncached(): Promise<HomeSeasonPickDTO[]> {
  const base = getSeoulYearMonthNow()
  const m1 = shiftSeoulYearMonth(base, 1)
  const m2 = shiftSeoulYearMonth(base, 2)
  const [raw1, raw2] = await Promise.all([
    getPublishedOverseasMonthlyCurationsForMonth(m1),
    getPublishedOverseasMonthlyCurationsForMonth(m2),
  ])

  let a = raw1.slice(0, HERO_MAX_PER_MONTH)
  let b = raw2.slice(0, HERO_MAX_PER_MONTH)
  const used = new Set<string>([...a, ...b].map((s) => s.id))

  if (a.length === 0 || b.length === 0) {
    const pool = await getPublishedOverseasSeasonCurationSlides()
    if (a.length === 0) {
      a = pool.filter((p) => !used.has(p.id)).slice(0, HERO_MAX_PER_MONTH)
      a.forEach((p) => used.add(p.id))
    }
    if (b.length === 0) {
      b = pool.filter((p) => !used.has(p.id)).slice(0, HERO_MAX_PER_MONTH)
    }
  }

  return [...a, ...b].slice(0, HERO_MAX_PER_MONTH * 2)
}

export const getCachedSeasonCurationHeroSlides = unstable_cache(
  async () => loadHeroSlidesUncached(),
  ['season-curation-hero-slides-v1'],
  { revalidate: 21_600 },
)

export const getCachedSeasonCurationNextTwoMonthsSlides = unstable_cache(
  async () => loadNextTwoMonthsSlidesUncached(),
  ['season-curation-next-two-months-v1'],
  { revalidate: 21_600 },
)

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

export const getCachedSeasonLinkedProductIds = unstable_cache(
  async () => loadSeasonLinkedProductIdsUncached(),
  ['season-linked-product-ids-v1'],
  { revalidate: 21_600 },
)
