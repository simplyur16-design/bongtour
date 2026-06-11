import type { ResultItem } from '@/components/products/ProductResultsList'
import { filterCatalogByMegaRegionTab } from '@/lib/overseas-hub-mega-region-bucket'
import { MEGA_MENU_REGION_CITY_GROUP_TAB_IDS } from '@/lib/overseas-mega-region-city-group'

/** 메가메뉴 대분류 탭 id → 상품 목록 (카탈로그 로드 시 1회, O(n×7)) */
let indexByMegaRegionTab = new Map<string, ResultItem[]>()
let indexSourceLength = 0

export function clearOverseasHubMegaRegionIndex(): void {
  indexByMegaRegionTab = new Map()
  indexSourceLength = 0
}

export function rebuildOverseasHubMegaRegionIndex(items: ResultItem[]): void {
  const next = new Map<string, ResultItem[]>()
  for (const tabId of MEGA_MENU_REGION_CITY_GROUP_TAB_IDS) {
    next.set(tabId, filterCatalogByMegaRegionTab(items, tabId))
  }
  indexByMegaRegionTab = next
  indexSourceLength = items.length
}

export function getOverseasHubCatalogForMegaRegionTab(regionTabId: string): ResultItem[] | null {
  const tab = regionTabId.trim()
  if (!tab || indexByMegaRegionTab.size === 0) return null
  return indexByMegaRegionTab.get(tab) ?? []
}

/** sessionStorage 구 캐시 — 필수 필드 없으면 폐기 */
export function overseasHubCatalogItemsLookFresh(items: ResultItem[]): boolean {
  if (items.length === 0) return false
  const withCover = items.filter((it) => (it.coverImageUrl ?? it.bgImageUrl ?? '').trim()).length
  if (withCover < Math.floor(items.length * 0.95)) return false
  const withTab = items.filter((it) => (it.browseMegaRegionTabId ?? '').trim()).length
  if (withTab >= Math.floor(items.length * 0.85)) return true
  const withBucket = items.filter((it) => it.overseasBucket).length
  return withBucket >= Math.floor(items.length * 0.85)
}
