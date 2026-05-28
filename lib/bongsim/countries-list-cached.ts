import { unstable_cache } from 'next/cache'
import { loadBongsimCountriesList, type BongsimCountryListItem } from '@/lib/bongsim/countries-list'

const CACHE_TAG = 'bongsim-countries-list-v1'

/** API·RSC 공통 — 단독 eSIM 플랜 국가 목록 */
export function getCachedBongsimCountriesList(): Promise<BongsimCountryListItem[]> {
  return unstable_cache(() => loadBongsimCountriesList(), [CACHE_TAG], { revalidate: 300 })()
}
