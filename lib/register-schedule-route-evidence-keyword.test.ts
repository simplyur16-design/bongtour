/**
 * REGRESSION-FREEZE[register-schedule-forbidden-city-route-evidence]
 */
import { describe, expect, it } from 'vitest'
import { applyRegisterScheduleImageKeywordsBySupplier } from './register-schedule-image-keywords-apply'
import {
  registerScheduleKeywordPassesRouteEvidence,
  sanitizeRegisterScheduleImageKeywordsFromRouteEvidence,
} from './register-schedule-route-evidence-keyword'

describe('register-schedule-route-evidence-keyword', () => {
  it('Forbidden City — 일정에 영문 literal 없으면 거부', () => {
    const row = { routeText: '인천 - 북경 - 천안문광장', title: '1일차', description: '입국' }
    expect(registerScheduleKeywordPassesRouteEvidence('Beijing', row)).toBe(true)
    expect(registerScheduleKeywordPassesRouteEvidence('Forbidden City', row)).toBe(false)
    expect(registerScheduleKeywordPassesRouteEvidence('Forbidden City', { routeText: 'Forbidden City tour' })).toBe(
      true,
    )
  })

  it('sanitize — LLM·regex 환각 Forbidden 제거', () => {
    const out = sanitizeRegisterScheduleImageKeywordsFromRouteEvidence([
      {
        day: 1,
        routeText: '북경 - 천안문광장',
        imageKeyword: 'Forbidden City',
        imageKeyword2: 'Tiananmen Square',
      },
    ])
    expect(out[0]?.imageKeyword).toBe('')
    expect(out[0]?.imageKeyword2).toBe('Tiananmen Square')
  })
  it('applyRegisterScheduleImageKeywordsBySupplier — 6공급사 공통 sanitize', () => {
    const rows = [
      {
        day: 1,
        title: '입국',
        description: '북경 도착',
        routeText: '인천 - 북경',
        imageKeyword: 'Forbidden City',
        imageKeyword2: null,
      },
    ]
    for (const supplierKey of ['modetour', 'hanatour', 'ybtour', 'lottetour', 'kyowontour', 'verygoodtour'] as const) {
      const out = applyRegisterScheduleImageKeywordsBySupplier(rows, {
        supplierKey,
        productDestination: '중국',
      })
      const kw = String(out[0]?.imageKeyword ?? '')
      expect(kw.toLowerCase()).not.toMatch(/forbidden/)
    }
  })
})
