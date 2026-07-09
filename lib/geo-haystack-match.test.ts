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

  it('includes scheduleHaystack for multi-country detection', () => {
    const hay = buildMultiCountryDetectionHaystack({
      title: '4국 북유럽',
      primaryDestination: null,
      destinationRaw: null,
      scheduleHaystack: '오슬로 - 스톡홀름 - 코펜하겐',
    })
    expect(hay).toContain('오슬로')
    expect(hay).toContain('스톡홀름')
  })

  it('matches single-char 괌 with word boundary', () => {
    expect(termAppearsInHaystack('괌', '괌 닛코 호텔')).toBe(true)
    expect(termAppearsInHaystack('괌', '닛코괌호텔')).toBe(false)
  })

  it('matches Korean city before particle (의·입성)', () => {
    expect(termAppearsInHaystack('샌프란시스코', '샌프란시스코의 상징인 금문교')).toBe(true)
    expect(termAppearsInHaystack('라스베이거스', '바스토우 쇼핑 및 라스베이거스 입성')).toBe(true)
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
