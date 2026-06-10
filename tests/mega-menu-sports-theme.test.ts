import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { MEGA_MENU_TAB_DEFINITIONS } from '../lib/mega-menu-regions.data'
import { SPORTS_THEME_TAG_LABELS, SPORTS_THEME_TAG_VALUES } from '../lib/product-listing-kind'
import { buildMegaMenuGroupHeaderHref } from '../lib/top-nav-resolve'

describe('mega menu sports_theme tab', () => {
  it('uses five middle-classification groups (running, trekking, …)', () => {
    const tab = MEGA_MENU_TAB_DEFINITIONS.find((t) => t.id === 'sports_theme')!
    assert.equal(tab.groups.length, SPORTS_THEME_TAG_VALUES.length)
    assert.deepEqual(
      tab.groups.map((g) => g.countryLabel),
      SPORTS_THEME_TAG_VALUES.map((k) => SPORTS_THEME_TAG_LABELS[k]),
    )
    for (let i = 0; i < tab.groups.length; i++) {
      const g = tab.groups[i]!
      const key = SPORTS_THEME_TAG_VALUES[i]!
      assert.equal(g.headerBrowseCountryLabel, key)
      assert.equal(g.cities.length, 0)
    }
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
