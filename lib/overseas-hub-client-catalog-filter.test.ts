import { describe, expect, it } from 'vitest'
import type { ResultItem } from '@/components/products/ProductResultsList'
import { filterOverseasHubCatalogByUrl } from '@/lib/overseas-hub-client-catalog-filter'

describe('filterOverseasHubCatalogByUrl mega region tab', () => {
  it('uses browseMegaRegionTabId without tree rematch', () => {
    const items = [
      { id: '1', title: '오사카', browseMegaRegionTabId: 'japan' },
      { id: '2', title: '방콕', browseMegaRegionTabId: 'southeast-asia' },
    ] as ResultItem[]
    const out = filterOverseasHubCatalogByUrl(
      items,
      new URLSearchParams('scope=overseas&region=japan'),
    )
    expect(out.map((it) => it.id)).toEqual(['1'])
  })
})

describe('filterOverseasHubCatalogByUrl country slug', () => {
  it('matches browseCountry Korean label to country slug param', () => {
    const items = [
      { id: '1', title: '방콕', browseCountry: '태국' },
      { id: '2', title: '다낭', browseCountry: '베트남' },
    ] as ResultItem[]
    const out = filterOverseasHubCatalogByUrl(
      items,
      new URLSearchParams('scope=overseas&region=southeast-asia&country=thailand'),
    )
    expect(out.map((it) => it.id)).toEqual(['1'])
  })
})

describe('filterOverseasHubCatalogByUrl menuGroup', () => {
  it('narrows japan tab to hokkaido subgroup for mega menu header URL', () => {
    const items = [
      {
        id: 'hk',
        title: '삿포로',
        browseMegaRegionTabId: 'japan',
        countryRowLabel: '삿포로',
      },
      {
        id: 'ks',
        title: '오사카',
        browseMegaRegionTabId: 'japan',
        countryRowLabel: '오사카',
      },
      {
        id: 'golf',
        title: '니세코 골프',
        browseMegaRegionTabId: 'sports_theme',
        countryRowLabel: '홋카이도',
        sportsThemeTags: ['golf'],
      },
    ] as ResultItem[]
    const out = filterOverseasHubCatalogByUrl(
      items,
      new URLSearchParams('scope=overseas&region=japan&country=japan&menuGroup=hokkaido'),
    )
    expect(out.map((it) => it.id)).toEqual(['hk'])
  })
})
