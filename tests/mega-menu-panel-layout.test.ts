import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  megaMenuPanelColumnCount,
  megaMenuPanelUsesInnerScroll,
  resolveMegaMenuPanelLayout,
} from '../lib/mega-menu-panel-layout'
import { TOP_NAV_MEGA_REGIONS } from '../lib/top-nav-resolve'

describe('mega-menu-panel-layout', () => {
  it('southeast-asia uses 7 columns and no inner scroll', () => {
    const sea = TOP_NAV_MEGA_REGIONS.find((r) => r.id === 'southeast-asia')!
    assert.equal(megaMenuPanelColumnCount('southeast-asia', sea.countryGroups!.length), 7)
    const layout = resolveMegaMenuPanelLayout('southeast-asia', sea.countryGroups!)
    assert.equal(layout.gridColsClass, 'grid-cols-7')
    assert.equal(layout.innerScroll, false)
    assert.equal(layout.compact, true)
  })

  it('oceania stays 4 columns', () => {
    assert.equal(megaMenuPanelColumnCount('oceania', 4), 4)
    assert.equal(megaMenuPanelUsesInnerScroll('oceania', 4, 6), false)
  })
})
