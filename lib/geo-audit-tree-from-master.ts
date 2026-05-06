/**
 * I-5: 마스터 primary → G-3 폴백용 트리 슬러그(groupKey / nodeKey / browse continent) 도출.
 */
import { findGroupKeyForCountryKey } from '@/lib/overseas-location-tree'
import { continentTabIdForMatch } from '@/lib/unified-location-tree'

export function deriveTreeGeoFromMasterPrimary(
  masterCountryKey: string,
  masterCityKey: string | null,
): { groupKey: string | null; nodeKey: string | null; continent: string | null } {
  const gk = findGroupKeyForCountryKey(masterCountryKey)
  if (!gk) {
    return {
      groupKey: null,
      nodeKey: masterCityKey,
      continent: null,
    }
  }
  const continent = continentTabIdForMatch(gk, masterCountryKey)
  return {
    groupKey: gk,
    nodeKey: masterCityKey,
    continent,
  }
}
