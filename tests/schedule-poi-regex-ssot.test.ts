/**
 * REGRESSION-FREEZE[schedule-poi-regex-ssot]: 전 공급사 POI regex SSOT — manifest
 */
import { describe, expect, it } from 'vitest'
import { mapKoreanPoiSegment } from '@/lib/pexels-keyword'
import {
  firstMatchingScheduleCityEn,
  firstMatchingScheduleSpotEn,
  getSchedulePoiRegexEnglishKeys,
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
  })
})
