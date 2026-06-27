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

  it('description — route 1줄 + 분위기 2문장, 장소 디테일 없음', () => {
    const routePlaces = dedupeYbtourScheduleRoutePlaces([
      '홍콩섬 센트럴',
      '소호 거리(SoHo)',
      '헐리우드 로드',
    ])
    const desc = composeYbtourScheduleDescription({
      day: 2,
      maxDay: 4,
      routePlaces,
      joinedBlob: routePlaces.join(' '),
    })
    const lines = desc.split('\n')
    assert.equal(lines[0], '홍콩섬 센트럴 - 소호 거리(SoHo) - 헐리우드 로드')
    assert.match(lines[1] ?? '', /분위기|동선|걷/)
    assert.doesNotMatch(desc, /센트럴.*세부|소호.*상세/)
  })
})
