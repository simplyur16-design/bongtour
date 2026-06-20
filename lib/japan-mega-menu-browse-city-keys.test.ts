import { describe, expect, it } from 'vitest'

import { resolveBrowseCityKeysForFilter, resolveBrowseCountryParamToCountryKeySlugs } from '@/lib/browse-country-url-resolve'

describe('resolveBrowseCountryParamToCountryKeySlugs — Japan master key', () => {
  it('maps japan browse slug to jp ProductCountryTag key', () => {
    expect(resolveBrowseCountryParamToCountryKeySlugs('japan')).toContain('jp')
  })
})

describe('resolveBrowseCityKeysForFilter — Japan cluster leaves', () => {
  it('도야 leaf includes cluster node and member city keys', () => {
    const keys = resolveBrowseCityKeysForFilter('toya')
    expect(keys).toContain('toya')
    expect(keys).toContain('toya-jozankei')
    expect(keys).toContain('jozankei')
  })

  it('후라노 leaf includes furano-biei cluster keys', () => {
    const keys = resolveBrowseCityKeysForFilter('furano')
    expect(keys).toContain('furano')
    expect(keys).toContain('furano-biei')
    expect(keys).toContain('biei')
  })

  it('센다이 leaf includes akita-sendai cluster keys', () => {
    const keys = resolveBrowseCityKeysForFilter('sendai')
    expect(keys).toContain('sendai')
    expect(keys).toContain('akita-sendai')
    expect(keys).toContain('akita')
  })

  it('간사이 direct cities include slug cityKey', () => {
    for (const slug of ['osaka', 'kyoto', 'nara', 'kobe']) {
      expect(resolveBrowseCityKeysForFilter(slug)).toContain(slug)
    }
  })
})
