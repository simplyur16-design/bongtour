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
})
