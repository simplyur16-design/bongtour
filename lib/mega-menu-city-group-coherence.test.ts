import { describe, expect, it } from 'vitest'
import {
  filterCityKeysToCoherentMegaMenuGroup,
  megaMenuPlacementForCityKey,
  resetMegaMenuCityPlacementCache,
} from '@/lib/mega-menu-city-group-coherence'

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
  it('guizhou cityKey places under china-hk-mo / huanan', () => {
    resetMegaMenuCityPlacementCache()
    const p = megaMenuPlacementForCityKey('guizhou')
    expect(p?.regionId).toBe('china-hk-mo')
    expect(p?.menuGroupSlug).toBe('huanan')
  })
})
