/**
 * REGRESSION-FREEZE[register-schedule-route-place-noise]
 */
import { describe, expect, it } from 'vitest'
import {
  extractRegisterScheduleRoutePlaceLabel,
  isRegisterScheduleDomesticHubRouteSegment,
  isRegisterScheduleRoutePlaceNoise,
  sanitizeRegisterScheduleRouteText,
  stripRegisterScheduleRouteSegmentLodgingSuffix,
} from '@/lib/register-schedule-route-place-noise'
import { joinLottetourScheduleRouteText } from '@/lib/lottetour-register-api-schedule'
import { buildKyowontourScheduleRouteTextFromTabRows } from '@/lib/kyowontour-register-api-schedule'
import { applyRegisterScheduleImageKeywordsBySupplier } from '@/lib/register-schedule-image-keywords-apply'
import { modetourFactDaysToRegisterSchedule } from '@/lib/modetour-register-api-schedule'
import type { KyowontourScheduleRowParsed } from '@/lib/kyowontour-tour-event-tab-data'

describe('register schedule route place noise', () => {
  it('blocks hotel-grade suffix — keeps POI name for routeText/keywords', () => {
    expect(extractRegisterScheduleRoutePlaceLabel('메테오라 등 4성호텔')).toBe('메테오라')
    expect(stripRegisterScheduleRouteSegmentLodgingSuffix('메테오라 등 4성호텔')).toBe('메테오라')
    expect(sanitizeRegisterScheduleRouteText('메테오라 등 4성호텔')).toBe('메테오라')
  })

  it('blocks domestic hub segments — overseas routeText is tourism chain only', () => {
    expect(isRegisterScheduleDomesticHubRouteSegment('인천')).toBe(true)
    expect(isRegisterScheduleDomesticHubRouteSegment('Incheon')).toBe(true)
    expect(isRegisterScheduleRoutePlaceNoise('인천')).toBe(false)
    expect(sanitizeRegisterScheduleRouteText('인천 - 청도 - 잔교 - 인천')).toBe('청도 - 잔교')
    expect(sanitizeRegisterScheduleRouteText('인천 - 돗토리 - 미즈키시게루 로드')).toBe(
      '돗토리 - 미즈키시게루 로드',
    )
  })

  it('blocks airport·province·optional-tour segments', () => {
    expect(isRegisterScheduleRoutePlaceNoise('청도국제공항')).toBe(true)
    expect(isRegisterScheduleRoutePlaceNoise('산동성')).toBe(true)
    expect(isRegisterScheduleRoutePlaceNoise('전신마사지 (60분)')).toBe(true)
    expect(
      sanitizeRegisterScheduleRouteText('청도 - 산동성 - 청도국제공항 - 5·4광장 - 전신마사지 (60분)'),
    ).toBe('청도 - 5·4광장')
  })

  it('blocks airline carrier segments — not tourism landmarks', () => {
    expect(isRegisterScheduleRoutePlaceNoise('에어프레미아 항공')).toBe(true)
    expect(isRegisterScheduleRoutePlaceNoise('에어프리미아')).toBe(true)
    expect(isRegisterScheduleRoutePlaceNoise('Air Premia')).toBe(true)
    expect(sanitizeRegisterScheduleRouteText('에어프레미아 항공 - 에어프리미아')).toBeNull()
  })

  it('airline-only departure day — empty imageKeyword', () => {
    const out = applyRegisterScheduleImageKeywordsBySupplier(
      [{ day: 1, routeText: '에어프레미아 항공 - 에어프리미아', imageKeyword: '', imageKeyword2: null }],
      { supplierKey: 'hanatour', productDestination: '미국', productTitle: '미동부' },
    )
    expect(String(out[0]?.imageKeyword ?? '').trim()).toBe('')
    expect(sanitizeRegisterScheduleRouteText(out[0]?.routeText ?? '')).toBeNull()
  })

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
    expect(chain).toBe('돗토리 - 미즈키시게루 로드')
    expect(chain).not.toMatch(/입국|관련\s*안내|한국-일본\s*여행/)
  })

  it('kyowontour tab rows skip admin guidance in routeText', () => {
    const rows: KyowontourScheduleRowParsed[] = [
      { step: 1, type: '이동', nameKo: '인천국제공항 출발', tmContent: '' },
      { step: 2, type: '이동', nameKo: '돗토리', tmContent: '' },
      { step: 3, type: '관광', nameKo: '한국-일본 여행 입국시 관련 안내', tmContent: '' },
      { step: 4, type: '관광', nameKo: '미즈키시게루 로드', tmContent: '' },
    ]
    expect(buildKyowontourScheduleRouteTextFromTabRows(rows)).toBe('돗토리 - 미즈키시게루 로드')
  })

  it('extractRegisterScheduleRoutePlaceLabel — 포르투갈 마케팅 카드명', () => {
    expect(extractRegisterScheduleRoutePlaceLabel('땅이 끝나고 바다가 시작되는 곳, 까보다로까')).toBe('까보다로까')
    expect(extractRegisterScheduleRoutePlaceLabel('유럽인들이 살고싶어 하는 최고의 포르투갈 휴양지, 카스카이스')).toBe(
      '카스카이스',
    )
    expect(extractRegisterScheduleRoutePlaceLabel('작은 동화속 마을 신트라 관광')).toBe('신트라')
    expect(extractRegisterScheduleRoutePlaceLabel('lisbon-7681991')).toBe('lisbon')
    expect(extractRegisterScheduleRoutePlaceLabel('포르투 이미지')).toBeNull()
  })

  it('sanitizeRegisterScheduleRouteText strips admin guidance from existing routeText', () => {
    expect(
      sanitizeRegisterScheduleRouteText(
        '인천 - 돗토리 - 한국-일본 여행 입국시 관련 안내 - 미즈키시게루 로드',
      ),
    ).toBe('돗토리 - 미즈키시게루 로드')
  })

  it('sanitizeRegisterScheduleRouteText preserves comma inside route segment (대,소석림)', () => {
    expect(sanitizeRegisterScheduleRouteText('여강고성 - 대,소석림')).toBe('여강고성 - 대,소석림')
    expect(joinLottetourScheduleRouteText(['여강고성', '대,소석림'])).toBe('여강고성 - 대,소석림')
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
