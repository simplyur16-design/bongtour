import { findCountryInTree, findLeafInTree } from '@/lib/overseas-location-tree'
import { continentTabIdForMatch } from '@/lib/unified-location-tree'

const ASCII_SLUG = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/i

export function isLikelyAsciiLocationSlug(s: string | null | undefined): boolean {
  if (!s || !s.trim()) return false
  return ASCII_SLUG.test(s.trim())
}

/** browse `country` 한글 권역 라벨(정규화 전) — 마스터 단일 국가와 불일치 */
const KOREAN_REGION_COUNTRY_LABEL = /^(동유럽|서유럽|북유럽|중유럽|남유럽|스칸디나비아|발칸|중남미|남태평양|미서부|미동부)/

export function productRowNeedsGeoAudit(row: {
  registrationStatus: string | null
  travelScope: string | null
  countryKey: string | null
  country: string | null
  city: string | null
  continentKey?: string | null
  cityKey?: string | null
}): boolean {
  if (row.registrationStatus !== 'registered') return false
  if (row.travelScope === 'domestic') return false
  if (row.countryKey == null) return true
  if (row.continentKey == null || row.cityKey == null) return true
  if (isLikelyAsciiLocationSlug(row.country)) return true
  if (isLikelyAsciiLocationSlug(row.city)) return true
  const co = (row.country ?? '').trim()
  if (co && KOREAN_REGION_COUNTRY_LABEL.test(co)) return true
  return false
}

export type TreeSelectionInput = {
  groupKey: string
  countryKey: string
  nodeKey: string | null
}

export type ResolvedGeoPatch = {
  continent: string
  groupKey: string
  countryKey: string
  nodeKey: string | null
  country: string
  city: string | null
  locationMatchConfidence: string
  locationMatchSource: string
}

export function resolveGeoFromTreeSelection(sel: TreeSelectionInput): ResolvedGeoPatch | null {
  const { groupKey, countryKey, nodeKey } = sel
  const found = findCountryInTree(groupKey, countryKey)
  if (!found) return null
  const { group, country } = found
  const continent = continentTabIdForMatch(group.groupKey, country.countryKey)

  if (nodeKey) {
    const leafHit = findLeafInTree(groupKey, countryKey, nodeKey)
    if (!leafHit) return null
    const { leaf } = leafHit
    const whole = leaf.nodeLabel.trim() === country.countryLabel.trim()
    const city = whole ? null : (leaf.dbCityValue ?? leaf.nodeLabel)
    const countryKr = country.dbCountryValues?.[0] ?? country.countryLabel
    return {
      continent,
      groupKey: group.groupKey,
      countryKey: country.countryKey,
      nodeKey: leaf.nodeKey,
      country: countryKr,
      city,
      locationMatchConfidence: 'high',
      locationMatchSource: 'geo-audit:manual',
    }
  }

  const countryKr = country.dbCountryValues?.[0] ?? country.countryLabel
  return {
    continent,
    groupKey: group.groupKey,
    countryKey: country.countryKey,
    nodeKey: null,
    country: countryKr,
    city: null,
    locationMatchConfidence: 'medium',
    locationMatchSource: 'geo-audit:manual',
  }
}

export function geoKeysMatch(
  a: {
    countryKey: string | null
    nodeKey: string | null
    groupKey: string | null
    continent: string | null
  },
  b: {
    countryKey: string | null
    nodeKey: string | null
    groupKey: string | null
    continent: string | null
  }
): boolean {
  return (
    (a.countryKey ?? null) === (b.countryKey ?? null) &&
    (a.nodeKey ?? null) === (b.nodeKey ?? null) &&
    (a.groupKey ?? null) === (b.groupKey ?? null) &&
    (a.continent ?? null) === (b.continent ?? null)
  )
}
