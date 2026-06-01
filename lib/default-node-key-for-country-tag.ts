/**
 * 다국가 ProductCountryTag 보조 행용 — 마스터 countryKey에 맞는 기본 cityKey(nodeKey).
 */
import {
  OVERSEAS_LOCATION_TREE_CLEAN,
  findGroupKeyForCountryKey,
} from '@/lib/overseas-location-tree'
import { isMultiCityClusterNode, mapTreeKeysToMasterKeys } from '@/lib/product-master-mapping'

/** 마스터 countryKey → 메가메뉴·browse에 쓰는 nodeKey(대개 City.cityKey) */
export function defaultNodeKeyForMasterCountryTag(masterCountryKey: string): string | null {
  const mk = masterCountryKey.trim()
  if (!mk) return null
  const gk = findGroupKeyForCountryKey(mk)
  if (!gk) return null

  for (const group of OVERSEAS_LOCATION_TREE_CLEAN) {
    if (group.groupKey !== gk) continue
    for (const country of group.countries) {
      const candidates: Array<{ countryKey: string; nodeKey: string }> = [
        { countryKey: country.countryKey, nodeKey: country.countryKey },
        ...country.children.map((leaf) => ({
          countryKey: country.countryKey,
          nodeKey: leaf.nodeKey,
        })),
      ]
      for (const { countryKey, nodeKey } of candidates) {
        const mapped = mapTreeKeysToMasterKeys({
          groupKey: gk,
          countryKey,
          nodeKey,
        })
        if (mapped.masterCountryKey !== mk) continue
        const ck = mapped.cityKey?.trim()
        if (!ck || isMultiCityClusterNode(ck)) continue
        return ck
      }
    }
  }
  return null
}
