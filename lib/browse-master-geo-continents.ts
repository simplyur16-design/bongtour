import { browseRegionToDbContinents } from '@/lib/browse-country-url-resolve'

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

export function masterContinentKeysFromBrowseRegion(region: string | null | undefined): string[] {
  return masterContinentKeysFromBrowseDbContinents(browseRegionToDbContinents(region))
}
