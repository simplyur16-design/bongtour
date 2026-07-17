/**
 * REGRESSION-FREEZE[schedule-poi-regex-ssot]: 전 공급사 POI regex SSOT — manifest
 */
import { describe, expect, it } from 'vitest'
import { mapDestination, mapKoreanPoiSegment } from '@/lib/pexels-keyword'
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
    expect(firstMatchingScheduleCityEn('빌니우스')).toMatch(/Vilnius/i)
    expect(firstMatchingScheduleCityEn('리가')).toMatch(/Riga/i)
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

  it('does not map 나라 inside 나라의 possessive to Nara', () => {
    expect(mapKoreanPoiSegment('리투아니아의 수도당')).toBe('')
    expect(mapDestination('나라 시내')).toMatch(/Nara/i)
  })

  it('does not map ancient Rome phrase to Rome city when Ephesus present', () => {
    expect(firstMatchingScheduleCityEn('고대 로마를 만나다')).toBeNull()
    expect(firstMatchingScheduleSpotEn('에페소')).toMatch(/Ephesus/i)
  })

  it('maps Oslo fjord cruise companion landmark and departure-city flight routes', () => {
    expect(
      firstMatchingScheduleSpotEn('오슬로 - 도착지 - 유람선 GO NORDIC CRUISELINE'),
    ).toMatch(/Akershus/i)
    expect(firstMatchingScheduleSpotEn('코펜하겐 출발 (LO464)')).toMatch(/Amalienborg/i)
    expect(firstMatchingScheduleSpotEn('바르샤바 출발 (LO099)')).toMatch(/Royal Castle/i)
  })

  it('maps Italy Assisi Vatican and bare Pisa route segments', () => {
    expect(firstMatchingScheduleSpotEn('아시시')).toMatch(/Assisi/i)
    expect(firstMatchingScheduleSpotEn('성 베드로 성당')).toMatch(/St Peter/i)
    expect(firstMatchingScheduleSpotEn('피사')).toMatch(/Leaning Tower/i)
  })

  it('maps Zhangjiajie sub-landmarks before generic forest park', () => {
    expect(firstMatchingScheduleSpotEn('천자산')).toMatch(/Tianzi Mountain/i)
    expect(firstMatchingScheduleSpotEn('천문산')).toMatch(/Tianmen Mountain/i)
    expect(firstMatchingScheduleSpotEn('보봉탑')).toMatch(/Avatar Hallelujah/i)
    expect(firstMatchingScheduleSpotEn('금편계곡')).toMatch(/Golden Whip/i)
  })

  it('maps Normandy and South America tour landmarks', () => {
    expect(firstMatchingScheduleSpotEn('루앙')).toMatch(/Rouen/i)
    expect(firstMatchingScheduleSpotEn('드오빌')).toMatch(/Deauville/i)
    expect(firstMatchingScheduleSpotEn('세계 3대 폭포 이과수 폭포')).toMatch(/Iguazu/i)
    expect(firstMatchingScheduleSpotEn('부에노스아이레스')).toMatch(/Buenos Aires/i)
    expect(firstMatchingScheduleSpotEn('웨스트민스터 사원')).toMatch(/Westminster/i)
  })

  it('maps US West Palace and Saipan Bird Island as SPOT; Ipan does not match Saipan', () => {
    expect(firstMatchingScheduleSpotEn('로스앤젤레스 - 팔레스 오브 파인 아트')).toMatch(/Palace of Fine Arts/i)
    expect(firstMatchingScheduleSpotEn('천혜의 자연 새섬 - PACIFIC ISLANDS CLUB SAIPAN')).toMatch(
      /Saipan Bird Island/i,
    )
    expect(firstMatchingScheduleCityEn('사이판 PIC')).toMatch(/Saipan/i)
    expect(firstMatchingScheduleCityEn('사이판')).not.toMatch(/Tumon|Guam/i)
    expect(mapKoreanPoiSegment('천혜의 자연 새섬')).toMatch(/Saipan Bird Island/i)
    expect(firstMatchingScheduleSpotEn('라플린')).toMatch(/Laughlin/i)
    expect(firstMatchingScheduleSpotEn('코닥극장')).toMatch(/Chinese Theatre|Hollywood/i)
    expect(firstMatchingScheduleSpotEn('니지노마츠바라')).toMatch(/Nijinomatsubara/i)
    expect(firstMatchingScheduleSpotEn('비엔티엔')).toMatch(/Vientiane|That Luang/i)
  })

  // REGRESSION-FREEZE[schedule-poi-regex-ssot]: 치토세 공항·후라노 라벤더 — Provence 환각 금지 — manifest
  it('maps Hokkaido Farm Tomita lavender and Chitose airport — not Provence', () => {
    expect(firstMatchingScheduleSpotEn('팜 토미타 - 라벤더 소프트 아이스크림 증정')).toMatch(
      /Farm Tomita|Furano/i,
    )
    expect(firstMatchingScheduleSpotEn('팜 토미타 - 라벤더 소프트 아이스크림 증정')).not.toMatch(
      /Provence|Valensole/i,
    )
    expect(firstMatchingScheduleSpotEn('치토세 국제공항 이동')).toMatch(/Chitose/i)
    expect(firstMatchingScheduleSpotEn('프로방스 라벤더 밭')).toMatch(/Provence|Valensole/i)
  })
})
