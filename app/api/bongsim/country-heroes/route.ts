import { jsonWithLeakGuard } from '@/lib/public-response-guard'
import { getCachedBongsimCountryHeroesMap } from '@/lib/bongsim/country-heroes-cached'

/**
 * GET /api/bongsim/country-heroes
 *
 * `image_assets`에서 봉심 eSIM 추천 퍼널 국가별 히어로 URL 맵 (공개).
 * 동일 국가 다행 시 `updatedAt` 최신 행을 사용.
 */
export async function GET() {
  try {
    const heroes = await getCachedBongsimCountryHeroesMap()
    return jsonWithLeakGuard(heroes, 'bongsim.country-heroes.map', {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'query failed'
    console.error('[api/bongsim/country-heroes]', e)
    return jsonWithLeakGuard({ error: msg }, 'bongsim.country-heroes.map', { status: 500 })
  }
}
