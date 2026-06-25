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
