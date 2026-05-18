import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildItineraryDayPhotoCandidates } from '../lib/itinerary-day-photo-candidates'
import { extractPlaceNameKeyword } from '../lib/pexels-place-name-keyword'
import { persistScheduleImageKeyword } from '../lib/schedule-image-keyword-persist'

describe('empty schedule imageKeyword — Pexels city fallback', () => {
  it('parse 저장값: day N travel·빈 입력은 빈 문자열', () => {
    assert.equal(persistScheduleImageKeyword(''), '')
    assert.equal(persistScheduleImageKeyword('day 3 travel'), '')
  })

  it('extractPlaceNameKeyword: 빈 imageKeyword + cityEn → 도시명', () => {
    assert.equal(
      extractPlaceNameKeyword({ llmImageKeyword: '', cityEn: 'Osaka' }),
      'Osaka',
    )
  })

  it('buildItineraryDayPhotoCandidates: 빈 scheduleImageKeyword → city_landmark 후보', () => {
    const cands = buildItineraryDayPhotoCandidates({
      destination: '일본',
      city: 'Osaka',
      scheduleImageKeyword: '',
      excludeKeys: new Set(),
    })
    const cityCand = cands.find((c) => c.origin === 'city_landmark')
    assert.ok(cityCand, 'city_landmark 후보가 있어야 함')
    assert.match(cityCand!.attractionPart, /osaka/i)
    assert.equal(
      cands.find((c) => c.origin === 'schedule_image_keyword'),
      undefined,
      '빈 imageKeyword는 schedule_image_keyword 후보로 쓰이지 않음',
    )
  })
})
