import { describe, expect, it } from 'vitest'
import {
  filterCityKeysToCoherentMegaMenuGroup,
  filterCrossGroupCityKeysUnlessNamed,
  megaMenuPlacementForCityKey,
  resetMegaMenuCityPlacementCache,
} from '@/lib/mega-menu-city-group-coherence'
import { countrySlugFromLabel } from '@/lib/location-url-slugs'
import { buildMegaMenuLeafHref } from '@/lib/top-nav-resolve'
import { MEGA_MENU_TAB_DEFINITIONS } from '@/lib/mega-menu-regions.data'
import {
  resolveBrowseCityKeysForFilter,
} from '@/lib/browse-country-url-resolve'
import { resolveMegaMenuGroupCityKeys } from '@/lib/mega-menu-browse-group'

describe('mega-menu-city-group-coherence', () => {
  it('indexes country leaf guam for placement', () => {
    resetMegaMenuCityPlacementCache()
    expect(megaMenuPlacementForCityKey('guam')?.regionId).toBe('oceania')
  })

  it('drops europe city tags when primary is guam', () => {
    resetMegaMenuCityPlacementCache()
    const out = filterCityKeysToCoherentMegaMenuGroup('guam', ['guam', 'ireland-mix', 'es'])
    expect(out).toEqual(['guam'])
  })

  it('keeps osaka+sapporo+fukuoka across japan menu columns', () => {
    resetMegaMenuCityPlacementCache()
    const out = filterCityKeysToCoherentMegaMenuGroup('osaka', ['osaka', 'sapporo', 'fukuoka'])
    expect(out).toEqual(['osaka', 'sapporo', 'fukuoka'])
  })

  // REGRESSION-FREEZE[mega-menu-guizhou-china]: 화남·중국 탭 placement — manifest
  it('규슈 상품에 간사이 교토는 제목에 이름이 없으면 빼고, 간사이 다도시·홋카이도·하와이는 유지', () => {
    resetMegaMenuCityPlacementCache()
    expect(filterCrossGroupCityKeysUnlessNamed('fukuoka', ['fukuoka', 'kyoto'], '규슈 4일')).toEqual(['fukuoka'])
    expect(
      filterCrossGroupCityKeysUnlessNamed('osaka', ['osaka', 'kyoto', 'nara', 'kobe'], '오사카 교토 나라 고베'),
    ).toEqual(['osaka', 'kyoto', 'nara', 'kobe'])
    expect(filterCrossGroupCityKeysUnlessNamed('sapporo', ['sapporo', 'otaru', 'hakodate'], '홋카이도')).toEqual([
      'sapporo',
      'otaru',
      'hakodate',
    ])
    expect(filterCrossGroupCityKeysUnlessNamed('honolulu', ['honolulu', 'maui', 'kauai'], '하와이')).toEqual([
      'honolulu',
      'maui',
      'kauai',
    ])
  })

  it('계림 상품 제목의 천저우만으로 샤먼 태그를 만들지 않음', () => {
    resetMegaMenuCityPlacementCache()
    expect(filterCrossGroupCityKeysUnlessNamed('guilin', ['guilin', 'xiamen'], '계림/천저우')).toEqual(['guilin'])
  })

  it('샤먼이 대표이면 화남의 성도·충칭은 이름 없이 빠짐', () => {
    resetMegaMenuCityPlacementCache()
    expect(
      filterCrossGroupCityKeysUnlessNamed('xiamen', ['xiamen', 'chengdu', 'chongqing'], '샤먼/토루/무이산'),
    ).toEqual(['xiamen'])
  })

  it('브루나이 country 슬러그는 brunei, 알래스카 leaf 는 미국+city=alaska, 조지아 leaf 는 그대로', () => {
    expect(countrySlugFromLabel('브루나이')).toBe('brunei')
    expect(countrySlugFromLabel('조지아')).toBe('georgia')
    const am = MEGA_MENU_TAB_DEFINITIONS.find((t) => t.id === 'americas')
    const alaska = am?.groups.find((g) => g.countryLabel === '알래스카')
    const leaf = alaska?.cities[0]
    const href = buildMegaMenuLeafHref({
      type: 'travel',
      regionId: 'americas',
      countryLabel: alaska!.countryLabel,
      headerBrowseCountryLabel: alaska!.headerBrowseCountryLabel,
      leaf: leaf!,
    })
    const u = new URL(href, 'http://localhost')
    expect(u.searchParams.get('country')).toBe('usa')
    expect(u.searchParams.get('city')).toBe('alaska')
    expect(u.searchParams.get('country')).not.toBe('alaska')
  })

  it('요코하마 city 키는 간토 그룹 키와 겹쳐 yokohama 가 남음', () => {
    const cityKeys = resolveBrowseCityKeysForFilter('yokohama')
    const groupKeys = resolveMegaMenuGroupCityKeys('japan', 'kanto')
    const filtered = cityKeys.filter((k) => groupKeys.includes(k))
    expect(cityKeys).toEqual(['yokohama'])
    expect(cityKeys).not.toContain('yamanashi')
    expect(filtered).toEqual(['yokohama'])
  })

  it('guizhou cityKey places under china-hk-mo / huanan', () => {
    resetMegaMenuCityPlacementCache()
    const p = megaMenuPlacementForCityKey('guizhou')
    expect(p?.regionId).toBe('china-hk-mo')
    expect(p?.menuGroupSlug).toBe('huanan')
  })
})
