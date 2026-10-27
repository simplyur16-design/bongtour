import { describe, expect, it } from 'vitest'
import { filterLocalDepartureTabsByCount, localDepartureTabCountUrl } from '@/lib/local-departure-tab-visibility'
import { MEGA_MENU_TAB_DEFINITIONS } from '@/lib/mega-menu-regions.data'
import { localDepartureTagForBrowseRegion } from '@/lib/browse-master-geo-continents'

describe('jeju_dep megamenu tab', () => {
  it('is defined after the other local-departure tabs and maps to the jeju tag', () => {
    const ids = MEGA_MENU_TAB_DEFINITIONS.map((t) => t.id)
    expect(ids.slice(-4)).toEqual(['busan_dep', 'cheongju_dep', 'daegu_dep', 'jeju_dep'])
    expect(MEGA_MENU_TAB_DEFINITIONS.find((t) => t.id === 'jeju_dep')?.localDeparture).toBe('jeju')
    expect(localDepartureTagForBrowseRegion('jeju_dep')).toBe('jeju')
  })
  it('is hidden when the count is 0 or unknown, shown when ≥1; other tabs untouched', () => {
    const tabs = MEGA_MENU_TAB_DEFINITIONS
    const hidden0 = filterLocalDepartureTabsByCount(tabs, { jeju: 0 }).map((t) => t.id)
    const hiddenUnknown = filterLocalDepartureTabsByCount(tabs, {}).map((t) => t.id)
    const shown = filterLocalDepartureTabsByCount(tabs, { jeju: 1 }).map((t) => t.id)
    expect(hidden0).not.toContain('jeju_dep')
    expect(hiddenUnknown).not.toContain('jeju_dep')
    expect(shown).toContain('jeju_dep')
    expect(hidden0).toContain('busan_dep')
    expect(hidden0).toContain('cheongju_dep')
    expect(hidden0).toContain('daegu_dep')
    expect(hidden0.length).toBe(tabs.length - 1)
  })
  it('builds the browse count url', () => {
    expect(localDepartureTabCountUrl('jeju')).toBe('/api/products/browse?region=jeju_dep&limit=1')
  })
})
