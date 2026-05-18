/**
 * 해외 허브 히어로 — 메인 `SeasonalDestinationCuration` 5도시(추천 여행지)와 동일 SSOT.
 * 메인 시즌 카드(`MonthlyCurationContent`)와 분리해 중복 노출을 막는다.
 */
import 'server-only'

import { unstable_cache } from 'next/cache'
import { getPersonaCuratedDestinationsPayload } from '@/lib/persona-curated-destinations'
import {
  ensureSeasonDestinationCyclesForMonthOffsets,
  getCurrentCycle,
  rotateCycleIfDue,
} from '@/lib/season-curation'
import { getSeoulYearMonthNow } from '@/lib/monthly-curation'
import { buildPublicPageHeroEditorialLineMonthlyStub } from '@/lib/public-page-hero-editorial-line'
import {
  seasonHeroBaseMonthFromCycleStart,
  seasonHeroTargetMonthForSlotIndex,
  sublineWithTargetMonth,
} from '@/lib/season-hero-target-months'
import type { OverseasHubDestinationHeroSlide } from '@/lib/overseas-hub-season-destination-hero-shared'

export type { OverseasHubDestinationHeroSlide } from '@/lib/overseas-hub-season-destination-hero-shared'

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

async function ensureSeasonDestinationDataReady(now: Date): Promise<void> {
  const cycle = await getCurrentCycle(now)
  if (!cycle) {
    await rotateCycleIfDue(now, { force: true })
  }
  void ensureSeasonDestinationCyclesForMonthOffsets([1, 2, 3], now).catch((e) => {
    console.error('[overseas-hub-season-destination-hero] ahead cycle seed', e)
  })
}

async function loadOverseasHubSeasonDestinationHeroSlidesUncached(): Promise<OverseasHubDestinationHeroSlide[]> {
  const now = new Date()
  await ensureSeasonDestinationDataReady(now)

  const [payload, cycle] = await Promise.all([
    getPersonaCuratedDestinationsPayload(),
    getCurrentCycle(now),
  ])
  const reasoning = parseCycleReasoning(cycle?.geminiResponse)
  const baseMonth = seasonHeroBaseMonthFromCycleStart(
    cycle?.cycleStartDate ?? payload.cycle?.cycleStartDate ?? null,
    seoulMonth1To12(),
  )
  const cycleId = cycle?.id ?? payload.cycle?.id ?? 'no-cycle'

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
    const subline = sublineWithTargetMonth(
      targetMonth1To12,
      geminiLine || card.koreanSubtitle.trim() || destKo,
    )

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

export async function getCachedOverseasHubSeasonDestinationHeroSlides(): Promise<OverseasHubDestinationHeroSlide[]> {
  const cycle = await getCurrentCycle(new Date())
  const cacheKey = ['overseas-hub-season-destination-hero', cycle?.id ?? 'no-active-cycle', 'v6-month-123']
  const run = unstable_cache(
    () => loadOverseasHubSeasonDestinationHeroSlidesUncached(),
    cacheKey,
    { revalidate: 21_600 },
  )
  return run()
}
