import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  finalizeRegisterScheduleImageKeywords,
  persistScheduleImageFields,
  persistScheduleImageKeyword,
  tryPersistScheduleImageKeyword,
} from '../lib/schedule-image-keyword-persist'

describe('persistScheduleImageKeyword', () => {
  it('삼단 입력은 장소명만 저장', () => {
    assert.equal(
      persistScheduleImageKeyword('Osaka Castle / landmark exterior / street-level view'),
      'Osaka Castle',
    )
  })

  it('Day N travel·빈 문자열은 빈 문자열', () => {
    assert.equal(persistScheduleImageKeyword('day 3 travel'), '')
    assert.equal(persistScheduleImageKeyword(''), '')
  })

  it('operational 키는 그대로', () => {
    assert.equal(persistScheduleImageKeyword('day_3'), 'day_3')
    assert.equal(persistScheduleImageKeyword('premade_2'), 'premade_2')
  })

  it('night 보조어는 normalize 후 장소명만', () => {
    assert.equal(persistScheduleImageKeyword('Budapest Night View'), 'Budapest')
  })

  it('Night Market은 tryPersist 통과', () => {
    const r = tryPersistScheduleImageKeyword('Taipei Night Market')
    assert.equal(r.ok, true)
    if (r.ok) assert.equal(r.value, 'Taipei Night Market')
  })
})

describe('persistScheduleImageFields', () => {
  it('세 필드 persist 후 imageKeyword SSOT로 통일', () => {
    const out = persistScheduleImageFields({
      imageKeyword: 'Kota Kinabalu',
      imagePlaceName: 'Kota Kinabalu Resort / landmark exterior / street-level view',
      imageRehostSearchLabel: 'Kota Kinabalu Resort / landmark exterior / street-level view',
    })
    assert.equal(out.imageKeyword, 'Kota Kinabalu')
    assert.equal(out.imagePlaceName, 'Kota Kinabalu')
    assert.equal(out.imageRehostSearchLabel, 'Kota Kinabalu')
  })

  it('Night Market은 place·label에도 유지', () => {
    const out = persistScheduleImageFields({
      imageKeyword: 'Taipei Night Market',
      imagePlaceName: 'Taipei Night Market',
      imageRehostSearchLabel: 'Taipei Night Market',
    })
    assert.equal(out.imageKeyword, 'Taipei Night Market')
    assert.equal(out.imagePlaceName, 'Taipei Night Market')
  })
})

describe('finalizeRegisterScheduleImageKeywords', () => {
  it('일정 행 imageKeyword 일괄 persist', () => {
    const out = finalizeRegisterScheduleImageKeywords([
      { day: 1, imageKeyword: 'Osaka Castle / landmark exterior / street-level view' },
      { day: 2, imageKeyword: 'Taipei Night Market' },
    ])
    assert.equal(out[0]!.imageKeyword, 'Osaka Castle')
    assert.equal(out[1]!.imageKeyword, 'Taipei Night Market')
  })

  it('routeText를 유지하고 경로 순서로 2순위를 보강한다', () => {
    const out = finalizeRegisterScheduleImageKeywords([
      {
        day: 2,
        title: '홍콩',
        description: '홍콩 시내 관광',
        routeText: '홍콩 - 하버 시티 - 소호 거리',
        imageKeyword: 'Victoria Peak',
        imageKeyword2: 'Forbidden City',
      },
    ])
    assert.equal(out[0]!.routeText, '홍콩 - 하버 시티 - 소호 거리')
    assert.equal(out[0]!.imageKeyword, 'Harbour City Hong Kong')
    assert.equal(out[0]!.imageKeyword2, 'SoHo Hong Kong')
  })

  it('한글 일정에서 imageKeyword2 2순위 명소를 보강한다', () => {
    const out = finalizeRegisterScheduleImageKeywords([
      {
        day: 1,
        title: '오사카',
        description: '오사카성 관람 후 도톤보리 산책',
        routeText: '오사카 - 도톤보리',
        imageKeyword: 'Osaka Castle',
        imageKeyword2: null,
      },
    ])
    assert.equal(out[0]!.imageKeyword, 'Dotonbori')
    assert.ok(out[0]!.imageKeyword2 && out[0]!.imageKeyword2.length > 0)
    assert.notEqual(out[0]!.imageKeyword2, out[0]!.imageKeyword)
  })
})
