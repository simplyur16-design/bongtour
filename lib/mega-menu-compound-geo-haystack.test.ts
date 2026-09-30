/**
 * REGRESSION-FREEZE[mega-menu-compound-geo-haystack]: browse uk↔united-kingdom · china-major↔china — manifest
 */
import { describe, expect, it } from 'vitest'
import { resolveBrowseCountryParamToCountryKeySlugs } from '@/lib/browse-country-url-resolve'

describe('mega-menu-compound-geo-haystack — browse country tag expansion', () => {
  it('uk / 영국 browse includes united-kingdom ProductCountryTag', () => {
    expect(resolveBrowseCountryParamToCountryKeySlugs('uk')).toEqual(
      expect.arrayContaining(['uk', 'united-kingdom']),
    )
    expect(resolveBrowseCountryParamToCountryKeySlugs('영국')).toEqual(
      expect.arrayContaining(['uk', 'united-kingdom']),
    )
  })

  it('china-major browse includes china master tag (귀주성 등)', () => {
    expect(resolveBrowseCountryParamToCountryKeySlugs('china-major')).toEqual(
      expect.arrayContaining(['china-major', 'china']),
    )
  })
})
