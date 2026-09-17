/**
 * REGRESSION-FREEZE[verygoodtour-register-destination]: hash·route 목적지 — manifest
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  extractVerygoodGeoTokensFromHashTitle,
  inferVerygoodRegisterDestinationFromScheduleRoutes,
  resolveVerygoodtourRegisterDestination,
} from './verygoodtour-register-destination-from-paste'

describe('verygoodtour register destination — APP0671 pattern', () => {
  it('hash title — 말라카·겐팅 토큰', () => {
    const tokens = extractVerygoodGeoTokensFromHashTitle('5일 #전일관광/말라카/겐팅_딤섬세트제공')
    assert.deepEqual(tokens, ['말라카', '겐팅'])
  })

  it('schedule routes — 쿠알라룸푸르 해외 지명', () => {
    const dest = inferVerygoodRegisterDestinationFromScheduleRoutes([
      '인천 - 쿠알라룸푸르',
      '쿠알라룸푸르 왕궁 - 겐팅하이랜드',
    ])
    assert.match(dest ?? '', /쿠알라룸푸르/)
    assert.match(dest ?? '', /겐팅/)
  })

  it('resolve — 기간-only title + route 폴백', () => {
    const out = resolveVerygoodtourRegisterDestination({
      title: '5일 #전일관광/말라카/겐팅_딤섬세트제공',
      pastedBody: '',
      scheduleRouteTexts: ['인천 - 쿠알라룸푸르'],
    })
    assert.equal(out.destination, '말라카 · 겐팅')
  })

  it('resolve — 서부지중해 크루즈는 bare 서부가 아니라 괄호 국가', () => {
    // REGRESSION-FREEZE[register-ocean-cruise-product]
    const out = resolveVerygoodtourRegisterDestination({
      title: '서부지중해 크루즈 3개국(이탈리아/남프랑스/스페인) 11일 #코스타 토스카나 호',
      pastedBody: '',
      scheduleRouteTexts: ['로마', '전일해상 - 발도르...'],
    })
    assert.equal(out.destination, '이탈리아 · 남프랑스 · 스페인')
    assert.notEqual(out.destination, '서부')
  })
})
