import type { ResultItem } from '@/components/products/ProductResultsList'
import {
  clearOverseasHubMegaRegionIndex,
  overseasHubCatalogItemsLookFresh,
  rebuildOverseasHubMegaRegionIndex,
} from '@/lib/overseas-hub-catalog-region-index'
import { readProductsBrowseClientCache } from '@/lib/products-browse-client-cache'
import { fetchProductsBrowseClientJson } from '@/lib/products-browse-client-fetch'
import { buildOverseasHubCatalogFetchQueryKey } from '@/lib/products-browse-hub-query'
import { OVERSEAS_HUB_CATALOG_CLIENT_VERSION } from '@/lib/overseas-hub-catalog-version'

const CATALOG_QUERY_KEY = buildOverseasHubCatalogFetchQueryKey()

/** 빈 스냅샷 SSOT — 매 렌더 `[]` 신규 생성 방지 */
export const EMPTY_OVERSEAS_HUB_CATALOG: ResultItem[] = []

let catalogItems: ResultItem[] | null = null
let catalogPromise: Promise<ResultItem[]> | null = null
let catalogFetchActive = false

const HUB_CATALOG_VERSION_STORAGE_KEY = 'bt-hub-catalog-version'

/** hubCatalog 버전 bump·등록 후 stale module cache 방지 */
export function resetOverseasHubCatalogClientState(): void {
  catalogItems = null
  catalogPromise = null
  clearOverseasHubMegaRegionIndex()
}

function ensureHubCatalogClientVersionFresh(): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    const stored = sessionStorage.getItem(HUB_CATALOG_VERSION_STORAGE_KEY)
    if (stored === OVERSEAS_HUB_CATALOG_CLIENT_VERSION) return
    resetOverseasHubCatalogClientState()
    sessionStorage.setItem(HUB_CATALOG_VERSION_STORAGE_KEY, OVERSEAS_HUB_CATALOG_CLIENT_VERSION)
  } catch {
    // private mode — 무시
  }
}

function adoptCatalogItems(items: ResultItem[]): ResultItem[] {
  catalogItems = items
  rebuildOverseasHubMegaRegionIndex(items)
  return items
}

function readCacheItems(): ResultItem[] {
  const hit = readProductsBrowseClientCache<{ ok: true; items: ResultItem[] }>(CATALOG_QUERY_KEY)
  if (hit?.ok && Array.isArray(hit.items) && hit.items.length > 0 && overseasHubCatalogItemsLookFresh(hit.items)) {
    return adoptCatalogItems(hit.items)
  }
  return EMPTY_OVERSEAS_HUB_CATALOG
}

export function isOverseasHubCatalogFetching(): boolean {
  if (catalogItems && catalogItems.length > 0) return false
  return catalogFetchActive
}

/** 모듈·sessionStorage 카탈로그 (클라이언트 스냅샷) */
export function peekOverseasHubCatalogItems(): ResultItem[] {
  ensureHubCatalogClientVersionFresh()
  if (catalogItems && catalogItems.length > 0) return catalogItems
  const cached = readCacheItems()
  if (cached.length > 0) return cached
  return EMPTY_OVERSEAS_HUB_CATALOG
}

/**
 * 해외 허브 전량 카탈로그 — 모듈 단위 1회 fetch.
 * 메가메뉴 region 전환은 이 Promise를 재호출하지 않고 URL 필터만 갱신한다.
 */
export function ensureOverseasHubCatalog(): Promise<ResultItem[]> {
  ensureHubCatalogClientVersionFresh()
  const existing = peekOverseasHubCatalogItems()
  if (existing.length > 0) return Promise.resolve(existing)

  if (catalogPromise) return catalogPromise

  catalogFetchActive = true

  catalogPromise = fetchProductsBrowseClientJson(CATALOG_QUERY_KEY)
    .then((json) => {
      const items = (json.items ?? []) as ResultItem[]
      return adoptCatalogItems(items)
    })
    .catch((e) => {
      const fallback = readCacheItems()
      if (fallback.length > 0) return fallback
      throw e
    })
    .finally(() => {
      catalogFetchActive = false
      catalogPromise = null
    })

  return catalogPromise
}

export function overseasHubCatalogQueryKey(): string {
  return CATALOG_QUERY_KEY
}
