/**
 * REGRESSION-FREEZE[register-schedule-route-place-noise]
 */
import { describe, expect, it } from 'vitest'
import { isRegisterScheduleRoutePlaceNoise, sanitizeRegisterScheduleRouteText } from '@/lib/register-schedule-route-place-noise'
import { joinLottetourScheduleRouteText } from '@/lib/lottetour-register-api-schedule'
import { buildKyowontourScheduleRouteTextFromTabRows } from '@/lib/kyowontour-register-api-schedule'
import { applyRegisterScheduleImageKeywordsBySupplier } from '@/lib/register-schedule-image-keywords-apply'
import { modetourFactDaysToRegisterSchedule } from '@/lib/modetour-register-api-schedule'
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

  it('sanitizeRegisterScheduleRouteText strips admin guidance from existing routeText', () => {
    expect(
      sanitizeRegisterScheduleRouteText(
        '인천 - 돗토리 - 한국-일본 여행 입국시 관련 안내 - 미즈키시게루 로드',
      ),
    ).toBe('인천 - 돗토리 - 미즈키시게루 로드')
  })

  it('modetour apply — trip imageKeyword must not repeat across days (돗토리 3일)', () => {
    const days = modetourFactDaysToRegisterSchedule(
      [
        {
          day: 1,
          places: ['인천', '돗토리', '한국-일본 여행 입국시 관련 안내', '미즈키시게루 로드'],
          hotels: ['총 0개의 예정 호텔'],
          meals: [],
          transportNote: null,
        },
        {
          day: 2,
          places: [
            '요나고',
            '돗토리',
            '돗토리 사구 모래미술관',
            '20세기 배 기념관(나싯코관)',
            '코난 박물관 (아오야마 고쇼 기념관)',
          ],
          hotels: ['총 0개의 예정 호텔'],
          meals: [],
          transportNote: null,
        },
        {
          day: 3,
          places: ['마츠에', '인천', '아다치 미술관', '마쓰에성', '시오미나와테 거리'],
          hotels: [],
          meals: [],
          transportNote: null,
        },
      ],
      { productTitle: '[마이리틀시티 돗토리]요나고/마츠에 3일' },
    )
    const out = applyRegisterScheduleImageKeywordsBySupplier(days, {
      supplierKey: 'modetour',
      productDestination: '돗토리',
      productTitle: 'test',
    })
    const kws = out.map((r) => String(r.imageKeyword ?? '').trim()).filter(Boolean)
    expect(new Set(kws.map((k) => k.toLowerCase())).size).toBe(kws.length)
    expect(days[0]?.routeText).not.toMatch(/입국|관련\s*안내/)
    expect(String(out[2]?.imageKeyword ?? '').trim().length).toBeGreaterThan(0)
    expect(String(out[0]?.imageKeyword ?? '').trim().length).toBeGreaterThan(0)
  })
})
