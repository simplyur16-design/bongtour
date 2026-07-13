/**
 * REGRESSION-FREEZE[ybtour-register-detail-collect]
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  composeYbtourScheduleDescription,
  dedupeYbtourScheduleRoutePlaces,
  extractYbtourSchedulePlacesFromTmRows,
  joinYbtourScheduleRouteText,
} from './ybtour-register-api-schedule'

describe('ybtour register api schedule expression', () => {
  it('routeText — tmNo 순서 a–g ` - `', () => {
    const places = extractYbtourSchedulePlacesFromTmRows([
      { tmNo: 1, tmTitle: '호텔 조식 후', cityNm: '다낭' },
      { tmNo: 2, tmTitle: '가이드 미팅 후 호이안 옛도시로 이동', cityNm: '다낭' },
    ])
    assert.deepEqual(places, ['호이안 옛도시'])
    assert.equal(joinYbtourScheduleRouteText(places), '호이안 옛도시')
  })

  it('routeText — blank tmTitle uses cityNm + tmContent 관광/이동', () => {
    const places = extractYbtourSchedulePlacesFromTmRows([
      { tmNo: 1, tmTitle: ' ', cityNm: '비엔티안', tmContent: '호텔 조식 후 체크아웃' },
      { tmNo: 2, tmTitle: ' ', cityNm: '비엔티안', tmContent: '왕궁 박물관 관광' },
      { tmNo: 5, tmTitle: ' ', cityNm: '방비엥', tmContent: '방비엥으로 이동(약 1시간20분 소요)' },
    ])
    assert.equal(places.includes('비엔티안'), true)
    assert.equal(places.includes('방비엥'), true)
    assert.match(joinYbtourScheduleRouteText(places) ?? '', /비엔티안.*방비엥/)
  })

  it('routeText — papi tmContent HTML strip before place extract', () => {
    const places = extractYbtourSchedulePlacesFromTmRows([
      {
        tmNo: 1,
        tmTitle: '로스엔젤레스 도착',
        tmContent:
          '<p>■ <strong>리마</strong> 도착</p><p><span>노랑풍선 차별화 POINT</span></p>',
      },
    ])
    assert.equal(places.includes('리마'), true)
    assert.equal(places.some((p) => /POINT|<\/?\w+/i.test(p)), false)
    const route = joinYbtourScheduleRouteText(places)
    assert.ok(route)
    assert.doesNotMatch(route ?? '', /POINT|<\/?\w+/i)
  })

  it('routeText — 노랑풍선 테이블·원번호 안내·수속 문구 제거', () => {
    const cleaned = dedupeYbtourScheduleRoutePlaces([
      '① 노랑풍선 테이블에서 공항 담당자와',
      '② 수화물 수속 후 탑승동',
      '로스엔젤레스 도착 후 입국 수속',
      '노랑풍선"으로 가이드',
      '로스엔젤레스',
      '＃노랑풍선 TIP 자유시간',
      '트윈픽스에서 샌프란시스코 야경 감상',
      '울창한 산림과 맑은공기가 조화를 이루는 요세미티 국립공원',
      '기상 후 호텔',
    ])
    assert.equal(cleaned.some((p) => /노랑풍선|수화물|기상\s*후|입국\s*수속|야경\s*감상/i.test(p)), false)
    assert.equal(cleaned.includes('로스엔젤레스'), true)
    assert.equal(cleaned.includes('트윈픽스'), true)
    assert.equal(cleaned.includes('요세미티 국립공원'), true)
  })
})
