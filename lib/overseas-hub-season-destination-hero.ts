/**
 * 해외 허브 히어로 — 메인 `SeasonalDestinationCuration` 5도시(추천 여행지)와 동일 SSOT.
 * 메인 시즌 카드(`MonthlyCurationContent`)와 분리해 중복 노출을 막는다.
 *
 * REGRESSION-FREEZE[season-curation-keep-orphan-product-cards]: overseas hub build-empty 미캐시 — manifest
 */
import 'server-only'

import { unstable_cache } from 'next/cache'
import { shouldSkipDbAtBuild } from '@/lib/build-time-db'
import { getPersonaCuratedDestinationsPayload } from '@/lib/persona-curated-destinations'
import { type SeasonCurationCycle } from '@/lib/season-curation'
import { getSeoulYearMonthNow } from '@/lib/monthly-curation'
import { buildPublicPageHeroEditorialLineMonthlyStub } from '@/lib/public-page-hero-editorial-line'
import {
  seasonHeroBaseMonthFromCycleStart,
  seasonHeroTargetMonthForSlotIndex,
} from '@/lib/season-hero-target-months'
import { resolveSeasonCurationSubline } from '@/lib/season-curation-subline'
import type { OverseasHubDestinationHeroSlide } from '@/lib/overseas-hub-season-destination-hero-shared'
import { readCachedArrayOrBypassEmpty } from '@/lib/unstable-cache-empty-bypass'

export type { OverseasHubDestinationHeroSlide } from '@/lib/overseas-hub-season-destination-hero-shared'

/** revalidateTag / 배포 후 워밍 SSOT — v12: client recover API + empty poison bust */
// REGRESSION-FREEZE[overseas-hub-season-hero-empty-poison]: cache tag v12 — manifest
export const OVERSEAS_HUB_SEASON_DESTINATION_HERO_CACHE_TAG = 'overseas-hub-season-destination-hero-v12'

function seoulMonth1To12(): number {
  const ym = getSeoulYearMonthNow()
  const m = Number(ym.split('-')[1])
  return Number.isFinite(m) && m >= 1 && m <= 12 ? m : new Date().getMonth() + 1
}

function parseCycleReasoning(geminiResponse: unknown): Record<string, string> {
  if (!geminiResponse || typeof geminiResponse !== 'object') return {}
  const r = (geminiResponse as { reasoning?: unknown }).reasoning
  if (!r || typeof r !== 'object' || Array.isArray(r)) return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(r)) {
    if (typeof v === 'string' && v.trim()) out[k] = v.trim()
  }
  return out
}

function koreanCityLabelFromSubtitle(koreanSubtitle: string): string {
  const ko = koreanSubtitle.split(' · ')[0]?.trim()
  return ko || koreanSubtitle.trim()
}

/** SSR slot fallback when Data/Route cache still empty — do not wrap in unstable_cache */
export async function loadOverseasHubSeasonDestinationHeroSlidesUncached(
  cycle: SeasonCurationCycle,
): Promise<OverseasHubDestinationHeroSlide[]> {
  if (!cycle) return []
  const payload = await getPersonaCuratedDestinationsPayload(cycle)
  const reasoning = parseCycleReasoning(cycle.geminiResponse)
  const baseMonth = seasonHeroBaseMonthFromCycleStart(
    cycle.cycleStartDate ?? payload.cycle?.cycleStartDate ?? null,
    seoulMonth1To12(),
  )
  const cycleId = cycle.id ?? payload.cycle?.id ?? 'no-cycle'

  return payload.cards.map((card, idx) => {
    const destKo = koreanCityLabelFromSubtitle(card.koreanSubtitle)
    const targetMonth1To12 = seasonHeroTargetMonthForSlotIndex(baseMonth, idx)
    const headline = buildPublicPageHeroEditorialLineMonthlyStub({
      targetMonth1To12,
      destinationDisplay: destKo,
      verbSlotIndex: idx,
      travelScope: 'overseas',
    })
    const geminiLine = reasoning[card.cityKey]?.trim()
    const subline = resolveSeasonCurationSubline({
      targetMonth1To12,
      geminiLine,
      cityLabel: destKo,
      countryLabel: card.countryKoreanLabel,
    })

    return {
      id: `overseas-hub-season-${card.cityKey}-m${targetMonth1To12}-${cycleId}`,
      cityKey: card.cityKey,
      countryKey: card.countryKey,
      countryKoreanLabel: card.countryKoreanLabel,
      imageUrl: card.imageUrl,
      headline,
      subline,
      href: `/travel/overseas?destination=${encodeURIComponent(card.cityKey)}`,
      targetMonth1To12,
    }
  })
}

export async function getCachedOverseasHubSeasonDestinationHeroSlides(
  cycle: SeasonCurationCycle,
): Promise<OverseasHubDestinationHeroSlide[]> {
  if (shouldSkipDbAtBuild()) return []
  if (!cycle?.id) return []
  try {
    const cacheKey = [OVERSEAS_HUB_SEASON_DESTINATION_HERO_CACHE_TAG, cycle.id]
    const run = unstable_cache(
      () => loadOverseasHubSeasonDestinationHeroSlidesUncached(cycle),
      cacheKey,
      {
        revalidate: 1_800,
        tags: [OVERSEAS_HUB_SEASON_DESTINATION_HERO_CACHE_TAG, `overseas-hub-season-${cycle.id}`],
      },
    )
    return await readCachedArrayOrBypassEmpty(run, () =>
      loadOverseasHubSeasonDestinationHeroSlidesUncached(cycle),
    )
  } catch (e) {
    console.error('[overseas-hub-season-destination-hero] cached load failed', e)
    return []
  }
}
