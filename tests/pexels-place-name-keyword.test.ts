import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  assertCleanPlaceKeyword,
  finalizeScheduleImageKeyword,
  isGenericAnyCityLandmarkKeyword,
  isScheduleImageKeywordLandmarkEligible,
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

  it('Universal Studios 등 복합 관광지명은 잘리지 않음', () => {
    assert.equal(finalizeScheduleImageKeyword('Universal Studios'), 'Universal Studios')
    assert.equal(finalizeScheduleImageKeyword('Universal Studios Japan'), 'Universal Studios Japan')
    assert.equal(finalizeScheduleImageKeyword('Henderson Waves Bridge'), 'Henderson Waves Bridge')
  })

  it('Nha Trang 도시명은 Nha 로 잘리지 않음', () => {
    assert.equal(finalizeScheduleImageKeyword('Nha Trang'), 'Nha Trang')
    assert.equal(normalizeToPlaceName('Nha Trang'), 'Nha Trang')
  })

  // REGRESSION-FREEZE[pexels-normalize-da-nang-not-da]: Da Nang ≠ Da
  it('Da Nang 도시명은 Da 로 잘리지 않음', () => {
    assert.equal(finalizeScheduleImageKeyword('Da Nang'), 'Da Nang')
    assert.equal(normalizeToPlaceName('Da Nang'), 'Da Nang')
    assert.equal(finalizeScheduleImageKeyword('danang'), 'Da Nang')
    assert.equal(finalizeScheduleImageKeyword('Da Nang beach city skyline'), 'Da Nang')
    assert.equal(finalizeScheduleImageKeyword('Da Nang Han River / Dragon Bridge waterfront skyline / wide angle'), 'Da Nang')
  })

  // REGRESSION-FREEZE[pexels-normalize-bare-multiword-city]: stripTrailingGeoTokens 전체명 보존
  it('Phu Quoc 도시명은 빈 문자열로 깎이지 않음', () => {
    assert.equal(normalizeToPlaceName('Phu Quoc'), 'Phu Quoc')
    assert.equal(finalizeScheduleImageKeyword('Phu Quoc'), 'Phu Quoc')
  })

  it('Forbidden City — City 보조어 제거로 Forbidden 단독이 되지 않음', () => {
    assert.equal(finalizeScheduleImageKeyword('Forbidden City'), 'Forbidden City')
    assert.equal(isScheduleImageKeywordLandmarkEligible('Forbidden City'), true)
  })

  it('Beijing Forbidden City view — 도시 세그먼트는 Beijing(랜드마크 아님)', () => {
    assert.equal(finalizeScheduleImageKeyword('Beijing Forbidden City view'), 'Beijing')
  })

  // REGRESSION-FREEZE[pexels-hk-hollywood-road-not-la]: 홍콩 헐리우드로드 ≠ LA Hollywood — manifest
  it('Hollywood Road is Hong Kong not LA', () => {
    assert.equal(finalizeScheduleImageKeyword('Hollywood Road'), 'Hollywood Road Hong Kong')
    assert.equal(finalizeScheduleImageKeyword('Hollywood Road Hong Kong'), 'Hollywood Road Hong Kong')
    assert.equal(normalizeToPlaceName('Hollywood Road'), 'Hollywood Road Hong Kong')
    assert.equal(finalizeScheduleImageKeyword('Universal Studios Hollywood'), 'Universal Studios Hollywood')
  })

  // REGRESSION-FREEZE[register-keyword-city-qualified-landmark]: 범용 모스크는 도시 유지·단독 거부 — manifest
  it('generic mosque names stay city-qualified for Pexels', () => {
    assert.equal(isGenericAnyCityLandmarkKeyword('City Mosque'), true)
    assert.equal(isGenericAnyCityLandmarkKeyword('PINK MOSQUE'), true)
    assert.equal(isGenericAnyCityLandmarkKeyword('Blue Mosque'), true)
    assert.equal(isGenericAnyCityLandmarkKeyword('City Mosque Kota Kinabalu'), false)
    assert.equal(isGenericAnyCityLandmarkKeyword('Pink Mosque Kota Kinabalu'), false)
    assert.equal(isGenericAnyCityLandmarkKeyword('Kota Kinabalu City Mosque'), false)
    assert.equal(isGenericAnyCityLandmarkKeyword('Blue Mosque Istanbul'), false)
    assert.equal(normalizeToPlaceName('Pink Mosque Kota Kinabalu'), 'Pink Mosque Kota Kinabalu')
    assert.equal(normalizeToPlaceName('City Mosque Kota Kinabalu'), 'City Mosque Kota Kinabalu')
    assert.equal(normalizeToPlaceName('Kota Kinabalu City Mosque'), 'Kota Kinabalu City Mosque')
    assert.equal(normalizeToPlaceName('Blue Mosque Istanbul'), 'Blue Mosque Istanbul')
    assert.equal(normalizeToPlaceName('City Mosque'), '')
    assert.equal(normalizeToPlaceName('Pink Mosque'), '')
    assert.equal(finalizeScheduleImageKeyword('Pink Mosque Kota Kinabalu'), 'Pink Mosque Kota Kinabalu')
    assert.equal(finalizeScheduleImageKeyword('City Mosque Kota Kinabalu'), 'City Mosque Kota Kinabalu')
  })
})
