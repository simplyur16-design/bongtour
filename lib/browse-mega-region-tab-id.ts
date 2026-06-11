import {
  buildOverseasProductMatchHaystack,
  type MatchProductToOverseasNodeResult,
  type OverseasProductMatchInput,
} from '@/lib/match-overseas-product'
import {
  type OverseasDisplayBucketId,
  RE_GUAM_SAIPAN_TRAVEL,
} from '@/lib/overseas-display-buckets'
import { continentTabIdForMatch } from '@/lib/unified-location-tree'

const BUCKET_TO_MEGA_TAB: Partial<Record<OverseasDisplayBucketId, string>> = {
  europe_me_af: 'europe-me',
  sea_taiwan: 'southeast-asia',
  japan: 'japan',
  china_hk_mo: 'china-hk-mo',
  oceania: 'oceania',
  americas: 'americas',
}

/**
 * browse·허브 카탈로그 — 메가메뉴 대분류 탭 id (트리 매칭 보정 포함).
 * 스포츠 테마 태그가 있으면 `sports_theme`만 반환해 지리 탭과 분리한다.
 */
export function resolveBrowseMegaRegionTabIdForBrowse(
  product: OverseasProductMatchInput,
  match: MatchProductToOverseasNodeResult | null,
  overseasBucket: OverseasDisplayBucketId,
  sportsThemeTags: readonly string[] | null | undefined,
): string | null {
  if (sportsThemeTags && sportsThemeTags.length > 0) return 'sports_theme'

  const haystack = buildOverseasProductMatchHaystack(product)
  if (RE_GUAM_SAIPAN_TRAVEL.test(haystack) && match?.countryKey !== 'hawaii') {
    return 'oceania'
  }

  if (match) {
    const fromMatch = continentTabIdForMatch(match.groupKey, match.countryKey)
    if (fromMatch === 'oceania' || overseasBucket === 'oceania') return 'oceania'
    if (fromMatch) return fromMatch
  }

  return BUCKET_TO_MEGA_TAB[overseasBucket] ?? null
}
