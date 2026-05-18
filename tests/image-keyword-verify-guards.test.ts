import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  assertCleanPlaceKeyword,
  finalizeScheduleImageKeyword,
} from '../lib/pexels-place-name-keyword'
import { detectBannedSuffix, findImageKeywordBannedHits } from '../lib/image-keyword-verify-guards'

describe('detectBannedSuffix + ALLOWED_KEYWORD_PATTERNS', () => {
  it('Night Market은 허용 (night 금지 예외)', () => {
    assert.equal(detectBannedSuffix('Taipei Night Market'), null)
    assert.equal(detectBannedSuffix('Shilin Night Market'), null)
    assert.deepEqual(findImageKeywordBannedHits('Raohe Night Market'), [])
  })

  it('Night View·night tour는 차단', () => {
    assert.equal(detectBannedSuffix('Budapest Night View'), ' night')
    assert.equal(detectBannedSuffix('Kota Kinabalu night tour'), ' night tour')
  })

  it('삼단·skyline 등 기존 금지는 유지', () => {
    assert.equal(
      detectBannedSuffix('Osaka Castle / landmark exterior / street-level view'),
      ' / landmark',
    )
    assert.equal(detectBannedSuffix('Shibuya skyline'), ' skyline')
  })
})

describe('assertCleanPlaceKeyword (allowed phrases)', () => {
  it('Night Market은 통과', () => {
    assert.equal(assertCleanPlaceKeyword('Taipei Night Market'), 'Taipei Night Market')
  })

  it('Night View는 throw', () => {
    assert.throws(() => assertCleanPlaceKeyword('Budapest Night View'), /PEXELS_KEYWORD_VIOLATION/)
  })
})

describe('finalizeScheduleImageKeyword (allowed phrases)', () => {
  it('Night Market은 normalize 후에도 유지·통과', () => {
    const kw = finalizeScheduleImageKeyword('Taipei Night Market')
    assert.ok(kw.length > 0)
    assert.equal(detectBannedSuffix(kw), null)
  })
})
