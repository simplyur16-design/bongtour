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

  it('domestic-hub-only day — adjacent POI refill (departure forward / return backward)', () => {
    const out = applyDomesticHubOnlyDepartureReturnAdjacentKeywords([
      {
        day: 1,
        routeText: '인천',
        title: '-',
        description: '인천',
        imageKeyword: 'Incheon International Airport',
        imageKeyword2: null,
      },
      {
        day: 2,
        routeText: '달랏 - 다딴라폭포',
        title: '-',
        description: '달랏',
        imageKeyword: 'Datanla Waterfalls',
        imageKeyword2: 'Da Lat Vietnam Highland',
      },
      {
        day: 5,
        routeText: '인천',
        title: '-',
        description: '인천',
        imageKeyword: 'Nha Trang',
        imageKeyword2: null,
      },
      {
        day: 4,
        routeText: '나트랑 - 포나가 참 사원 - 롱선사',
        title: '-',
        description: '나트랑',
        imageKeyword: 'Nha Trang',
        imageKeyword2: 'Long Son Pagoda',
      },
    ])
    expect(out.find((r) => r.day === 1)!.imageKeyword).toMatch(/Datanla|Da Lat/i)
    expect(out.find((r) => r.day === 5)!.imageKeyword).toMatch(/Po Nagar|포/i)
    expect(out.find((r) => r.day === 5)!.imageKeyword).not.toMatch(/Nha Trang/i)
  })
})
