import { describe, expect, it } from 'vitest'
import type { ResultItem } from '@/components/products/ProductResultsList'
import {
  filterOverseasHubCatalogByUrl,
  shouldShowEsimNativeCardsOnBrowse,
} from '@/lib/overseas-hub-client-catalog-filter'

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
  it('keeps LC country leaf when overseasBucket missing (countryTag fallback)', () => {
    const items = [
      {
        id: 'it',
        title: '이탈리아 일주',
        originSource: 'modetour',
        countryTags: [{ countryKey: 'italy', nodeKey: 'italy' }],
        cityTags: [],
      },
      {
        id: 'th',
        title: '방콕',
        originSource: 'modetour',
        countryTags: [{ countryKey: 'thailand', nodeKey: 'bangkok' }],
        cityTags: [{ cityKey: 'bangkok' }],
      },
    ] as ResultItem[]
    const out = filterOverseasHubCatalogByUrl(
      items,
      new URLSearchParams(
        'scope=overseas&region=europe-me&country=italy&menuGroup=western-europe',
      ),
    )
    expect(out.map((it) => it.id)).toEqual(['it'])
  })

  it('narrows japan tab to hokkaido subgroup for mega menu header URL', () => {
    const items = [
      {
        id: 'hk',
        title: '삿포로',
        originSource: 'modetour',
        browseMegaRegionTabId: 'japan',
        countryRowLabel: '삿포로',
        cityTags: [{ cityKey: 'sapporo' }],
        countryTags: [{ countryKey: 'jp', nodeKey: 'sapporo' }],
      },
      {
        id: 'ks',
        title: '오사카',
        originSource: 'modetour',
        browseMegaRegionTabId: 'japan',
        countryRowLabel: '오사카',
        cityTags: [{ cityKey: 'osaka' }],
        countryTags: [{ countryKey: 'jp', nodeKey: 'osaka' }],
      },
      {
        id: 'golf',
        title: '니세코 골프',
        originSource: 'modetour',
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

  it('shows multi-column japan product under both kansai and hokkaido mid', () => {
    const items = [
      {
        id: 'multi',
        title: '오사카+삿포로 6일',
        originSource: 'modetour',
        browseMegaRegionTabId: 'japan',
        countryRowLabel: '오사카',
        cityTags: [{ cityKey: 'osaka' }, { cityKey: 'sapporo' }],
        countryTags: [{ countryKey: 'jp', nodeKey: 'osaka' }],
      },
      {
        id: 'fukuoka-only',
        title: '후쿠오카 4일',
        originSource: 'hanatour',
        browseMegaRegionTabId: 'japan',
        cityTags: [{ cityKey: 'fukuoka' }],
        countryTags: [{ countryKey: 'jp', nodeKey: 'fukuoka' }],
      },
    ] as ResultItem[]
    const kansai = filterOverseasHubCatalogByUrl(
      items,
      new URLSearchParams('scope=overseas&region=japan&country=japan&menuGroup=kansai'),
    )
    const hokkaido = filterOverseasHubCatalogByUrl(
      items,
      new URLSearchParams('scope=overseas&region=japan&country=japan&menuGroup=hokkaido'),
    )
    expect(kansai.map((it) => it.id)).toEqual(['multi'])
    expect(hokkaido.map((it) => it.id)).toEqual(['multi'])
  })

  it('filters osaka leaf by cityTags not title needle', () => {
    const items = [
      {
        id: 'osaka',
        title: '[출발확정] 오사카 3일',
        originSource: 'modetour',
        browseMegaRegionTabId: 'japan',
        countryRowLabel: '오사카',
        cityTags: [{ cityKey: 'osaka' }, { cityKey: 'kyoto' }],
        countryTags: [{ countryKey: 'jp', nodeKey: 'osaka' }],
      },
      {
        id: 'bkk',
        title: '방콕 4일',
        originSource: 'hanatour',
        browseMegaRegionTabId: 'southeast-asia',
        cityTags: [{ cityKey: 'bangkok' }],
        countryTags: [{ countryKey: 'th', nodeKey: 'bangkok' }],
      },
    ] as ResultItem[]
    const out = filterOverseasHubCatalogByUrl(
      items,
      new URLSearchParams(
        'scope=overseas&region=japan&country=japan&menuGroup=kansai&city=osaka',
      ),
    )
    expect(out.map((it) => it.id)).toEqual(['osaka'])
  })
})

describe('filterOverseasHubCatalogByUrl travel type', () => {
  const items = [
    { id: 'pkg', title: '오사카 패키지', listingKind: 'travel', productType: 'travel' },
    { id: 'fit', title: '타이베이 에어텔', listingKind: 'air_hotel_free', productType: 'air-hotel' },
  ] as ResultItem[]

  it('type=travel keeps package only even without geo', () => {
    const out = filterOverseasHubCatalogByUrl(items, new URLSearchParams('type=travel'))
    expect(out.map((it) => it.id)).toEqual(['pkg'])
  })

  it('type=air-hotel keeps FIT only even without geo', () => {
    const out = filterOverseasHubCatalogByUrl(items, new URLSearchParams('type=air-hotel'))
    expect(out.map((it) => it.id)).toEqual(['fit'])
  })

  it('no type keeps package and FIT', () => {
    const out = filterOverseasHubCatalogByUrl(items, new URLSearchParams(''))
    expect(out.map((it) => it.id).sort()).toEqual(['fit', 'pkg'])
  })
})

describe('shouldShowEsimNativeCardsOnBrowse', () => {
  // REGRESSION-FREEZE[fit-listing-no-esim-card]
  it('keeps eSIM cards on package / all overseas hub, not on FIT lists', () => {
    expect(
      shouldShowEsimNativeCardsOnBrowse({
        isOverseasProductsHub: true,
        isAirHotelHub: false,
        travelType: 'package',
      }),
    ).toBe(true)
    expect(
      shouldShowEsimNativeCardsOnBrowse({
        isOverseasProductsHub: true,
        isAirHotelHub: false,
        travelType: 'all',
      }),
    ).toBe(true)
    expect(
      shouldShowEsimNativeCardsOnBrowse({
        isOverseasProductsHub: true,
        isAirHotelHub: false,
        travelType: 'free',
      }),
    ).toBe(false)
    expect(
      shouldShowEsimNativeCardsOnBrowse({
        isOverseasProductsHub: false,
        isAirHotelHub: true,
        travelType: 'free',
      }),
    ).toBe(false)
  })
})
