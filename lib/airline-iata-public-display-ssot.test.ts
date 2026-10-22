import { describe, expect, it } from 'vitest'
import {
  canonicalizePublicAirlineKo,
  expandAirlineIataCodesInPublicTitle,
  formatPublicAirlineDisplay,
} from '@/lib/airline-iata-public-display-ssot'

describe('airline-iata-public-display-ssot', () => {
  it('제목의 단독 TW → 트리니티항공', () => {
    expect(
      expandAirlineIataCodesInPublicTitle('황금연휴기간 스위스/이탈리아 9일 TW #스위스 3days'),
    ).toContain('트리니티항공')
    expect(
      expandAirlineIataCodesInPublicTitle('황금연휴기간 스위스/이탈리아 9일 TW #스위스 3days'),
    ).not.toMatch(/\bTW\b/)
  })

  it('편명 TW245는 IATA 단독 치환하지 않음', () => {
    expect(expandAirlineIataCodesInPublicTitle('출발 TW245')).toContain('TW245')
  })

  it('TW → 트리니티항공', () => {
    expect(formatPublicAirlineDisplay('TW')).toBe('트리니티항공')
    expect(formatPublicAirlineDisplay('tw')).toBe('트리니티항공')
  })

  it('구 티웨이 브랜드 → 트리니티항공', () => {
    // REGRESSION-FREEZE[airline-tway-to-trinity]: legacy display remap — manifest
    expect(formatPublicAirlineDisplay('티웨이항공')).toBe('트리니티항공')
    expect(canonicalizePublicAirlineKo('티웨이')).toBe('트리니티항공')
    expect(canonicalizePublicAirlineKo('티웨이항공 직항')).toContain('트리니티항공')
  })
})
