/**
 * REGRESSION-FREEZE[schedule-poi-regex-ssot]: 전 공급사 POI regex SSOT — manifest
 * REGRESSION-FREEZE[schedule-poi-regex-ssot-node-test]: tests/ 는 node:test — vitest require 금지 — manifest
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
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
    assert.ok(getSchedulePoiRegexEnglishKeys().size > 100)
  })

  it('maps Taiwan landmarks from POI_KO_TO_EN', () => {
    assert.match(String(mapKoreanPoiSegment('지우펀') ?? ''), /Jiufen/i)
    assert.match(String(mapKoreanPoiSegment('예류') ?? ''), /Yehliu/i)
  })

  it('maps Vietnam route guards before generic city fallback', () => {
    assert.match(String(firstMatchingScheduleSpotEn('호이안 고대 도시') ?? ''), /Hoi An/i)
    assert.match(String(firstMatchingScheduleSpotEn('내원교') ?? ''), /Japanese Covered Bridge/i)
    assert.match(String(firstMatchingScheduleSpotEn('미케 비치') ?? ''), /My Khe/i)
  })

  it('maps shared city regex for route segments', () => {
    assert.match(String(firstMatchingScheduleCityEn('다낭') ?? ''), /Da Nang/i)
    assert.match(String(firstMatchingScheduleCityEn('빌니우스') ?? ''), /Vilnius/i)
    assert.match(String(firstMatchingScheduleCityEn('리가') ?? ''), /Riga/i)
    assert.match(String(firstMatchingScheduleCityEn('이스탄불') ?? ''), /Istanbul/i)
    assert.match(String(firstMatchingScheduleCityEn('리마') ?? ''), /Lima/i)
    assert.match(String(firstMatchingScheduleSpotEn('링컨 기념관') ?? ''), /Lincoln Memorial/i)
    assert.match(String(firstMatchingScheduleSpotEn('부다페스트 국회의사당') ?? ''), /Hungarian Parliament/i)
    assert.match(String(firstMatchingScheduleSpotEn('마추픽추') ?? ''), /Machu Picchu/i)
    assert.match(String(firstMatchingScheduleSpotEn('치첸이사') ?? ''), /Chichen Itza/i)
    assert.match(String(firstMatchingScheduleSpotEn('타오르미나') ?? ''), /Taormina/i)
    assert.match(String(firstMatchingScheduleSpotEn('라스페치아') ?? ''), /Cinque Terre/i)
    assert.match(String(firstMatchingScheduleSpotEn('고조') ?? ''), /Gozo/i)
    assert.match(String(firstMatchingScheduleSpotEn('카타니아') ?? ''), /Catania|Etna/i)
    assert.match(String(firstMatchingScheduleSpotEn('72번 국도') ?? ''), /Kahuku|Hawaii/i)
    assert.match(String(firstMatchingScheduleSpotEn('GOLDEN CIRCLE') ?? ''), /Golden Circle/i)
    assert.match(String(firstMatchingScheduleSpotEn('와디럼') ?? ''), /Wadi Rum/i)
    assert.match(String(firstMatchingScheduleSpotEn('시청사와 국회의사당') ?? ''), /Vienna Rathaus/i)
    assert.match(String(firstMatchingScheduleSpotEn('워싱턴 국회의사당') ?? ''), /United States Capitol/i)
    assert.match(
      String(
        routeContextualNationalAssemblyEnglish('국회의사당', '부다페스트 - 국회의사당 - 부다왕궁') ?? '',
      ),
      /Hungarian Parliament/i,
    )
    assert.match(String(firstMatchingScheduleSpotEn('할슈타트') ?? ''), /Hallstatt/i)
    assert.match(String(firstMatchingScheduleSpotEn('마추픽chu') ?? ''), /Machu Picchu/i)
    assert.match(String(firstMatchingScheduleSpotEn('나이아가라 폭포') ?? ''), /Niagara/i)
  })

  it('does not map 나라 inside 나라의 possessive to Nara', () => {
    assert.equal(mapKoreanPoiSegment('리투아니아의 수도당'), '')
    assert.match(String(mapDestination('나라 시내') ?? ''), /Nara/i)
  })

  it('does not map ancient Rome phrase to Rome city when Ephesus present', () => {
    assert.equal(firstMatchingScheduleCityEn('고대 로마를 만나다'), null)
    assert.match(String(firstMatchingScheduleSpotEn('에페소') ?? ''), /Ephesus/i)
  })

  it('maps Oslo fjord cruise companion landmark and departure-city flight routes', () => {
    assert.match(
      String(firstMatchingScheduleSpotEn('오슬로 - 도착지 - 유람선 GO NORDIC CRUISELINE') ?? ''),
      /Akershus/i,
    )
    assert.match(String(firstMatchingScheduleSpotEn('코펜하겐 출발 (LO464)') ?? ''), /Amalienborg/i)
    assert.match(String(firstMatchingScheduleSpotEn('바르샤바 출발 (LO099)') ?? ''), /Royal Castle/i)
  })

  it('maps Italy Assisi Vatican and bare Pisa route segments', () => {
    assert.match(String(firstMatchingScheduleSpotEn('아시시') ?? ''), /Assisi/i)
    assert.match(String(firstMatchingScheduleSpotEn('성 베드로 성당') ?? ''), /St Peter/i)
    assert.match(String(firstMatchingScheduleSpotEn('피사') ?? ''), /Leaning Tower/i)
  })

  it('maps Zhangjiajie sub-landmarks before generic forest park', () => {
    assert.match(String(firstMatchingScheduleSpotEn('천자산') ?? ''), /Tianzi Mountain/i)
    assert.match(String(firstMatchingScheduleSpotEn('천문산') ?? ''), /Tianmen Mountain/i)
    assert.match(String(firstMatchingScheduleSpotEn('보봉탑') ?? ''), /Avatar Hallelujah/i)
    assert.match(String(firstMatchingScheduleSpotEn('금편계곡') ?? ''), /Golden Whip/i)
  })

  it('maps Normandy and South America tour landmarks', () => {
    assert.match(String(firstMatchingScheduleSpotEn('루앙') ?? ''), /Rouen/i)
    assert.match(String(firstMatchingScheduleSpotEn('드오빌') ?? ''), /Deauville/i)
    assert.match(String(firstMatchingScheduleSpotEn('세계 3대 폭포 이과수 폭포') ?? ''), /Iguazu/i)
    assert.match(String(firstMatchingScheduleSpotEn('부에노스아이레스') ?? ''), /Buenos Aires/i)
    assert.match(String(firstMatchingScheduleSpotEn('웨스트민스터 사원') ?? ''), /Westminster/i)
  })

  it('maps US West Palace and Saipan Bird Island as SPOT; Ipan does not match Saipan', () => {
    assert.match(
      String(firstMatchingScheduleSpotEn('로스앤젤레스 - 팔레스 오브 파인 아트') ?? ''),
      /Palace of Fine Arts/i,
    )
    assert.match(
      String(firstMatchingScheduleSpotEn('천혜의 자연 새섬 - PACIFIC ISLANDS CLUB SAIPAN') ?? ''),
      /Saipan Bird Island/i,
    )
    assert.match(String(firstMatchingScheduleCityEn('사이판 PIC') ?? ''), /Saipan/i)
    assert.doesNotMatch(String(firstMatchingScheduleCityEn('사이판') ?? ''), /Tumon|Guam/i)
    assert.match(String(mapKoreanPoiSegment('천혜의 자연 새섬') ?? ''), /Saipan Bird Island/i)
    assert.match(String(firstMatchingScheduleSpotEn('라플린') ?? ''), /Laughlin/i)
    assert.match(String(firstMatchingScheduleSpotEn('코닥극장') ?? ''), /Chinese Theatre|Hollywood/i)
    // REGRESSION-FREEZE[pexels-hk-hollywood-road-not-la]: 헐리우드로드 = 홍콩 ≠ LA — manifest
    assert.equal(firstMatchingScheduleSpotEn('헐리우드로드'), 'Hollywood Road Hong Kong')
    assert.equal(firstMatchingScheduleSpotEn('할리우드 로드'), 'Hollywood Road Hong Kong')
    assert.equal(mapKoreanPoiSegment('헐리우드로드'), 'Hollywood Road Hong Kong')
    assert.match(String(firstMatchingScheduleSpotEn('니지노마츠바라') ?? ''), /Nijinomatsubara/i)
    assert.match(String(firstMatchingScheduleSpotEn('비엔티엔') ?? ''), /Vientiane|That Luang/i)
  })

  // REGRESSION-FREEZE[schedule-poi-regex-ssot]: 치토세 공항·후라노 라벤더 — Provence 환각 금지 — manifest
  it('maps Hokkaido Farm Tomita lavender and Chitose airport — not Provence', () => {
    assert.match(
      String(firstMatchingScheduleSpotEn('팜 토미타 - 라벤더 소프트 아이스크림 증정') ?? ''),
      /Farm Tomita|Furano/i,
    )
    assert.doesNotMatch(
      String(firstMatchingScheduleSpotEn('팜 토미타 - 라벤더 소프트 아이스크림 증정') ?? ''),
      /Provence|Valensole/i,
    )
    assert.match(String(firstMatchingScheduleSpotEn('치토세 국제공항 이동') ?? ''), /Chitose/i)
    assert.match(String(firstMatchingScheduleSpotEn('프로방스 라벤더 밭') ?? ''), /Provence|Valensole/i)
  })

  // REGRESSION-FREEZE[schedule-poi-regex-ssot]: 도게츠교≠Doge's Palace — manifest
  it('maps Togetsukyo Arashiyama — not Doge Palace Venice', () => {
    assert.match(String(firstMatchingScheduleSpotEn('도게츠교') ?? ''), /Togetsu|Arashiyama/i)
    assert.doesNotMatch(String(firstMatchingScheduleSpotEn('도게츠교') ?? ''), /Doge/i)
    assert.match(
      String(firstMatchingScheduleSpotEn('아라시야마 - 도게츠교 - 치쿠린') ?? ''),
      /Arashiyama|Togetsu/i,
    )
    assert.doesNotMatch(String(firstMatchingScheduleSpotEn('아라시야마 - 도게츠교 - 치쿠린') ?? ''), /Doge/i)
  })

  // REGRESSION-FREEZE[schedule-poi-regex-ssot]: 이집트 스핑크스 ≠ Jungfraujoch — manifest
  it('maps Egypt Giza Sphinx — not Jungfraujoch Swiss Alps', () => {
    assert.match(String(firstMatchingScheduleSpotEn('기자의 피라미드와 스핑크스') ?? ''), /Great Sphinx|Giza/i)
    assert.doesNotMatch(String(firstMatchingScheduleSpotEn('기자의 피라미드와 스핑크스') ?? ''), /Jungfrau/i)
    assert.match(String(firstMatchingScheduleSpotEn('카이로 - 스핑크스 - 피라미드') ?? ''), /Great Sphinx|Giza/i)
    assert.doesNotMatch(String(firstMatchingScheduleSpotEn('카이로 - 스핑크스 - 피라미드') ?? ''), /Jungfrau/i)
    assert.match(
      String(firstMatchingScheduleSpotEn('융프라우요흐 스핑크스 전망대') ?? ''),
      /Jungfraujoch|Sphinx Observatory/i,
    )
    assert.match(String(firstMatchingScheduleSpotEn('Sphinx Observatory') ?? ''), /Jungfraujoch/i)
  })

  // REGRESSION-FREEZE[schedule-poi-regex-ssot]: Iberia·남프랑스 ESP104 day-owned POI — manifest
  it('maps Iberia and South France day POIs — Guam 스페인광장 stays Guam', () => {
    assert.match(String(firstMatchingScheduleSpotEn('마세나 광장') ?? ''), /Massena|Nice/i)
    assert.match(String(firstMatchingScheduleSpotEn('아를 구시가지') ?? ''), /Arles/i)
    assert.match(String(firstMatchingScheduleSpotEn('알함브라궁전') ?? ''), /Alhambra/i)
    assert.match(String(firstMatchingScheduleSpotEn('프라도미술관') ?? ''), /Prado/i)
    assert.match(String(firstMatchingScheduleSpotEn('마드리드왕궁') ?? ''), /Royal Palace Madrid/i)
    assert.match(String(firstMatchingScheduleSpotEn('히랄다탑') ?? ''), /Giralda/i)
    assert.match(
      String(firstMatchingScheduleSpotEn('세비야 - 스페인광장 - 히랄다탑') ?? ''),
      /Plaza de Espana Seville|Giralda|Seville Cathedral/i,
    )
    assert.doesNotMatch(String(firstMatchingScheduleSpotEn('세비야 - 스페인광장') ?? ''), /Guam/i)
    assert.match(String(firstMatchingScheduleSpotEn('괌 스페인광장') ?? ''), /Guam/i)
    assert.match(String(firstMatchingScheduleSpotEn('구엘공원') ?? ''), /Park Guell|G[uü]ell/i)
    assert.match(String(firstMatchingScheduleSpotEn('까보다로카') ?? ''), /Cabo da Roca/i)
    assert.match(String(firstMatchingScheduleSpotEn('까보다로까') ?? ''), /Cabo da Roca/i)
    assert.match(String(firstMatchingScheduleSpotEn('베나길 해변') ?? ''), /Benagil/i)
    assert.match(String(firstMatchingScheduleSpotEn('사그레스 - 상비센테 곶') ?? ''), /Sagres|Vincent/i)
    assert.doesNotMatch(String(firstMatchingScheduleSpotEn('이스탄불 - 인천') ?? ''), /Arles/i)
    assert.match(String(mapKoreanPoiSegment('스페인광장') ?? ''), /Seville/i)
    assert.match(String(mapKoreanPoiSegment('괌 스페인광장') ?? ''), /Guam/i)
  })

  // REGRESSION-FREEZE[schedule-poi-regex-ssot]: 홍콩 디즈니랜드 ≠ Tokyo/Shanghai — manifest
  it('maps Hong Kong Disneyland — not Tokyo or Shanghai', () => {
    assert.match(String(firstMatchingScheduleSpotEn('홍콩 디즈니랜드') ?? ''), /Hong Kong Disneyland/i)
    assert.doesNotMatch(String(firstMatchingScheduleSpotEn('홍콩 디즈니랜드') ?? ''), /Tokyo|Shanghai/i)
    assert.match(String(firstMatchingScheduleSpotEn('도쿄 디즈니랜드') ?? ''), /Tokyo Disneyland/i)
    assert.match(String(firstMatchingScheduleSpotEn('상하이 디즈니') ?? ''), /Shanghai Disneyland/i)
    assert.match(String(firstMatchingScheduleSpotEn('빅토리아 산정') ?? ''), /Victoria Peak/i)
    assert.match(
      String(routeContextualDisneyEnglish('디즈니랜드', '홍콩 - 디즈니랜드', '홍콩') ?? ''),
      /Hong Kong Disneyland/i,
    )
    assert.match(
      String(routeContextualDisneyEnglish('디즈니랜드', '디즈니랜드', '홍콩') ?? ''),
      /Hong Kong Disneyland/i,
    )
    assert.match(String(mapKoreanPoiSegment('홍콩 디즈니랜드') ?? ''), /Hong Kong Disneyland/i)
    assert.doesNotMatch(String(mapKoreanPoiSegment('디즈니랜드') ?? ''), /Tokyo|Shanghai|Hong Kong/i)
  })

  // REGRESSION-FREEZE[schedule-poi-regex-ssot]: 리기≠승리기념탑 — Baltic Victory Monument bleed 금지 — manifest
  it('does not map Baltic Victory Monument 승리기념탑 to Mount Rigi', () => {
    assert.doesNotMatch(
      String(firstMatchingScheduleSpotEn('체시스 - 승리기념탑 - 시굴다 - 투라이다 성') ?? ''),
      /Rigi|Jungfrau|Swiss/i,
    )
    assert.match(
      String(firstMatchingScheduleSpotEn('체시스 - 승리기념탑 - 시굴다 - 투라이다 성') ?? ''),
      /Cesis|Sigulda|Turaida/i,
    )
    assert.match(String(firstMatchingScheduleSpotEn('리기산 전망') ?? ''), /Rigi/i)
    assert.match(String(firstMatchingScheduleSpotEn('주노 - 껌벽 등') ?? ''), /Juneau/i)
    assert.doesNotMatch(String(firstMatchingScheduleSpotEn('주노 - 껌벽 등') ?? ''), /Glacier Bay/i)
    assert.match(String(firstMatchingScheduleSpotEn('케치칸') ?? ''), /Ketchikan/i)
    assert.match(String(firstMatchingScheduleSpotEn('빌라누프 궁전') ?? ''), /Wilanow/i)
  })

  // REGRESSION-FREEZE[register-pre-photo-empty-middle-is-free-day]: 포르트 카이요 ≠ Cairo — manifest
  it('maps 포르트 카이요 to Porte Cailhau not Cairo', () => {
    assert.match(String(firstMatchingScheduleSpotEn('포르트 카이요') ?? ''), /Porte Cailhau/i)
    assert.doesNotMatch(String(firstMatchingScheduleSpotEn('포르트 카이요') ?? ''), /Cairo/i)
  })
})
