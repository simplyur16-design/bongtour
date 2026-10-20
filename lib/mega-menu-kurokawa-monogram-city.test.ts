import { describe, expect, it } from 'vitest'
import { matchProductToOverseasNode } from '@/lib/match-overseas-product'
import { resolveOverseasDisplayBucketForBrowse } from '@/lib/overseas-display-buckets'
import { matchMegaMenuCityKeysInHaystack } from '@/lib/mega-menu-master-city-keys'
import { resetMegaMenuCityPlacementCache, megaMenuPlacementForCityKey } from '@/lib/mega-menu-city-group-coherence'

// REGRESSION-FREEZE[mega-menu-kurokawa-monogram-city]: 쿠로가와→구마모토 · 신라모노그램→다낭 — manifest
describe('mega-menu kurokawa / shinra monogram city', () => {
  it('쿠로가와 haystack matches kumamoto · japan bucket (not other)', () => {
    resetMegaMenuCityPlacementCache()
    const keys = matchMegaMenuCityKeysInHaystack('쿠로가와 료칸')
    expect(keys).toContain('kumamoto')
    expect(megaMenuPlacementForCityKey('kumamoto')?.regionId).toBe('japan')
    expect(megaMenuPlacementForCityKey('kumamoto')?.menuGroupSlug).toBe('kyushu')

    const m = matchProductToOverseasNode({
      title: '쿠로가와 료칸',
      originSource: 'naeiltour',
      primaryDestination: '쿠로가와 료칸',
      destination: '쿠로가와 료칸',
    })
    expect(
      resolveOverseasDisplayBucketForBrowse(
        {
          title: '쿠로가와 료칸',
          primaryDestination: '쿠로가와 료칸',
          destination: '쿠로가와 료칸',
        },
        m,
      ),
    ).toBe('japan')
  })

  it('신라모노그램·바나힐 haystack matches danang · sea_taiwan (not other)', () => {
    resetMegaMenuCityPlacementCache()
    expect(matchMegaMenuCityKeysInHaystack('5성호텔 #신라모노그램 망고빙수 #바나힐 5일')).toContain(
      'danang',
    )
    expect(matchMegaMenuCityKeysInHaystack('#바나힐 5일')).toContain('danang')
    expect(megaMenuPlacementForCityKey('danang')?.regionId).toBe('southeast-asia')

    const m = matchProductToOverseasNode({
      title: '5성호텔 #신라모노그램 망고빙수 #전신마사지 #바나힐 5일',
      originSource: 'verygoodtour',
      primaryDestination: '바나',
      destination: '바나',
    })
    expect(
      resolveOverseasDisplayBucketForBrowse(
        {
          title: '5성호텔 #신라모노그램 망고빙수 #전신마사지 #바나힐 5일',
          primaryDestination: '바나',
          destination: '바나',
          cityKey: 'danang',
        },
        m,
      ),
    ).toBe('sea_taiwan')
  })

  it('cityKey danang/kumamoto forces bucket even when tree match is null', () => {
    expect(
      resolveOverseasDisplayBucketForBrowse(
        { title: 'x', primaryDestination: null, destination: null, cityKey: 'danang' },
        null,
      ),
    ).toBe('sea_taiwan')
    expect(
      resolveOverseasDisplayBucketForBrowse(
        { title: 'x', primaryDestination: null, destination: null, cityKey: 'kumamoto' },
        null,
      ),
    ).toBe('japan')
  })
})
