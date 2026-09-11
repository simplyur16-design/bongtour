/**
 * REGRESSION-FREEZE[register-pre-photo-poi-ko-own-route-gap]: KO route → EN keyword own-route — manifest
 */
import { describe, expect, it } from 'vitest'
import { mapKoreanPoiSegment } from '@/lib/pexels-keyword'
import { registerScheduleKeywordMatchesOwnDayRoute } from '@/lib/register-pre-photo-verify'
import { collectRouteTextOrderedLandmarkKeywords } from '@/lib/register-schedule-route-text-image-keyword-ssot'

describe('register-pre-photo-poi-ko-own-route-gap', () => {
  it('maps Okinawa / Guizhou route KO segments to EN landmarks', () => {
    expect(mapKoreanPoiSegment('차탄 아메리칸 빌리지')).toMatch(/American Village/i)
    expect(mapKoreanPoiSegment('나하 국제거리')).toMatch(/Kokusai Street/i)
    expect(mapKoreanPoiSegment('황과수 폭포')).toMatch(/Huangguoshu/i)
    expect(mapKoreanPoiSegment('라평 유채꽃')).toMatch(/Luoping/i)
    expect(mapKoreanPoiSegment('용궁')).toMatch(/Longgong/i)
    expect(mapKoreanPoiSegment('마령하 대협곡')).toMatch(/Malinghe/i)
    expect(mapKoreanPoiSegment('청암고진')).toMatch(/Qingyan/i)
  })

  it('own-route verify accepts EN keywords derived from those KO routes', () => {
    const okinawaDay3 =
      '레아레아 셔틀 정류장 - 차탄 아메리칸 빌리지 - 코우리대교 - 돈키호테 국제거리점'
    const kw = collectRouteTextOrderedLandmarkKeywords(okinawaDay3)[0]
    expect(kw).toBeTruthy()
    expect(registerScheduleKeywordMatchesOwnDayRoute(okinawaDay3, kw)).toBe(true)

    const guizhouDay2 = '황과수 폭포 - 두파당 폭포 - 안순 시내 식당'
    const gKw = collectRouteTextOrderedLandmarkKeywords(guizhouDay2)[0]
    expect(gKw).toMatch(/Huangguoshu/i)
    expect(registerScheduleKeywordMatchesOwnDayRoute(guizhouDay2, gKw)).toBe(true)
  })
})
