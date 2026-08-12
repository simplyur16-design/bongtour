import { getCurrentCycle } from '@/lib/season-curation'
import { loadOverseasHubSeasonDestinationHeroSlidesUncached } from '@/lib/overseas-hub-season-destination-hero'
import { jsonWithLeakGuard } from '@/lib/public-response-guard'

export const dynamic = 'force-dynamic'

/**
 * 해외 허브 히어로 — SSR/CDN 빈 셸일 때 클라이언트 복구용.
 * REGRESSION-FREEZE[overseas-hub-season-hero-empty-poison]: public season-hero API — manifest
 */
export async function GET() {
  try {
    const cycle = await getCurrentCycle(new Date())
    if (!cycle?.id) {
      return jsonWithLeakGuard(
        { ok: true, slides: [] as const },
        'overseas.season-hero.empty-cycle',
        { headers: { 'Cache-Control': 'no-store' } },
      )
    }
    const slides = await loadOverseasHubSeasonDestinationHeroSlidesUncached(cycle)
    return jsonWithLeakGuard(
      { ok: true, slides },
      'overseas.season-hero.response',
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (e) {
    console.error('[api/travel/overseas/season-hero]', e)
    return jsonWithLeakGuard(
      { ok: false, slides: [] as const, error: 'season_hero_unavailable' },
      'overseas.season-hero.error',
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
