import { describe, expect, it } from 'vitest'
import { deriveProductLocationKeyFieldsForPrisma } from '@/lib/product-location-key-match'
import { matchProductToOverseasNode } from '@/lib/match-overseas-product'
import {
  countCaucasusCountryGroupsInHaystack,
  detectCaucasusPackageFromHaystack,
} from '@/lib/caucasus-package-detect'

describe('caucasus-package-detect', () => {
  it('detects marker and multi-country haystack', () => {
    expect(detectCaucasusPackageFromHaystack('코카서스 3국 두바이 10일')).toBe(true)
    expect(countCaucasusCountryGroupsInHaystack('조지아, 아제르바이잔, 두바이')).toBe(2)
    expect(detectCaucasusPackageFromHaystack('조지아, 아제르바이잔, 아르메니아')).toBe(true)
    expect(detectCaucasusPackageFromHaystack('두바이 단독 5일')).toBe(false)
  })

  it('matchProductToOverseasNode prefers caucasus over dubai leaf', () => {
    const m = matchProductToOverseasNode({
      title: '코카서스 3국 두바이 10일',
      originSource: '',
      primaryDestination: '두바이',
    })
    expect(m?.countryKey).toBe('caucasus')
    expect(m?.countryLabel).toBe('코카서스 3국')
  })

  it('deriveProductLocationKeyFieldsForPrisma sets countryKey caucasus when dubai would win', () => {
    const geo = deriveProductLocationKeyFieldsForPrisma({
      title: '코카서스 3국 10일 KE #두바이관광',
      originSource: 'hanatour',
      primaryDestination: '두바이',
      destinationRaw: '아제르바이잔, 조지아, 아르메니아, 두바이',
    })
    expect(geo.countryKey).toBe('caucasus')
  })
})
