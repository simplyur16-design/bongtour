import { browseRegionToDbContinents } from '@/lib/browse-country-url-resolve'
import { BROWSE_TAB_ID_TO_CARD_KEYS } from '@/lib/mega-menu-regions.data'

export { BROWSE_TAB_ID_TO_CARD_KEYS } from '@/lib/mega-menu-regions.data'

/** SSOT 메가메뉴 탭 id → DB 카드 키 (없으면 빈 배열) */
export function browseTabIdToMegaMenuCardKeys(regionId: string | null | undefined): string[] {
  const k = (regionId ?? '').trim().toLowerCase()
  if (!k) return []
  const hit = BROWSE_TAB_ID_TO_CARD_KEYS[k]
  return hit ? [...hit] : []
}

/** SSOT 지방출발 탭 id → `Product.localDepartureTag` */
export function localDepartureTagForBrowseRegion(
  region: string | null | undefined,
): 'busan' | 'cheongju' | 'daegu' | null {
  const t = (region ?? '').trim().toLowerCase()
  if (t === 'busan_dep') return 'busan'
  if (t === 'cheongju_dep') return 'cheongju'
  if (t === 'daegu_dep') return 'daegu'
  return null
}

/** DB `Product.continent` 슬러그 → `Continent.continentKey` (1:N 가능) */
const DB_BROWSE_CONTINENT_TO_MASTER: Record<string, string[]> = {
  japan: ['northeast-asia'],
  'southeast-asia': ['southeast-asia'],
  'china-mongolia-ca': ['northeast-asia'],
  'hongkong-macau': ['northeast-asia'],
  europe: ['europe'],
  'me-africa': ['middle-east', 'africa'],
  oceania: ['oceania'],
  americas: ['north-america', 'south-america'],
}

export function masterContinentKeysFromBrowseDbContinents(dbContinents: string[]): string[] {
  const out = new Set<string>()
  for (const raw of dbContinents) {
    const k = raw.trim().toLowerCase()
    const hit = DB_BROWSE_CONTINENT_TO_MASTER[k]
    if (hit) hit.forEach((x) => out.add(x))
  }
  return [...out]
}

/**
 * browse 탭 id → 마스터 `continentKey` (카드 키 매핑 없을 때 폴백).
 * 탭 id가 `BROWSE_TAB_ID_TO_CARD_KEYS`에 있으면 `resolveBrowseRegionToCountryKeys`가 카드 합집합을 쓴다.
 */
export function masterContinentKeysFromBrowseRegion(region: string | null | undefined): string[] {
  return masterContinentKeysFromBrowseDbContinents(browseRegionToDbContinents(region))
}
