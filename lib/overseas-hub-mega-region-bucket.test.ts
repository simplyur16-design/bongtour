import { describe, expect, it } from 'vitest'
import type { ResultItem } from '@/components/products/ProductResultsList'
import { filterCatalogByMegaRegionTab } from '@/lib/overseas-hub-mega-region-bucket'

describe('filterCatalogByMegaRegionTab', () => {
  it('filters by browseMegaRegionTabId without tree match', () => {
    const items = [
      { id: '1', title: '오사카', browseMegaRegionTabId: 'japan' },
      { id: '2', title: '방콕', browseMegaRegionTabId: 'southeast-asia' },
    ] as ResultItem[]
    expect(filterCatalogByMegaRegionTab(items, 'japan').map((it) => it.id)).toEqual(['1'])
  })

  it('excludes sports-tagged products from geo region tabs', () => {
    const items = [
      { id: '1', title: '오사카', browseMegaRegionTabId: 'japan' },
      { id: '2', title: '골프 일본', browseMegaRegionTabId: 'sports_theme', sportsThemeTags: ['golf'] },
    ] as ResultItem[]
    expect(filterCatalogByMegaRegionTab(items, 'japan').map((it) => it.id)).toEqual(['1'])
  })

  it('falls back to overseasBucket', () => {
    const items = [
      { id: '1', title: '오사카', overseasBucket: 'japan' },
      { id: '2', title: '방콕', overseasBucket: 'sea_taiwan' },
    ] as ResultItem[]
    expect(filterCatalogByMegaRegionTab(items, 'japan').map((it) => it.id)).toEqual(['1'])
  })
})
