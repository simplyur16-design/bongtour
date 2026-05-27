import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  BROWSE_TAB_ID_TO_CARD_KEYS,
  MEGA_MENU_TAB_DEFINITIONS,
} from '../lib/mega-menu-regions.data'
import { continentTabIdForMatch } from '../lib/unified-location-tree'
import { buildMegaMenuRegionCardPayload } from '../scripts/seed-master-data'

describe('south-america mega menu tab', () => {
  it('MEGA_MENU_TAB_DEFINITIONS includes south-america after americas', () => {
    const ids = MEGA_MENU_TAB_DEFINITIONS.map((t) => t.id)
    const amIdx = ids.indexOf('americas')
    const saIdx = ids.indexOf('south-america')
    assert.ok(amIdx >= 0)
    assert.ok(saIdx > amIdx)
    const sa = MEGA_MENU_TAB_DEFINITIONS.find((t) => t.id === 'south-america')
    assert.equal(sa?.label, '중남미')
    assert.equal(sa?.groups[0]?.cities.length, 8)
  })

  it('BROWSE_TAB_ID_TO_CARD_KEYS splits americas vs south-america cards', () => {
    assert.deepEqual(BROWSE_TAB_ID_TO_CARD_KEYS.americas, ['americas'])
    assert.deepEqual(BROWSE_TAB_ID_TO_CARD_KEYS['south-america'], ['latin-caribbean-cluster'])
  })

  it('continentTabIdForMatch routes latin americas keys to south-america tab', () => {
    assert.equal(continentTabIdForMatch('americas', 'mexico'), 'south-america')
    assert.equal(continentTabIdForMatch('americas', 'cuba'), 'south-america')
    assert.equal(continentTabIdForMatch('americas', 'latin-caribbean'), 'south-america')
    assert.equal(continentTabIdForMatch('americas', 'dominican-republic'), 'south-america')
    assert.equal(continentTabIdForMatch('americas', 'usa-west'), 'americas')
    assert.equal(continentTabIdForMatch('americas', 'canada'), 'americas')
  })

  it('collectMegaMenuRegionCoverage excludes latin-caribbean from americas card', () => {
    const payload = buildMegaMenuRegionCardPayload()
    const americasCountries = payload.cardCountryPairs
      .filter((p) => p.cardKey === 'americas')
      .map((p) => p.countryKey)
    const latinKeys = [
      'mexico',
      'cuba',
      'peru',
      'brazil',
      'argentina',
      'chile',
      'bolivia',
      'dominican-republic',
    ]
    for (const k of latinKeys) {
      assert.ok(!americasCountries.includes(k), `americas card must not include ${k}`)
    }
    assert.ok(americasCountries.includes('united-states'))
    assert.ok(americasCountries.includes('canada'))
  })
})
