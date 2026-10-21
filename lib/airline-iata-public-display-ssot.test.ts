import { describe, expect, it } from 'vitest'
import {
  expandAirlineIataCodesInPublicTitle,
  formatPublicAirlineDisplay,
} from '@/lib/airline-iata-public-display-ssot'

// REGRESSION-FREEZE[public-hero-airline-iata-ko]: 히어로 제목·항공 줄 — manifest

describe('expandAirlineIataCodesInPublicTitle', () => {
  it('제목의 단독 TW → 티웨이항공', () => {
    expect(
      expandAirlineIataCodesInPublicTitle('황금연휴기간 스위스/이탈리아 9일 TW #스위스 3days'),
    ).toContain('티웨이항공')
    expect(
      expandAirlineIataCodesInPublicTitle('황금연휴기간 스위스/이탈리아 9일 TW #스위스 3days'),
    ).not.toMatch(/\bTW\b/)
  })

  it('편명 TW245는 유지', () => {
    expect(expandAirlineIataCodesInPublicTitle('출발 15:00 TW245 인천')).toBe(
      '출발 15:00 TW245 인천',
    )
  })

  it('[KE] 브래킷 코드도 한글화', () => {
    expect(expandAirlineIataCodesInPublicTitle('[KE] 오사카 3일')).toBe('[대한항공] 오사카 3일')
  })
})

describe('formatPublicAirlineDisplay', () => {
  it('TW → 티웨이항공', () => {
    expect(formatPublicAirlineDisplay('TW')).toBe('티웨이항공')
    expect(formatPublicAirlineDisplay('tw')).toBe('티웨이항공')
  })

  it('이미 한글명이면 유지', () => {
    expect(formatPublicAirlineDisplay('티웨이항공')).toBe('티웨이항공')
  })
})
