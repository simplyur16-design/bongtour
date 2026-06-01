import { describe, expect, it } from 'vitest'
import { filterCityKeysToCoherentMegaMenuGroup } from '@/lib/mega-menu-city-group-coherence'
import { buildMegaMenuSharedCityHaystackStopTerms } from '@/lib/mega-menu-city-haystack-terms'
import { matchMegaMenuCityKeysInHaystack } from '@/lib/mega-menu-master-city-keys'

describe('matchMegaMenuCityKeysInHaystack', () => {
  it('excludes shared country/region tokens like 일본 and 간사이', () => {
    const stops = buildMegaMenuSharedCityHaystackStopTerms()
    expect(stops.has('일본')).toBe(true)
    expect(stops.has('간사이')).toBe(true)
    expect(stops.has('홋카이도')).toBe(true)
    expect(stops.has('오사카')).toBe(false)
    expect(stops.has('후쿠오카')).toBe(false)
  })

  it('matches 오사카 product only to osaka', () => {
    const keys = matchMegaMenuCityKeysInHaystack('일본 오사카 3박4일 KIX')
    expect(keys).toContain('osaka')
    expect(keys).not.toContain('fukuoka')
    expect(keys).not.toContain('sapporo')
  })

  it('matches 후쿠오카 product only to fukuoka', () => {
    const keys = matchMegaMenuCityKeysInHaystack('일본 규슈 후쿠오카 4일')
    expect(keys).toContain('fukuoka')
    expect(keys).not.toContain('osaka')
  })

  it('does not tag all japan cities from 일본 alone', () => {
    const keys = matchMegaMenuCityKeysInHaystack('일본 전일정 자유여행')
    expect(keys).not.toContain('osaka')
    expect(keys).not.toContain('fukuoka')
    expect(keys).not.toContain('sapporo')
  })
})

describe('filterCityKeysToCoherentMegaMenuGroup', () => {
  it('drops other japan menu columns when primary is osaka', () => {
    const keys = filterCityKeysToCoherentMegaMenuGroup('osaka', ['osaka', 'sapporo', 'fukuoka'])
    expect(keys).toEqual(['osaka'])
  })
})
