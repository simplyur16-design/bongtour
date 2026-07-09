/**
 * REGRESSION-FREEZE[schedule-poi-regex-ssot]: 전 공급사 POI regex SSOT — manifest
 */
import { describe, expect, it } from 'vitest'
import { mapKoreanPoiSegment } from '@/lib/pexels-keyword'
import {
  firstMatchingScheduleCityEn,
  firstMatchingScheduleSpotEn,
  getSchedulePoiRegexEnglishKeys,
  routeContextualNationalAssemblyEnglish,
} from '@/lib/schedule-poi-regex-ssot'

describe('schedule-poi-regex-ssot', () => {
  it('exposes shared regex English keys', () => {
    expect(getSchedulePoiRegexEnglishKeys().size).toBeGreaterThan(100)
  })

  it('maps Taiwan landmarks from POI_KO_TO_EN', () => {
    expect(mapKoreanPoiSegment('지우펀')).toMatch(/Jiufen/i)
    expect(mapKoreanPoiSegment('예류')).toMatch(/Yehliu/i)
  })

  it('maps Vietnam route guards before generic city fallback', () => {
    expect(firstMatchingScheduleSpotEn('호이안 고대 도시')).toMatch(/Hoi An/i)
    expect(firstMatchingScheduleSpotEn('내원교')).toMatch(/Japanese Covered Bridge/i)
    expect(firstMatchingScheduleSpotEn('미케 비치')).toMatch(/My Khe/i)
  })

  it('maps shared city regex for route segments', () => {
    expect(firstMatchingScheduleCityEn('다낭')).toMatch(/Da Nang/i)
    expect(firstMatchingScheduleCityEn('이스탄불')).toMatch(/Istanbul/i)
    expect(firstMatchingScheduleCityEn('리마')).toMatch(/Lima/i)
    expect(firstMatchingScheduleSpotEn('링컨 기념관')).toMatch(/Lincoln Memorial/i)
    expect(firstMatchingScheduleSpotEn('부다페스트 국회의사당')).toMatch(/Hungarian Parliament/i)
    expect(firstMatchingScheduleSpotEn('시청사와 국회의사당')).toMatch(/Vienna Rathaus/i)
    expect(firstMatchingScheduleSpotEn('워싱턴 국회의사당')).toMatch(/United States Capitol/i)
    expect(
      routeContextualNationalAssemblyEnglish('국회의사당', '부다페스트 - 국회의사당 - 부다왕궁'),
    ).toMatch(/Hungarian Parliament/i)
    expect(firstMatchingScheduleSpotEn('할슈타트')).toMatch(/Hallstatt/i)
    expect(firstMatchingScheduleSpotEn('마추픽chu')).toMatch(/Machu Picchu/i)
    expect(firstMatchingScheduleSpotEn('나이아가라 폭포')).toMatch(/Niagara/i)
  })

  it('does not map ancient Rome phrase to Rome city when Ephesus present', () => {
    expect(firstMatchingScheduleCityEn('고대 로마를 만나다')).toBeNull()
    expect(firstMatchingScheduleSpotEn('에페소')).toMatch(/Ephesus/i)
  })
})
