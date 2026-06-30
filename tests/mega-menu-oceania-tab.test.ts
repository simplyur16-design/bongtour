import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { MEGA_MENU_TAB_DEFINITIONS } from '../lib/mega-menu-regions.data'
import { resolveBrowseCountryParamToCountryKeySlugs } from '../lib/browse-country-url-resolve'
import { buildMegaMenuLeafHref } from '../lib/top-nav-resolve'
import { OVERSEAS_MEGA_MENU_REGIONS } from '../lib/travel-landing-mega-menu-data'
import { megaMenuSubgroupLabelsInOrder } from '../lib/overseas-mega-region-city-group'

describe('oceania mega menu tab', () => {
  it('has three LC-only middle items (no city leaves)', () => {
    const tab = MEGA_MENU_TAB_DEFINITIONS.find((t) => t.id === 'oceania')
    assert.equal(tab?.label, '괌/사이판/호주/뉴질랜드')
    assert.equal(tab?.groups.length, 3)
    const labels = tab!.groups.map((g) => g.countryLabel)
    assert.deepEqual(labels, ['괌', '사이판', '호주/뉴질랜드'])
    for (const g of tab!.groups) {
      assert.equal(g.cities.length, 1)
      assert.equal(g.cities[0]?.kind, 'country')
      assert.equal(g.cities[0]?.label, g.countryLabel)
    }
  })

  it('browse subgroup order matches three middle items', () => {
    assert.deepEqual(megaMenuSubgroupLabelsInOrder('oceania'), ['괌', '사이판', '호주/뉴질랜드'])
  })

  it('호주/뉴질랜드 leaf href resolves to australia and newzealand country keys', () => {
    const region = OVERSEAS_MEGA_MENU_REGIONS.find((r) => r.id === 'oceania')!
    const g = region.countryGroups!.find((x) => x.countryLabel === '호주/뉴질랜드')!
    const leaf = g.cities[0]!
    const href = buildMegaMenuLeafHref({
      type: 'travel',
      regionId: 'oceania',
      countryLabel: g.countryLabel,
      headerBrowseCountryLabel: g.headerBrowseCountryLabel,
      leaf,
    })
    const country = new URL(href, 'http://localhost').searchParams.get('country')
    assert.equal(country, 'australia-new-zealand')
    const keys = resolveBrowseCountryParamToCountryKeySlugs(country)
    assert.ok(keys.includes('australia'))
    assert.ok(keys.includes('newzealand'))
  })
})
