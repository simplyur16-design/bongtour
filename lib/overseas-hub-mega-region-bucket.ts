import type { ResultItem } from '@/components/products/ProductResultsList'
import type { OverseasDisplayBucketId } from '@/lib/overseas-display-buckets'
import {
  MEGA_MENU_REGION_CITY_GROUP_TAB_IDS,
  type MegaMenuRegionCityGroupTabId,
} from '@/lib/overseas-mega-region-city-group'

/** 메가메뉴 대분류 탭 → 허브 `overseasBucket` (클라이언트 트리 매칭 금지) */
const MEGA_TAB_TO_BUCKET: Record<MegaMenuRegionCityGroupTabId, OverseasDisplayBucketId> = {
  japan: 'japan',
  'southeast-asia': 'sea_taiwan',
  'china-hk-mo': 'china_hk_mo',
  oceania: 'oceania',
  'europe-me': 'europe_me_af',
  americas: 'americas',
  'south-america': 'americas',
}

export function isMegaRegionCityGroupTabId(id: string): id is MegaMenuRegionCityGroupTabId {
  return (MEGA_MENU_REGION_CITY_GROUP_TAB_IDS as readonly string[]).includes(id)
}

/** O(n) 필드 비교만 — `matchProductToOverseasNode` 호출 없음 */
export function itemBelongsToMegaRegionTab(item: ResultItem, regionTab: string): boolean {
  const tab = regionTab.trim()
  if (!tab || !isMegaRegionCityGroupTabId(tab)) return false

  if ((item.sportsThemeTags?.length ?? 0) > 0) return false

  const itemTab = (item.browseMegaRegionTabId ?? '').trim()
  if (itemTab) return itemTab === tab

  const bucket = item.overseasBucket
  if (!bucket) return false
  return bucket === MEGA_TAB_TO_BUCKET[tab]
}

export function filterCatalogByMegaRegionTab(items: readonly ResultItem[], regionTab: string): ResultItem[] {
  const tab = regionTab.trim()
  if (!tab) return [...items]
  return items.filter((item) => itemBelongsToMegaRegionTab(item, tab))
}
