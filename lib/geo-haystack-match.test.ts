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

  it('does not treat 관광 as particle — 아일랜드관광 ≠ EU 아일랜드', () => {
    expect(termAppearsInHaystack('아일랜드', '아일랜드관광')).toBe(false)
    expect(termAppearsInHaystack('아일랜드', '사이판 /아일랜드관광/마나가하')).toBe(false)
    expect(termAppearsInHaystack('아일랜드', '아일랜드 더블린')).toBe(true)
  })

  // REGRESSION-FREEZE[saipan-island-tour-geo-priority]: 지명+아일랜드(섬) ≠ EU Ireland — manifest
  it('does not treat place-name + 아일랜드 (island) as EU Ireland', () => {
    expect(termAppearsInHaystack('아일랜드', '밴쿠버 - 그랜빌 아일랜드 크루즈')).toBe(false)
    expect(termAppearsInHaystack('아일랜드', '야스 아일랜드 워너 브라더스')).toBe(false)
    expect(termAppearsInHaystack('아일랜드', '보홀 아일랜드 파티룸')).toBe(false)
    expect(termAppearsInHaystack('아일랜드', '영국/스코틀랜드/아일랜드/웨일즈')).toBe(true)
    expect(termAppearsInHaystack('아일랜드', '아일랜드 공화국 일주')).toBe(true)
  })
})

describe('matchProductToOverseasNode — island 아일랜드 bleed', () => {
  it('Canada Granville Island schedule does not become Ireland', () => {
    const m = matchProductToOverseasNode({
      title: '캐나다 로키 7일 #밴쿠버 직항',
      originSource: '',
      primaryDestination: '캐나다',
      destinationRaw: '캐나다',
      destination: '캐나다',
    })
    expect(m?.countryKey).toMatch(/canada/i)
    const withIsland = matchProductToOverseasNode({
      title: '캐나다 로키 7일 #밴쿠버 직항',
      originSource: '',
      primaryDestination: '캐나다',
      destinationRaw: '캐나다\n밴쿠버 - 그랜빌 아일랜드 크루즈',
    })
    expect(withIsland?.countryKey).toMatch(/canada/i)
    expect(withIsland?.leafKey).not.toBe('ie')
  })

  it('Bohol island party destination does not become Ireland', () => {
    const m = matchProductToOverseasNode({
      title: '[2030전용] 보홀 5일 #헤난알로나비치',
      originSource: '',
      primaryDestination: '보홀',
      destinationRaw: '보홀 아일랜드 파티룸, 보홀 초콜릿힐',
    })
    expect(m?.countryKey).not.toMatch(/uk|ireland/i)
    expect(m?.leafKey).not.toBe('ie')
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
