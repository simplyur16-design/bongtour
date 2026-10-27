// REGRESSION-FREEZE[trip-duration-hashtag-leak]
import { describe, expect, it } from 'vitest'
import {
  deriveTripNightsDays,
  durationHintFromTitleLocal,
  resolvePublicTripDurationLabel,
  titleHeadBeforeHashtag,
} from '@/lib/derive-trip-nights-days'
import { durationHintFromTitle } from '@/lib/bongtour-product-display-title-ssot'
import { buildRegisterDurationLabel } from '@/lib/register-duration-label'

const EGYPT = '이집트 일주 10일 EK #국내선1회 #후르가다 2박3일 #나일크루즈 #월드체인호텔 #인솔자동행'

describe('title head before hashtag', () => {
  it('takes the segment before the first #, or the first non-empty one', () => {
    expect(titleHeadBeforeHashtag(EGYPT)).toBe('이집트 일주 10일 EK')
    expect(titleHeadBeforeHashtag('#홍콩/마카오 4일 #4인출발#노쇼핑')).toBe('홍콩/마카오 4일')
    expect(titleHeadBeforeHashtag('')).toBe('')
  })
  it('title hint prefers head over hashtag N박M일', () => {
    expect(durationHintFromTitleLocal(EGYPT)).toBe('10일')
    expect(durationHintFromTitle(EGYPT)).toBe('10일')
    expect(durationHintFromTitle('뉴질랜드 남/북섬 9일 #온천')).toBe('9일')
    // head has no hint → full-title fallback unchanged
    expect(durationHintFromTitle('#자유여행 #3박5일 다낭')).toBe('3박 5일')
  })
})

describe('hashtag leak correction (pkg-yb-0034)', () => {
  it('stored N박M일 that only appears in a hashtag yields head days, nights unknown', () => {
    expect(deriveTripNightsDays({ duration: '2박 3일', title: EGYPT })).toEqual({
      tripNights: null,
      tripDays: 10,
      label: '10일',
    })
    expect(resolvePublicTripDurationLabel({ duration: '2박 3일', title: EGYPT })).toBe('10일')
  })
  it('keeps stored value when head agrees or the value is in the head', () => {
    expect(resolvePublicTripDurationLabel({ duration: '3박 5일', title: '다낭 3박5일 #호텔' })).toBe('3박 5일')
    expect(resolvePublicTripDurationLabel({ duration: '8박 10일', title: '크루즈 11일' })).toBe('8박 10일')
    expect(resolvePublicTripDurationLabel({ duration: '7박 9일', title: '남미 9일 #이과수 2박3일' })).toBe('7박 9일')
  })
  it('empty stored duration falls back to head days without inventing nights', () => {
    expect(resolvePublicTripDurationLabel({ duration: '', title: '호주/뉴질랜드 9일 #시드니' })).toBe('9일')
    expect(resolvePublicTripDurationLabel({ duration: null, title: '마라톤 참가 #10K' })).toBeNull()
  })
})

describe('buildRegisterDurationLabel (new/pending write path)', () => {
  it('uses supplier nights/days first', () => {
    expect(buildRegisterDurationLabel(3, 5, EGYPT)).toBe('3박 5일')
    expect(buildRegisterDurationLabel(null, 5, EGYPT)).toBe('5일')
  })
  it('falls back to title head only (never the hashtag part)', () => {
    expect(buildRegisterDurationLabel(null, null, EGYPT)).toBe('10일')
    expect(buildRegisterDurationLabel(null, null, '홍콩 2박3일 #야경')).toBe('2박 3일')
    expect(buildRegisterDurationLabel(null, null, '마라톤 #후르가다 2박3일')).toBe('')
    expect(buildRegisterDurationLabel(null, null, null)).toBe('')
  })
  it('never invents nights from days', () => {
    expect(buildRegisterDurationLabel(null, 4, '홍콩 4일')).toBe('4일')
  })
})

describe('partial-day phrases are not the trip length', () => {
  it('skips 1일자유 / 2일차 and takes the real total', () => {
    expect(durationHintFromTitle('[청주출발+오사카의 정석-1일자유] 오사카/교토/난젠지 4일')).toBe('4일')
    expect(durationHintFromTitle('[NO쇼핑NO옵션NO팁] 마나도 준특급 [1일자유+호핑투어+시내관광] 5일')).toBe('5일')
    expect(durationHintFromTitle('홋카이도 자유 4일 #에어텔')).toBe('4일')
    expect(durationHintFromTitle('[오사카 자유3일] 하톤 호텔')).toBe('3일')
    expect(buildRegisterDurationLabel(null, null, '오사카 1일자유 4일')).toBe('4일')
  })
})
