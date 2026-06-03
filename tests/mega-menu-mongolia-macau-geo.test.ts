import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { resolveBrowseCityKeysForFilter, resolveBrowseCountryParamToCountryKeySlugs } from '../lib/browse-country-url-resolve'
import { termAppearsInHaystack } from '../lib/geo-haystack-match'
import { buildMegaMenuCityHaystackIndex } from '../lib/mega-menu-city-haystack-terms'
import { matchProductToOverseasNode } from '../lib/match-overseas-product'
import { mapTreeKeysToMasterKeys } from '../lib/product-master-mapping'
import { buildMegaMenuLeafHref } from '../lib/top-nav-resolve'
import { MEGA_MENU_TAB_DEFINITIONS } from '../lib/mega-menu-regions.data'

describe('geo haystack — 내몽골 vs 몽골', () => {
  it('내몽골 문구에 몽골 단독 토큰은 매칭하지 않음', () => {
    assert.equal(termAppearsInHaystack('몽골', '내몽골 4일 패키지'), false)
    assert.equal(termAppearsInHaystack('내몽골', '내몽골 4일 패키지'), true)
    assert.equal(termAppearsInHaystack('몽골', '몽골 5일'), true)
  })
})

describe('matchProductToOverseasNode — 몽골·마카오·내몽골', () => {
  it('몽골·마카오·울란바타르·테를지', () => {
    const m1 = matchProductToOverseasNode({
      title: '울란바타르 몽골 5일',
      originSource: 'ybtour',
      primaryDestination: '몽골',
    })
    assert.equal(m1?.countryKey, 'mongolia')
    assert.equal(m1?.leafKey, 'ulaanbaatar')

    const m2 = matchProductToOverseasNode({
      title: '마카오 3일',
      originSource: 'ybtour',
      primaryDestination: '마카오',
    })
    assert.equal(m2?.countryKey, 'hk-mo-sz')
    assert.equal(m2?.leafKey, 'macau')

    const mapped = mapTreeKeysToMasterKeys({
      groupKey: m2!.groupKey,
      countryKey: m2!.countryKey,
      nodeKey: m2!.leafKey,
    })
    assert.equal(mapped.masterCountryKey, 'macau')
    assert.equal(mapped.cityKey, 'macau')

    const terelj = matchProductToOverseasNode({
      title: '테를지 국립공원 4일',
      originSource: 'ybtour',
      primaryDestination: '테를지',
    })
    assert.equal(terelj?.countryKey, 'mongolia')
    assert.equal(terelj?.leafKey, 'terelj')

    const inner = matchProductToOverseasNode({
      title: '내몽골 4일',
      originSource: 'ybtour',
      primaryDestination: '내몽골',
    })
    assert.equal(inner?.countryKey, 'inner-mongolia')
    assert.notEqual(inner?.countryKey, 'mongolia')
  })
})

describe('mega menu SSOT — china-hk-mo', () => {
  it('몽골·마카오 browse 슬러그·도시 키', () => {
    const idx = buildMegaMenuCityHaystackIndex()
    assert.equal(idx.cityKeys.has('terelj'), true)
    assert.equal(idx.cityKeys.has('ulaanbaatar'), true)

    assert.deepEqual(resolveBrowseCountryParamToCountryKeySlugs('mongolia'), ['mongolia'])
    assert.ok(resolveBrowseCountryParamToCountryKeySlugs('macau').includes('macau'))

    const tab = MEGA_MENU_TAB_DEFINITIONS.find((t) => t.id === 'china-hk-mo')!
    const moGroup = tab.groups.find((g) => g.countryLabel === '마카오')!
    const href = buildMegaMenuLeafHref({
      type: 'travel',
      regionId: 'china-hk-mo',
      countryLabel: moGroup.countryLabel,
      leaf: moGroup.cities[0]!,
    })
    assert.ok(href.includes('country=macau'))
    assert.ok(!href.includes('city='))

    const tereljKeys = resolveBrowseCityKeysForFilter('terelj')
    assert.ok(tereljKeys.includes('terelj'))
    const ulaanKeys = resolveBrowseCityKeysForFilter('ulaanbaatar')
    assert.ok(ulaanKeys.includes('ulaanbaatar'))
  })
})
