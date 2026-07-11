import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { MEGA_MENU_TAB_DEFINITIONS } from '../lib/mega-menu-regions.data'
import { SPORTS_THEME_TAG_LABELS, SPORTS_THEME_TAG_VALUES } from '../lib/product-listing-kind'
import { TOP_NAV_MEGA_REGIONS, buildMegaMenuGroupHeaderHref } from '../lib/top-nav-resolve'

describe('mega menu sports_theme tab (테마여행)', () => {
  it('uses theme middle-classification groups including mingling', () => {
    const tab = MEGA_MENU_TAB_DEFINITIONS.find((t) => t.id === 'sports_theme')!
    assert.equal(tab.label, '테마여행')
    assert.equal(tab.groups.length, SPORTS_THEME_TAG_VALUES.length)
    assert.deepEqual(
      tab.groups.map((g) => g.countryLabel),
      SPORTS_THEME_TAG_VALUES.map((k) => SPORTS_THEME_TAG_LABELS[k]),
    )
    assert.equal(SPORTS_THEME_TAG_LABELS.mingling, '밍글밍')
    const labels = SPORTS_THEME_TAG_VALUES.map((k) => SPORTS_THEME_TAG_LABELS[k])
    assert.deepEqual(labels, [...labels].sort((a, b) => a.localeCompare(b, 'ko')), '가나다순')
    for (let i = 0; i < tab.groups.length; i++) {
      const g = tab.groups[i]!
      const key = SPORTS_THEME_TAG_VALUES[i]!
      assert.equal(g.headerBrowseCountryLabel, key)
      assert.equal(g.cities.length, 1)
      assert.equal(g.cities[0]!.label, SPORTS_THEME_TAG_LABELS[key])
    }
  })

  it('sports_theme tab is exposed in top nav mega regions', () => {
    const tab = TOP_NAV_MEGA_REGIONS.find((r) => r.id === 'sports_theme')
    assert.ok(tab, 'sports_theme must appear in TOP_NAV_MEGA_REGIONS')
    assert.equal(tab!.countryGroups?.length, SPORTS_THEME_TAG_VALUES.length)
  })

  it('group header href sets sportsTheme query', () => {
    const href = buildMegaMenuGroupHeaderHref({
      type: 'travel',
      regionId: 'sports_theme',
      countryLabel: '러닝',
      headerBrowseCountryLabel: 'running',
    })
    assert.match(href, /region=sports_theme/)
    assert.match(href, /sportsTheme=running/)
  })
})
