/**
 * REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]
 */
import { describe, expect, it } from 'vitest'
import { enforceRegisterScheduleTripUniqueImageKeywords, sanitizeRegisterScheduleImageKeywordsOnDomesticHubOnlyDays } from '@/lib/register-schedule-trip-image-keyword-dedupe'

describe('enforceRegisterScheduleTripUniqueImageKeywords', () => {
  it('replaces duplicate primary with next unused route landmark', () => {
    const out = enforceRegisterScheduleTripUniqueImageKeywords([
      {
        day: 1,
        routeText: '인천 - 돗토리 - 미즈키시게루 로드',
        imageKeyword: 'Tottori',
        imageKeyword2: null,
      },
      {
        day: 2,
        routeText: '돗토리 - 미즈키시게루 로드',
        imageKeyword: 'Tottori',
        imageKeyword2: null,
      },
    ])
    expect(out[0]!.imageKeyword).toMatch(/Tottori/i)
    expect(out[1]!.imageKeyword).not.toMatch(/^Tottori$/i)
    expect(out[0]!.imageKeyword).not.toBe(out[1]!.imageKeyword)
  })

  it('clears duplicate when no alternate landmark on same route', () => {
    const out = enforceRegisterScheduleTripUniqueImageKeywords([
      { day: 1, routeText: '인천 - 레', imageKeyword: 'Leh', imageKeyword2: null },
      { day: 2, routeText: '인천 - 레', imageKeyword: 'Leh', imageKeyword2: null },
    ])
    expect(out[0]!.imageKeyword).toMatch(/Leh/i)
    expect(out[1]!.imageKeyword).not.toBe(out[0]!.imageKeyword)
  })

  it('domestic-hub-only day — strips foreign tourism keyword leak', () => {
    const out = sanitizeRegisterScheduleImageKeywordsOnDomesticHubOnlyDays([
      {
        day: 5,
        routeText: '인천',
        title: '-',
        description: '인천',
        imageKeyword: 'Nha Trang Beach Vietnam Turquoise Sea',
        imageKeyword2: null,
      },
    ])
    expect(out[0]!.imageKeyword).toBe('')
    expect(out[0]!.imageKeyword2).toBeNull()
  })
})
