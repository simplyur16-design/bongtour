import { describe, expect, it } from 'vitest'
import { isRegisterScheduleCrossContinentHallucinationKeyword } from '@/lib/register-schedule-cross-continent-keyword-guard'

describe('cambodia vs vietnam keyword guard', () => {
  // REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: 앙코르≠하노이 cross-country scrub — manifest
  it('flags Hanoi keyword on Cambodia-only Angkor trip', () => {
    const rows = [
      { day: 1, routeText: '인천 - 씨엠립' },
      { day: 2, routeText: '앙코르와트 - 바이욘' },
      { day: 3, routeText: '씨엠립 - 인천' },
    ]
    expect(
      isRegisterScheduleCrossContinentHallucinationKeyword('Hanoi Old Quarter', '캄보디아 앙코르', rows),
    ).toBe(true)
    expect(
      isRegisterScheduleCrossContinentHallucinationKeyword('Angkor Wat Cambodia temple sunrise', '캄보디아 앙코르', rows),
    ).toBe(false)
  })

  it('allows Hanoi on Cambodia+Vietnam combo trip', () => {
    const rows = [
      { day: 1, routeText: '씨엠립 - 앙코르' },
      { day: 2, routeText: '하노이 올드쿼터' },
      { day: 3, routeText: '하롱베이' },
    ]
    expect(
      isRegisterScheduleCrossContinentHallucinationKeyword('Hanoi Old Quarter', '캄보디아/베트남', rows),
    ).toBe(false)
  })
})
