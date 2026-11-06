/**
 * 메인 시즌 큐레이션(MonthlyCurationContent) — 홈 노출 월 SSOT.
 * KST 기준 현재 달(0) + 이후 +1/+2/+3. 생성 달만 빼고 미래만 보던 이전 동작은
 * 당월 발행 행이 있어도 홈/시즌 그리드가 비는 원인이었음.
 *
 * REGRESSION-FREEZE[season-curation-keep-orphan-product-cards]: build empty must not poison Data Cache — manifest
 */
import { unstable_cache } from 'next/cache'
import { shouldSkipDbAtBuild } from '@/lib/build-time-db'
import { prisma } from '@/lib/prisma'
import { getSeoulYearMonthNow } from '@/lib/monthly-curation'
import { getPublishedOverseasMonthlyCurationsForMonth } from '@/lib/home-season-pick'
import type { HomeSeasonPickDTO } from '@/lib/home-season-pick-shared'
import { getCurrentCycle, rehydrateSeasonCurationCycle, type SeasonCurationCycle } from '@/lib/season-curation'
import { readCachedArrayOrBypassEmpty } from '@/lib/unstable-cache-empty-bypass'

/** 홈 히어로·모바일 슬라이드: 당월 포함 +1/+2/+3 */
export const HOME_SEASON_SLIDE_MONTH_OFFSETS = [0, 1, 2, 3] as const

/** 시즌 연결 상품 그리드: 당월 + 다음 두 달 (기존 +1/+2에 당월 추가) */
export const HOME_SEASON_LINKED_PRODUCT_MONTH_OFFSETS = [0, 1, 2] as const

/** 자동 초안 생성·발행 cron이 맞출 월 범위 (슬라이드와 동일) */
export const HOME_SEASON_ENSURE_MONTH_OFFSETS = HOME_SEASON_SLIDE_MONTH_OFFSETS

export function shiftSeoulYearMonth(yearMonth: string, deltaMonths: number): string {
  const [yStr, mStr] = yearMonth.split('-')
  let y = Number(yStr)
  let m = Number(mStr) - 1 + deltaMonths
  y += Math.floor(m / 12)
  m = ((m % 12) + 12) % 12
  return `${y}-${String(m + 1).padStart(2, '0')}`
}

/** `base`(YYYY-MM) + offsets → 중복 없는 monthKey 목록 (테스트·로더·cron SSOT). */
export function homeSeasonMonthKeysFromBase(
  baseYearMonth: string,
  offsets: readonly number[] = HOME_SEASON_SLIDE_MONTH_OFFSETS,
): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const d of offsets) {
    if (!Number.isFinite(d)) continue
    const key = shiftSeoulYearMonth(baseYearMonth, d)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(key)
  }
  return out
}

export function getHomeSeasonSlideMonthKeys(nowYearMonth = getSeoulYearMonthNow()): string[] {
  return homeSeasonMonthKeysFromBase(nowYearMonth, HOME_SEASON_SLIDE_MONTH_OFFSETS)
}

export function getHomeSeasonLinkedProductMonthKeys(nowYearMonth = getSeoulYearMonthNow()): string[] {
  return homeSeasonMonthKeysFromBase(nowYearMonth, HOME_SEASON_LINKED_PRODUCT_MONTH_OFFSETS)
}

async function loadNextThreeMonthsSlidesUncached(): Promise<HomeSeasonPickDTO[]> {
  const monthKeys = getHomeSeasonSlideMonthKeys()
  const batches = await Promise.all(
    monthKeys.map((mk) => getPublishedOverseasMonthlyCurationsForMonth(mk)),
  )
  return batches.flat()
}

/** `unstable_cache` revalidateTag SSOT (publish cron·수동 무효화). v6: include current KST month */
export const SEASON_CURATION_HERO_CACHE_TAG = 'season-curation-hero-slides-v6'
export const SEASON_CURATION_NEXT_THREE_MONTHS_CACHE_TAG = 'season-curation-next-three-months-v6'

const HERO_MAX_PER_MONTH = 5

/** PC 히어로: 당월·+1·+2·+3 각 최대 5건. */
async function loadHeroSlidesUncached(): Promise<HomeSeasonPickDTO[]> {
  const monthKeys = getHomeSeasonSlideMonthKeys()
  const batches = await Promise.all(
    monthKeys.map((mk) => getPublishedOverseasMonthlyCurationsForMonth(mk)),
  )
  return batches
    .map((rows) => rows.slice(0, HERO_MAX_PER_MONTH))
    .flat()
    .slice(0, HERO_MAX_PER_MONTH * monthKeys.length)
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
  // Runtime empty poison (배포 레이스/DB blip) → uncached 재조회
  return readCachedArrayOrBypassEmpty(cachedHeroSlides, loadHeroSlidesUncached)
}

export async function getCachedSeasonCurationNextThreeMonthsSlides(): Promise<HomeSeasonPickDTO[]> {
  if (shouldSkipDbAtBuild()) return []
  return readCachedArrayOrBypassEmpty(cachedNextThreeMonthsSlides, loadNextThreeMonthsSlidesUncached)
}

async function loadSeasonLinkedProductIdsUncached(): Promise<string[]> {
  const monthKeys = getHomeSeasonLinkedProductMonthKeys()
  const rows = await prisma.monthlyCurationContent.findMany({
    where: {
      pageScope: 'overseas',
      isPublished: true,
      monthKey: { in: monthKeys },
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
  ['season-linked-product-ids-v3'],
  { revalidate: SEASON_CURATION_CACHE_REVALIDATE_SEC },
)

export async function getCachedSeasonLinkedProductIds(): Promise<string[]> {
  if (shouldSkipDbAtBuild()) return []
  // REGRESSION-FREEZE[home-ssg-empty-poison]: season linked ids empty bypass — manifest
  return readCachedArrayOrBypassEmpty(cachedSeasonLinkedProductIds, () =>
    loadSeasonLinkedProductIdsUncached(),
  )
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
  const cached = await cachedCurrentCycle()
  if (cached?.id) return rehydrateSeasonCurationCycle(cached)
  // null cycle cached after deploy race — do not trust empty for the full 5m TTL
  return getCurrentCycle(new Date())
}
