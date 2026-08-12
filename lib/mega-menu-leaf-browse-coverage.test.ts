/**
 * REGRESSION-FREEZE[mega-menu-product-alignment]: mega-menu leaf browse must surface tagged products — manifest
 */
import { describe, expect, it } from 'vitest'
import { countrySlugFromLabel } from '@/lib/location-url-slugs'
import {
  resolveBrowseCityKeysForFilter,
  resolveBrowseCountryParamToCountryKeySlugs,
} from '@/lib/browse-country-url-resolve'
import { buildMegaMenuLeafHref } from '@/lib/top-nav-resolve'
import { OVERSEAS_MEGA_MENU_REGIONS } from '@/lib/travel-landing-mega-menu-data'

describe('mega-menu leaf browse href / country expansions', () => {
  it('maps Caucasus LC labels to master country slugs', () => {
    expect(countrySlugFromLabel('조지아')).toBe('georgia')
    expect(countrySlugFromLabel('아제르바이잔')).toBe('azerbaijan')
    expect(countrySlugFromLabel('아르메니아')).toBe('armenia')
  })

  it('expands caucasus and middle-east browse country params', () => {
    expect(resolveBrowseCountryParamToCountryKeySlugs('caucasus')).toEqual(
      expect.arrayContaining(['georgia', 'azerbaijan', 'armenia']),
    )
    expect(resolveBrowseCountryParamToCountryKeySlugs('middle-east')).toEqual(
      expect.arrayContaining(['united-arab-emirates', 'jordan', 'oman']),
    )
  })

  it('LC leaf under 코카서스 uses country=georgia and menuGroup=caucasus', () => {
    const region = OVERSEAS_MEGA_MENU_REGIONS.find((r) => r.id === 'europe-me')
    const group = region?.countryGroups?.find((g) => g.countryLabel === '코카서스 3국')
    const leaf = group?.cities.find((c) => c.label === '조지아')
    expect(group && leaf).toBeTruthy()
    const href = buildMegaMenuLeafHref({
      type: 'travel',
      regionId: 'europe-me',
      countryLabel: group!.countryLabel,
      leaf: leaf!,
    })
    const u = new URL(href, 'http://localhost')
    expect(u.searchParams.get('country')).toBe('georgia')
    expect(u.searchParams.get('menuGroup')).toBe('caucasus')
  })

  it('두바이 city leaf keeps middle-east country with dubai city', () => {
    const region = OVERSEAS_MEGA_MENU_REGIONS.find((r) => r.id === 'europe-me')
    const group = region?.countryGroups?.find((g) => g.countryLabel === '중동')
    const leaf = group?.cities.find((c) => c.label === '두바이')
    expect(group && leaf).toBeTruthy()
    const href = buildMegaMenuLeafHref({
      type: 'travel',
      regionId: 'europe-me',
      countryLabel: group!.countryLabel,
      leaf: leaf!,
    })
    const u = new URL(href, 'http://localhost')
    expect(u.searchParams.get('country')).toBe('middle-east')
    expect(u.searchParams.get('city')).toBe('dubai')
  })

  it('maps mega-menu city URL slugs to master ProductCityTag keys', () => {
    expect(resolveBrowseCityKeysForFilter('okinawa')).toEqual(
      expect.arrayContaining(['okinawa-main']),
    )
    expect(resolveBrowseCityKeysForFilter('abu-dhabi')).toEqual(
      expect.arrayContaining(['abudhabi']),
    )
    expect(resolveBrowseCityKeysForFilter('hcm')).toEqual(expect.arrayContaining(['hochiminh']))
    expect(resolveBrowseCityKeysForFilter('chiang-mai')).toEqual(
      expect.arrayContaining(['chiangmai']),
    )
    expect(resolveBrowseCityKeysForFilter('new-york')).toEqual(expect.arrayContaining(['nyc']))
    expect(resolveBrowseCityKeysForFilter('san-francisco')).toEqual(expect.arrayContaining(['sf']))
    expect(resolveBrowseCityKeysForFilter('inner-mongolia')).toEqual(
      expect.arrayContaining(['hulunbuir', 'ordos']),
    )
  })

  it('내몽골 leaf uses country=china for china-tagged products', () => {
    const region = OVERSEAS_MEGA_MENU_REGIONS.find((r) => r.id === 'china-hk-mo')
    const group = region?.countryGroups?.find((g) => g.countryLabel === '몽골')
    const leaf = group?.cities.find((c) => c.label === '내몽골')
    expect(group && leaf).toBeTruthy()
    const href = buildMegaMenuLeafHref({
      type: 'travel',
      regionId: 'china-hk-mo',
      countryLabel: group!.countryLabel,
      leaf: leaf!,
    })
    const u = new URL(href, 'http://localhost')
    expect(u.searchParams.get('country')).toBe('china')
    expect(u.searchParams.get('city')).toBe('inner-mongolia')
    expect(u.searchParams.get('menuGroup')).toBe('mongolia')
  })

  it('화중 정주 leaf maps to zhengzhou master city key', () => {
    expect(countrySlugFromLabel('화중')).toBe('huazhong')
    expect(resolveBrowseCityKeysForFilter('zhengzhou')).toEqual(
      expect.arrayContaining(['zhengzhou']),
    )
    expect(resolveBrowseCityKeysForFilter('정주')).toEqual(expect.arrayContaining(['zhengzhou']))
    const region = OVERSEAS_MEGA_MENU_REGIONS.find((r) => r.id === 'china-hk-mo')
    const group = region?.countryGroups?.find((g) => g.countryLabel === '화중')
    const leaf = group?.cities.find((c) => c.label === '정주')
    expect(group && leaf).toBeTruthy()
    const href = buildMegaMenuLeafHref({
      type: 'travel',
      regionId: 'china-hk-mo',
      countryLabel: group!.countryLabel,
      headerBrowseCountryLabel: group!.headerBrowseCountryLabel,
      leaf: leaf!,
    })
    const u = new URL(href, 'http://localhost')
    expect(u.searchParams.get('country')).toBe('china')
    expect(u.searchParams.get('menuGroup')).toBe('huazhong')
    expect(u.searchParams.get('city')).toBe('zhengzhou')
  })
})
