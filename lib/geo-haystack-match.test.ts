import { describe, expect, it } from 'vitest'
import {
  buildMultiCountryDetectionHaystack,
  termAppearsInHaystack,
} from '@/lib/geo-haystack-match'
import { matchProductToOverseasNode } from '@/lib/match-overseas-product'

describe('geo-haystack-match', () => {
  it('puts destinations before title in multi-country haystack', () => {
    const hay = buildMultiCountryDetectionHaystack({
      title: '괌 닛코 오션프론트',
      primaryDestination: '괌',
      destinationRaw: null,
    })
    expect(hay.startsWith('괌')).toBe(true)
  })

  it('matches single-char 괌 with word boundary', () => {
    expect(termAppearsInHaystack('괌', '괌 닛코 호텔')).toBe(true)
    expect(termAppearsInHaystack('괌', '닛코괌호텔')).toBe(false)
  })
})

describe('matchProductToOverseasNode guam vs nikko', () => {
  it('prefers 괌 when title leads with guam', () => {
    const m = matchProductToOverseasNode({
      title: '괌 닛코 오션프론트룸 3박5일',
      originSource: '',
      primaryDestination: null,
      destinationRaw: null,
    })
    expect(m?.countryKey).toBe('guam')
    expect(m?.leafKey).toBe('guam')
  })
})
