import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  assertCleanPlaceKeyword,
  finalizeScheduleImageKeyword,
  normalizeToPlaceName,
} from '../lib/pexels-place-name-keyword'

describe('assertCleanPlaceKeyword', () => {
  it('깨끗한 입력은 그대로 반환', () => {
    assert.equal(assertCleanPlaceKeyword('Osaka Castle'), 'Osaka Castle')
  })

  it('빈 문자열은 빈 문자열 반환', () => {
    assert.equal(assertCleanPlaceKeyword(''), '')
  })

  it('삼단 입력 시 throw', () => {
    assert.throws(
      () => assertCleanPlaceKeyword('Osaka Castle / landmark exterior'),
      /PEXELS_KEYWORD_VIOLATION/,
    )
  })

  it('보조어 단독 패턴 시 throw', () => {
    assert.throws(() => assertCleanPlaceKeyword('Shibuya skyline'), /PEXELS_KEYWORD_VIOLATION/)
  })
})

describe('finalizeScheduleImageKeyword', () => {
  it('삼단 입력은 자동 정규화 후 통과', () => {
    assert.equal(
      finalizeScheduleImageKeyword('Osaka Castle / landmark exterior / street-level view'),
      'Osaka Castle',
    )
  })

  it('normalizeToPlaceName 단독 동작 유지', () => {
    assert.equal(normalizeToPlaceName('Shibuya crossing Tokyo night'), 'Shibuya Crossing')
  })
})
