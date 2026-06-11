import { describe, expect, it } from 'vitest'
import type { ResultItem } from '@/components/products/ProductResultsList'
import {
  getOverseasHubCatalogForMegaRegionTab,
  overseasHubCatalogItemsLookFresh,
  rebuildOverseasHubMegaRegionIndex,
} from '@/lib/overseas-hub-catalog-region-index'

describe('overseas-hub-catalog-region-index', () => {
  it('accepts cache with overseasBucket when tab id missing', () => {
    const cached = [
      { id: '1', title: 'a', overseasBucket: 'japan', coverImageUrl: 'https://example.com/a.jpg' },
    ] as ResultItem[]
    expect(overseasHubCatalogItemsLookFresh(cached)).toBe(true)
  })

  it('rejects cache when most items lack cover image', () => {
    const cached = [
      { id: '1', title: 'a', overseasBucket: 'japan' },
      { id: '2', title: 'b', overseasBucket: 'japan' },
    ] as ResultItem[]
    expect(overseasHubCatalogItemsLookFresh(cached)).toBe(false)
  })

  it('indexes by browseMegaRegionTabId for O(1) region lookup', () => {
    rebuildOverseasHubMegaRegionIndex([
      { id: '1', title: '오사카', browseMegaRegionTabId: 'japan', coverImageUrl: 'https://example.com/1.jpg' },
      { id: '2', title: '방콕', browseMegaRegionTabId: 'southeast-asia', coverImageUrl: 'https://example.com/2.jpg' },
    ] as ResultItem[])
    expect(getOverseasHubCatalogForMegaRegionTab('japan')?.map((it) => it.id)).toEqual(['1'])
  })
})
