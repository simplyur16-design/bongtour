/**
 * REGRESSION-FREEZE[register-schedule-route-place-noise]
 */
import { describe, expect, it } from 'vitest'
import { isRegisterScheduleRoutePlaceNoise } from '@/lib/register-schedule-route-place-noise'
import { joinLottetourScheduleRouteText } from '@/lib/lottetour-register-api-schedule'
import { buildKyowontourScheduleRouteTextFromTabRows } from '@/lib/kyowontour-register-api-schedule'
import type { KyowontourScheduleRowParsed } from '@/lib/kyowontour-tour-event-tab-data'

describe('register schedule route place noise', () => {
  it('blocks immigration/admin guidance segments', () => {
    expect(isRegisterScheduleRoutePlaceNoise('한국-일본 여행 입국시 관련 안내')).toBe(true)
    expect(isRegisterScheduleRoutePlaceNoise('여행일정')).toBe(true)
    expect(isRegisterScheduleRoutePlaceNoise('돗토리')).toBe(false)
    expect(isRegisterScheduleRoutePlaceNoise('미즈키시게루 로드')).toBe(false)
  })

  it('joinLottetourScheduleRouteText drops admin guidance', () => {
    const chain = joinLottetourScheduleRouteText([
      '인천',
      '돗토리',
      '한국-일본 여행 입국시 관련 안내',
      '미즈키시게루 로드',
    ])
    expect(chain).toBe('인천 - 돗토리 - 미즈키시게루 로드')
    expect(chain).not.toMatch(/입국|관련\s*안내|한국-일본\s*여행/)
  })

  it('kyowontour tab rows skip admin guidance in routeText', () => {
    const rows: KyowontourScheduleRowParsed[] = [
      { step: 1, type: '이동', nameKo: '인천국제공항 출발', tmContent: '' },
      { step: 2, type: '이동', nameKo: '돗토리', tmContent: '' },
      { step: 3, type: '관광', nameKo: '한국-일본 여행 입국시 관련 안내', tmContent: '' },
      { step: 4, type: '관광', nameKo: '미즈키시게루 로드', tmContent: '' },
    ]
    expect(buildKyowontourScheduleRouteTextFromTabRows(rows)).toBe('인천 - 돗토리 - 미즈키시게루 로드')
  })
})
