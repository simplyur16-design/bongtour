/**
 * REGRESSION-FREEZE[register-pre-photo-pkg-middle-kw-fill]: 자유휴양≠Cairo dest — manifest
 */
import { describe, expect, it } from 'vitest'
import { applyRegisterScheduleImageKeywordsBySupplier } from '@/lib/register-schedule-image-keywords-apply'
import { healRegisterPrePhotoSchedule } from '@/lib/register-pre-photo-self-heal'
import { softDupForeignVisitCityForMiddleRoute } from '@/lib/register-schedule-trip-image-keyword-dedupe'
import { sanitizeRegisterScheduleRouteText } from '@/lib/register-schedule-route-place-noise'
import { prepareRegisterScheduleRowsForImageKeywordApply } from '@/lib/register-schedule-route-text-backfill'
import { mapKoreanPoiSegment } from '@/lib/pexels-keyword'
import { isBrokenRegisterLandmarkKeyword } from '@/lib/register-pre-photo-guards'
import { isBareCityOrCountryKeyword } from '@/lib/pexels-place-name-keyword'

describe('register-pre-photo-pkg-middle-kw-fill — Egypt free leisure', () => {
  it('softDup keeps Hurghada on leisure title even when place-noise filters segs', () => {
    expect(softDupForeignVisitCityForMiddleRoute('후르가다 홍해 리조트 자유 휴양')).toBe('Hurghada')
    expect(sanitizeRegisterScheduleRouteText('후르가다 홍해 리조트 자유 휴양')).toMatch(/후르가다/)
  })

  it('Swiss lake cities softDup + Jungfrau hotel-hybrid title keeps tourism route', () => {
    expect(softDupForeignVisitCityForMiddleRoute('인터라켄 이동 ( ) - 융프라우 등정')).toBe('Interlaken')
    expect(softDupForeignVisitCityForMiddleRoute('아스코나 이동 - 루가노 이동 - 호수마을 루가노 시내')).toMatch(
      /Ascona|Lugano/,
    )
    const prep = prepareRegisterScheduleRowsForImageKeywordApply([
      { day: 1, title: '로마', routeText: '로마' },
      {
        day: 4,
        title: '알프스의 영봉 융프라우 등정 및 인터라켄 숙박',
        routeText: '인터라켄 이동 ( ) - 융프라우 등정',
      },
      { day: 9, title: '귀국', routeText: '인천' },
    ])
    expect(prep.find((r) => r.day === 4)?.routeText).toMatch(/융프라우|인터라켄/)
    expect(prep.find((r) => r.day === 4)?.routeText).not.toMatch(/숙박/)
  })

  it('apply+heal: free leisure day stays Hurghada, not dest Cairo', () => {
    const rows = [
      { day: 1, title: '인천 - 카이로', routeText: '인천 - 카이', description: '이동' },
      {
        day: 2,
        title: '카이로 시내',
        routeText: '카이 - 그랜드 이집션 뮤지엄',
        description: '박물관',
      },
      {
        day: 3,
        title: '룩소르 - 후르가다',
        routeText: '룩소르 - 후르가다',
        description: '이동',
      },
      {
        day: 4,
        title: '후르가다 홍해 리조트 자유 휴양',
        routeText: '후르가다 홍해 리조트 자유 휴양',
        description: '자유',
      },
      { day: 5, title: '카이로 귀국', routeText: '후르가다 - 카이', description: '귀국' },
    ]
    const allocated = applyRegisterScheduleImageKeywordsBySupplier(rows, {
      supplierKey: 'hanatour',
      productDestination: '이집트',
      productTitle: '이집트 나일크루즈 후르가다',
      travelScope: 'package',
    })
    const day4Alloc = allocated.find((r) => r.day === 4)
    expect(String(day4Alloc?.routeText ?? '')).toMatch(/후르가다/)
    expect(String(day4Alloc?.routeText ?? '')).not.toMatch(/^Cairo$/i)

    const healed = healRegisterPrePhotoSchedule(allocated, {
      supplierKey: 'hanatour',
      productDestination: '이집트',
      productTitle: '이집트 나일크루즈 후르가다',
      lane: 'package',
    })
    const day4 = healed.rows.find((r) => r.day === 4)
    expect(String(day4?.routeText ?? '')).toMatch(/후르가다/)
    expect(String(day4?.imageKeyword ?? '')).toMatch(/Hurghada/i)
    expect(String(day4?.imageKeyword ?? '')).not.toMatch(/^Cairo$/i)
  })

  it('Lugano POI is not broken 2-word country label; bare cities recognized', () => {
    const poi = mapKoreanPoiSegment('루가노')
    expect(poi).toBeTruthy()
    expect(isBrokenRegisterLandmarkKeyword(poi)).toBe(false)
    expect(isBareCityOrCountryKeyword('Lugano')).toBe(true)
    expect(isBareCityOrCountryKeyword('Interlaken')).toBe(true)
  })

  it('Singapore hub soft-dup + Las Vegas Strip + Henan/Yogya POI fill gaps', () => {
    expect(softDupForeignVisitCityForMiddleRoute('싱가포르')).toBe('Singapore')
    expect(isBrokenRegisterLandmarkKeyword('Las Vegas Strip')).toBe(false)
    expect(mapKoreanPoiSegment('용문석굴')).toMatch(/Longmen/i)
    expect(mapKoreanPoiSegment('보로부두르 사원')).toMatch(/Borobudur/i)
    expect(mapKoreanPoiSegment('핸더슨 웨이브 브릿지')).toMatch(/Henderson/i)
    expect(mapKoreanPoiSegment('중정기념당')).toMatch(/Chiang Kai-shek|Memorial/i)
    expect(isBareCityOrCountryKeyword('Yogyakarta')).toBe(true)
  })

  it('residual14: Greece/Nepal/Iceland/Brunei POI + soft cities', () => {
    expect(mapKoreanPoiSegment('미케네 유적지')).toMatch(/Mycenae/i)
    expect(mapKoreanPoiSegment('요쿨살롱')).toMatch(/Jokulsarlon/i)
    expect(mapKoreanPoiSegment('보우다나트')).toMatch(/Boudhanath/i)
    expect(mapKoreanPoiSegment('스리미낙시 사원')).toMatch(/Meenakshi/i)
    expect(mapKoreanPoiSegment('이스타나 누룰이만')).toMatch(/Nurul Iman|Istana|palace/i)
    expect(isBrokenRegisterLandmarkKeyword(mapKoreanPoiSegment('이스타나 누룰이만'))).toBe(false)
    expect(mapKoreanPoiSegment('토레스 델 파이네 국립공원')).toMatch(/Torres del Paine/i)
    expect(softDupForeignVisitCityForMiddleRoute('포카라 - 나가르코트')).toMatch(/Pokhara|Nagarkot/)
    expect(softDupForeignVisitCityForMiddleRoute('산토리니 - 아부다비')).toBe('Santorini')
    expect(softDupForeignVisitCityForMiddleRoute('엘 깔라파테')).toBe('Calafate')
    expect(isBareCityOrCountryKeyword('Pokhara')).toBe(true)
  })
})
