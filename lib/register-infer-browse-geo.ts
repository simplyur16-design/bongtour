/**
 * 등록 미리보기 등 — 목적지 문자열만으로 browse용 continent/country/city 슬러그 추론.
 * DB 확정 전 단계용. confirm API에서 동일 규칙으로 저장하는 것이 이상적이다.
 */
import { matchProductToOverseasNode } from '@/lib/match-overseas-product'
import { findCountryInTree } from '@/lib/overseas-location-tree'
import { countrySlugFromLabel, citySlugFromTermsAndLabel } from '@/lib/location-url-slugs'
import { collectLeafTerms, continentTabIdForMatch } from '@/lib/unified-location-tree'

export type InferredBrowseGeo = { continent: string; country: string; city: string | null }

/** continent id → Pexels·UI용 한글 권역 라벨 */
export const CONTINENT_ID_TO_PRIMARY_REGION_KR: Record<string, string> = {
  'northeast-asia': '동북아',
  'southeast-asia': '동남아',
  europe: '유럽',
  'me-africa': '중동·아프리카',
  americas: '미주',
  oceania: '대양주',
}

export function inferBrowseGeoFromDestinationText(input: {
  primaryDestination?: string | null
  destinationRaw?: string | null
}): InferredBrowseGeo | null {
  const pd = (input.primaryDestination ?? '').trim()
  const dr = (input.destinationRaw ?? '').trim()
  if (!pd && !dr) return null

  const match = matchProductToOverseasNode({
    title: pd || dr,
    originSource: '',
    primaryDestination: input.primaryDestination ?? null,
    destinationRaw: input.destinationRaw ?? null,
  })
  if (!match?.countryKey) return null

  const found = findCountryInTree(match.groupKey, match.countryKey)
  if (!found) return null

  const continent = continentTabIdForMatch(match.groupKey, match.countryKey)
  const country = countrySlugFromLabel(found.country.countryLabel)

  if (match.leafKey && match.leafLabel) {
    const leaf = found.country.children.find((l) => l.nodeKey === match.leafKey)
    const terms = leaf ? collectLeafTerms(found.country, leaf) : [match.leafLabel]
    const city = citySlugFromTermsAndLabel(match.leafLabel, terms)
    return { continent, country, city }
  }

  return { continent, country, city: null }
}
