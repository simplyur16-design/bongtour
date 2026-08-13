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
  routeContextualDisneyEnglish,
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
    // REGRESSION-FREEZE[pexels-hk-hollywood-road-not-la]: 헐리우드로드 = 홍콩 ≠ LA — manifest
    expect(firstMatchingScheduleSpotEn('헐리우드로드')).toBe('Hollywood Road Hong Kong')
    expect(firstMatchingScheduleSpotEn('할리우드 로드')).toBe('Hollywood Road Hong Kong')
    expect(mapKoreanPoiSegment('헐리우드로드')).toBe('Hollywood Road Hong Kong')
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

  // REGRESSION-FREEZE[schedule-poi-regex-ssot]: 도게츠교≠Doge's Palace — manifest
  it('maps Togetsukyo Arashiyama — not Doge Palace Venice', () => {
    expect(firstMatchingScheduleSpotEn('도게츠교')).toMatch(/Togetsu|Arashiyama/i)
    expect(firstMatchingScheduleSpotEn('도게츠교')).not.toMatch(/Doge/i)
    expect(firstMatchingScheduleSpotEn('아라시야마 - 도게츠교 - 치쿠린')).toMatch(/Arashiyama|Togetsu/i)
    expect(firstMatchingScheduleSpotEn('아라시야마 - 도게츠교 - 치쿠린')).not.toMatch(/Doge/i)
  })

  // REGRESSION-FREEZE[schedule-poi-regex-ssot]: 이집트 스핑크스 ≠ Jungfraujoch — manifest
  it('maps Egypt Giza Sphinx — not Jungfraujoch Swiss Alps', () => {
    expect(firstMatchingScheduleSpotEn('기자의 피라미드와 스핑크스')).toMatch(/Great Sphinx|Giza/i)
    expect(firstMatchingScheduleSpotEn('기자의 피라미드와 스핑크스')).not.toMatch(/Jungfrau/i)
    expect(firstMatchingScheduleSpotEn('카이로 - 스핑크스 - 피라미드')).toMatch(/Great Sphinx|Giza/i)
    expect(firstMatchingScheduleSpotEn('카이로 - 스핑크스 - 피라미드')).not.toMatch(/Jungfrau/i)
    expect(firstMatchingScheduleSpotEn('융프라우요흐 스핑크스 전망대')).toMatch(/Jungfraujoch|Sphinx Observatory/i)
    expect(firstMatchingScheduleSpotEn('Sphinx Observatory')).toMatch(/Jungfraujoch/i)
  })

  // REGRESSION-FREEZE[schedule-poi-regex-ssot]: Iberia·남프랑스 ESP104 day-owned POI — manifest
  it('maps Iberia and South France day POIs — Guam 스페인광장 stays Guam', () => {
    expect(firstMatchingScheduleSpotEn('마세나 광장')).toMatch(/Massena|Nice/i)
    expect(firstMatchingScheduleSpotEn('아를 구시가지')).toMatch(/Arles/i)
    expect(firstMatchingScheduleSpotEn('알함브라궁전')).toMatch(/Alhambra/i)
    expect(firstMatchingScheduleSpotEn('프라도미술관')).toMatch(/Prado/i)
    expect(firstMatchingScheduleSpotEn('마드리드왕궁')).toMatch(/Royal Palace Madrid/i)
    expect(firstMatchingScheduleSpotEn('히랄다탑')).toMatch(/Giralda/i)
    expect(firstMatchingScheduleSpotEn('세비야 - 스페인광장 - 히랄다탑')).toMatch(/Plaza de Espana Seville|Giralda|Seville Cathedral/i)
    expect(firstMatchingScheduleSpotEn('세비야 - 스페인광장')).not.toMatch(/Guam/i)
    expect(firstMatchingScheduleSpotEn('괌 스페인광장')).toMatch(/Guam/i)
    expect(firstMatchingScheduleSpotEn('구엘공원')).toMatch(/Park Guell|G[uü]ell/i)
    expect(firstMatchingScheduleSpotEn('까보다로카')).toMatch(/Cabo da Roca/i)
    expect(firstMatchingScheduleSpotEn('까보다로까')).toMatch(/Cabo da Roca/i)
    expect(firstMatchingScheduleSpotEn('베나길 해변')).toMatch(/Benagil/i)
    expect(firstMatchingScheduleSpotEn('사그레스 - 상비센테 곶')).toMatch(/Sagres|Vincent/i)
    expect(firstMatchingScheduleSpotEn('이스탄불 - 인천')).not.toMatch(/Arles/i)
    expect(mapKoreanPoiSegment('스페인광장')).toMatch(/Seville/i)
    expect(mapKoreanPoiSegment('괌 스페인광장')).toMatch(/Guam/i)
  })

  // REGRESSION-FREEZE[schedule-poi-regex-ssot]: 홍콩 디즈니랜드 ≠ Tokyo/Shanghai — manifest
  it('maps Hong Kong Disneyland — not Tokyo or Shanghai', () => {
    expect(firstMatchingScheduleSpotEn('홍콩 디즈니랜드')).toMatch(/Hong Kong Disneyland/i)
    expect(firstMatchingScheduleSpotEn('홍콩 디즈니랜드')).not.toMatch(/Tokyo|Shanghai/i)
    expect(firstMatchingScheduleSpotEn('도쿄 디즈니랜드')).toMatch(/Tokyo Disneyland/i)
    expect(firstMatchingScheduleSpotEn('상하이 디즈니')).toMatch(/Shanghai Disneyland/i)
    expect(firstMatchingScheduleSpotEn('빅토리아 산정')).toMatch(/Victoria Peak/i)
    expect(routeContextualDisneyEnglish('디즈니랜드', '홍콩 - 디즈니랜드', '홍콩')).toMatch(
      /Hong Kong Disneyland/i,
    )
    expect(routeContextualDisneyEnglish('디즈니랜드', '디즈니랜드', '홍콩')).toMatch(/Hong Kong Disneyland/i)
    expect(mapKoreanPoiSegment('홍콩 디즈니랜드')).toMatch(/Hong Kong Disneyland/i)
    expect(mapKoreanPoiSegment('디즈니랜드')).not.toMatch(/Tokyo|Shanghai|Hong Kong/i)
  })

  // REGRESSION-FREEZE[schedule-poi-regex-ssot]: 리기≠승리기념탑 — Baltic Victory Monument bleed 금지 — manifest
  it('does not map Baltic Victory Monument 승리기념탑 to Mount Rigi', () => {
    expect(firstMatchingScheduleSpotEn('체시스 - 승리기념탑 - 시굴다 - 투라이다 성')).not.toMatch(/Rigi|Jungfrau|Swiss/i)
    expect(firstMatchingScheduleSpotEn('체시스 - 승리기념탑 - 시굴다 - 투라이다 성')).toMatch(
      /Cesis|Sigulda|Turaida/i,
    )
    expect(firstMatchingScheduleSpotEn('리기산 전망')).toMatch(/Rigi/i)
    expect(firstMatchingScheduleSpotEn('주노 - 껌벽 등')).toMatch(/Juneau/i)
    expect(firstMatchingScheduleSpotEn('주노 - 껌벽 등')).not.toMatch(/Glacier Bay/i)
    expect(firstMatchingScheduleSpotEn('케치칸')).toMatch(/Ketchikan/i)
    expect(firstMatchingScheduleSpotEn('빌라누프 궁전')).toMatch(/Wilanow/i)
  })
})
