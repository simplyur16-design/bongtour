import { describe, expect, it } from 'vitest'
import { isBrokenRegisterLandmarkKeyword } from '@/lib/register-pre-photo-guards'
import { inferRegisterPendingDestinationFromTitle } from '@/lib/register-pre-photo-verify'
import {
  firstMatchingScheduleCityEn,
  firstMatchingScheduleSpotEn,
} from '@/lib/schedule-poi-regex-ssot'

describe('register-pre-photo-heal-keep-visit-city-keyword', () => {
  it('maps empty-day cities and Bordeaux/Taihang spots', () => {
    expect(firstMatchingScheduleCityEn('위해')).toMatch(/Weihai/i)
    expect(firstMatchingScheduleCityEn('서안')).toMatch(/Xian/i)
    expect(firstMatchingScheduleCityEn('타쉬켄트')).toMatch(/Tashkent/i)
    expect(firstMatchingScheduleCityEn('비쉬켁')).toMatch(/Bishkek/i)
    expect(firstMatchingScheduleCityEn('이스터섬')).toMatch(/Easter Island/i)
    expect(firstMatchingScheduleCityEn('마르세유 - Vaucluse')).toMatch(/Marseille|Vaucluse/i)
    expect(firstMatchingScheduleCityEn('엑상 프로방스')).toMatch(/Aix/i)
    expect(firstMatchingScheduleSpotEn('부르스 광장')).toMatch(/Bourse/i)
    expect(firstMatchingScheduleSpotEn('그랑 테아트르')).toMatch(/Grand Theatre Bordeaux/i)
    expect(firstMatchingScheduleSpotEn('그로스 클로슈')).toMatch(/Grosse Cloche/i)
    expect(firstMatchingScheduleSpotEn('팔리구')).toMatch(/Paligou/i)
    expect(firstMatchingScheduleSpotEn('아틀란티스 더 팜')).toMatch(/Atlantis The Palm/i)
    expect(isBrokenRegisterLandmarkKeyword('Xian')).toBe(false)
    expect(isBrokenRegisterLandmarkKeyword('Porto')).toBe(false)
    expect(isBrokenRegisterLandmarkKeyword('La Paz')).toBe(false)
    expect(isBrokenRegisterLandmarkKeyword('City Mosque')).toBe(true)
    expect(isBrokenRegisterLandmarkKeyword('Pink Mosque')).toBe(true)
    expect(isBrokenRegisterLandmarkKeyword('City Mosque Kota Kinabalu')).toBe(false)
    expect(inferRegisterPendingDestinationFromTitle('마카오 실속')).toBe('마카오')
    expect(inferRegisterPendingDestinationFromTitle('남미 퍼펙트 일주 4개국')).toBe('중남미')
  })
})
