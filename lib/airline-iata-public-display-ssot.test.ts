import { describe, expect, it } from 'vitest'
import {
  airlineIataToKoPublic,
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

describe('VZ 비엣젯 타일랜드 (사장님 10/31 00:17, 표시 전용)', () => {
  it('VZ 코드·편명 → 비엣젯 타일랜드, VJ 는 비엣젯항공 그대로', () => {
    expect(airlineIataToKoPublic('VZ')).toBe('비엣젯 타일랜드')
    expect(formatPublicAirlineDisplay('VZ')).toBe('비엣젯 타일랜드')
    expect(formatPublicAirlineDisplay('VZ0851')).toBe('비엣젯 타일랜드')
    expect(formatPublicAirlineDisplay('VJ')).toBe('비엣젯항공')
    expect(formatPublicAirlineDisplay('VJ0979')).toBe('비엣젯항공')
    expect(formatPublicAirlineDisplay('비엣젯항공')).toBe('비엣젯항공')
  })
  it('코드 없는 타이비엣젯 / 타이비엣젯항공 / 띄어쓰기 변형 → 비엣젯 타일랜드', () => {
    for (const raw of ['타이비엣젯', '타이비엣젯항공', '타이 비엣젯', '타이 비엣젯항공', '타이비엣젯 항공']) {
      expect(formatPublicAirlineDisplay(raw)).toBe('비엣젯 타일랜드')
    }
    expect(formatPublicAirlineDisplay('비엣젯 타일랜드')).toBe('비엣젯 타일랜드')
  })
  it('타이항공(TG)은 그대로', () => {
    expect(formatPublicAirlineDisplay('TG')).toBe('타이항공')
    expect(formatPublicAirlineDisplay('타이항공')).toBe('타이항공')
  })
  it('공급사 파싱·저장 경로(canonicalizePublicAirlineKo)는 원문 유지', () => {
    expect(canonicalizePublicAirlineKo('타이비엣젯')).toBe('타이비엣젯')
    expect(canonicalizePublicAirlineKo('타이비엣젯항공')).toBe('타이비엣젯항공')
  })
})
