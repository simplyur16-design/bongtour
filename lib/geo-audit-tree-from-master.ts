/**
 * I-5 / I-5-PATCH: 마스터 primary → G-3 폴백용 트리 슬러그(groupKey / nodeKey / browse continent) 도출.
 * 트리에 국가 매핑이 없으면 전부 null (Browse I-4는 마스터 키 + 트리 NULL 폴백).
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
      nodeKey: null,
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
