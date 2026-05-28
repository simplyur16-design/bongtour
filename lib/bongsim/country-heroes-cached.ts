import { unstable_cache } from 'next/cache'
import { loadBongsimCountryHeroesMap } from '@/lib/bongsim/country-heroes-map'

const CACHE_TAG = 'bongsim-country-heroes-v1'

/** API·RSC 공통 — eSIM 추천 퍼널 국가별 히어로 URL 맵 */
export function getCachedBongsimCountryHeroesMap(): Promise<Record<string, string>> {
  return unstable_cache(() => loadBongsimCountryHeroesMap(), [CACHE_TAG], { revalidate: 300 })()
}
