/**
 * REGRESSION-FREEZE[schedule-segment-poi-oceania-japan-europe]
 */
import { describe, expect, it } from 'vitest'
import { mapKoreanPoiSegment } from '@/lib/pexels-keyword'
import { firstMatchingScheduleCityEn, firstMatchingScheduleSpotEn } from '@/lib/schedule-poi-regex-ssot'

describe('schedule-segment-poi-oceania-japan-europe', () => {
  const nzAuSegments = [
    ['로토루아 호수', /Lake Rotorua/i],
    ['아그로돔', /Agrodome/i],
    ['스카이라인 곤돌라', /Skyline Rotorua/i],
    ['와카레와레와 마오리민속마을', /Whakarewarewa/i],
    ['미션베이', /Mission Bay/i],
    ['에덴동산', /Auckland Domain/i],
    ['울루루', /Uluru/i],
    ['그레이트 배리어 리프', /Great Barrier Reef/i],
    ['밀포드 사운드', /Milford Sound/i],
  ] as const

  it.each(nzAuSegments)('NZ/AU POI dict — %s', (seg, re) => {
    const fromDict = mapKoreanPoiSegment(seg)
    const fromSpot = firstMatchingScheduleSpotEn(seg)
    expect(fromDict || fromSpot).toMatch(re)
  })

  const priority2Segments = [
    ['후지산', /Mount Fuji/i],
    ['콜로세움', /Colosseum/i],
    ['사그라다 파밀리아', /Sagrada Familia/i],
    ['스위스 알프스', /Swiss Alps/i],
    ['페트라', /Petra/i],
    ['마라케시', /Marrakech/i],
    ['리우데자네이로', /Rio de Janeiro/i],
  ] as const

  it.each(priority2Segments)('2순위 POI dict/regex — %s', (seg, re) => {
    const fromDict = mapKoreanPoiSegment(seg)
    const fromSpot = firstMatchingScheduleSpotEn(seg)
    const fromCity = firstMatchingScheduleCityEn(seg)
    expect(fromDict || fromSpot || fromCity).toMatch(re)
  })

  it('NZ/AU city regex — 오클랜드·퀸즈타운', () => {
    expect(firstMatchingScheduleCityEn('오클랜드')).toMatch(/Auckland/i)
    expect(firstMatchingScheduleCityEn('퀸즈타운')).toMatch(/Queenstown/i)
    expect(firstMatchingScheduleCityEn('골드코스트')).toMatch(/Gold Coast|Surfers Paradise/i)
  })
})
