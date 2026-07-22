/**
 * REGRESSION-FREEZE[register-destination-reject-ilju]: bare 「일주」 destination 금지 — manifest
 */
import { describe, expect, it } from 'vitest'
import {
  filterRegisterDestinationTitlePlaceTokens,
  firstRegisterDestinationPlaceFromTitleHead,
  isRegisterDestinationTourStyleNoiseToken,
} from '@/lib/register-destination-tour-style-noise'
import { resolveHanatourRegisterDestination } from '@/lib/hanatour-register-destination-from-paste'
import { resolveModetourRegisterDestination } from '@/lib/modetour-register-destination-from-paste'
import { resolveLottetourRegisterDestination } from '@/lib/lottetour-register-destination-from-paste'
import { resolveKyowontourRegisterDestination } from '@/lib/kyowontour-register-api-parse'
import {
  finalizeRegisterDestinationFields,
  healRegisterDestinationLabel,
  isRegisterDestinationPollutionLabel,
} from '@/lib/register-destination-finalize'
import { resolveProductListDestinationLabel } from '@/lib/verygoodtour-listing-title-from-paste'

describe('register-destination-reject-ilju', () => {
  it('rejects bare 일주 / 개국 tokens', () => {
    expect(isRegisterDestinationTourStyleNoiseToken('일주')).toBe(true)
    expect(isRegisterDestinationTourStyleNoiseToken('완전일주')).toBe(true)
    expect(isRegisterDestinationTourStyleNoiseToken('개국')).toBe(true)
    expect(isRegisterDestinationTourStyleNoiseToken('터키')).toBe(false)
    expect(isRegisterDestinationTourStyleNoiseToken('미서부')).toBe(false)
  })

  it('2030-style head: 2개국 일주 → not 개국/일주', () => {
    expect(firstRegisterDestinationPlaceFromTitleHead('요르단·이집트 2개국 일주')).toBe('요르단')
    expect(firstRegisterDestinationPlaceFromTitleHead('2개국 일주')).toBeNull()
    expect(firstRegisterDestinationPlaceFromTitleHead('일주')).toBeNull()
    expect(firstRegisterDestinationPlaceFromTitleHead('터키 일주')).toBe('터키')
  })

  it('title hint tokens drop bare 일주', () => {
    expect(filterRegisterDestinationTitlePlaceTokens(['스페인', '일주'])).toEqual(['스페인'])
    expect(filterRegisterDestinationTitlePlaceTokens(['터키 일주'])).toEqual(['터키'])
  })

  it('hanatour/modetour/lottetour destination never bare 일주', () => {
    const titles = [
      '스페인·일주 10일',
      '터키 일주 9일',
      '요르단·이집트 2개국 일주 10일',
      '독일 완전일주 9일',
    ]
    for (const title of titles) {
      for (const resolve of [
        resolveHanatourRegisterDestination,
        resolveModetourRegisterDestination,
        resolveLottetourRegisterDestination,
      ]) {
        const r = resolve({ title, pastedBody: '' })
        expect(r.destination).not.toMatch(/^(?:완전)?일주$/)
        expect(r.destination).not.toMatch(/개국\s*일주/)
        expect(String(r.primaryDestination ?? '')).not.toMatch(/^(?:완전)?일주$/)
        expect(r.destination.length).toBeGreaterThan(1)
      }
    }
  })

  it('kyowontour: 튀르키예/이탈리아 일주 → country not 일주', () => {
    expect(resolveKyowontourRegisterDestination('튀르키예 일주 9일 [여행의 정석]').destination).toBe(
      '튀르키예',
    )
    expect(
      resolveKyowontourRegisterDestination('NO유류 차액! 출발가능 이탈리아 일주 11일').destination,
    ).toBe('이탈리아')
  })

  it('pollution: promo / policy / airline / mingling', () => {
    expect(isRegisterDestinationPollutionLabel('일주')).toBe(true)
    expect(isRegisterDestinationPollutionLabel('출발확정')).toBe(true)
    expect(isRegisterDestinationPollutionLabel('노쇼핑')).toBe(true)
    expect(isRegisterDestinationPollutionLabel('노쇼핑 · 노옵션 · 노팁')).toBe(true)
    expect(isRegisterDestinationPollutionLabel('여행일정')).toBe(true)
    expect(isRegisterDestinationPollutionLabel('밍글링 투어 Light')).toBe(true)
    expect(
      isRegisterDestinationPollutionLabel('에어프레미아 이코노미 클래스 외 승무원 안내'),
    ).toBe(true)
    expect(isRegisterDestinationPollutionLabel('튀르키예')).toBe(false)
    expect(isRegisterDestinationPollutionLabel('다낭')).toBe(false)
    expect(isRegisterDestinationPollutionLabel('괌')).toBe(false)
    expect(isRegisterDestinationPollutionLabel('온라인전용')).toBe(true)
    expect(isRegisterDestinationPollutionLabel('풀패키지')).toBe(true)
    expect(isRegisterDestinationPollutionLabel('2030전용')).toBe(true)
    expect(isRegisterDestinationPollutionLabel('KE')).toBe(true)
  })

  it('heal: polluted current → title / countryKey', () => {
    expect(
      healRegisterDestinationLabel({
        title: '튀르키예 일주 9일',
        current: '일주',
        countryKey: 'turkey',
      }),
    ).toBe('튀르키예')
    expect(
      healRegisterDestinationLabel({
        title: '[다낭] 자유여행 3박5일',
        current: '노쇼핑',
      }),
    ).toBe('다낭')
    expect(
      healRegisterDestinationLabel({
        title: '패키지 상품',
        current: '출발확정',
        countryKey: 'italy',
      }),
    ).toBe('이탈리아')
    expect(
      healRegisterDestinationLabel({
        title: '[온라인전용]발트 3국[에스토니아/라트비아/리투아니아]과 폴란드 9일',
        current: '폴란드 항공 LOT · LO 폴란드항공 이코노미클래스 외',
        countryKey: 'lithuania',
      }),
    ).toBe('에스토니아 · 라트비아 · 리투아니아')
    expect(
      healRegisterDestinationLabel({
        title: '[2030전용] 칭다오(청도) 3일 #ALL포함 #운상해천전망대',
        current: '밍글링 투어 Light · 밍글링 타임 외',
        countryKey: 'china',
      }),
    ).toBe('칭다오')
    expect(
      healRegisterDestinationLabel({
        title: '자카르타/족자카르타 6일 #국내선 이동포함',
        current: '노쇼핑 · 노옵션 · 노팁',
        countryKey: 'indonesia',
      }),
    ).toBe('자카르타')
    expect(
      healRegisterDestinationLabel({
        title: '북유럽&발트 7개국 12일',
        current: '노쇼핑',
        countryKey: 'lithuania',
      }),
    ).toBe('북유럽&발트')
    expect(
      finalizeRegisterDestinationFields({
        title: '괌 닛코 오션프론트룸 3박5일',
        destination: '괌',
        destinationRaw: '여행일정',
        primaryDestination: null,
      }).destination,
    ).toBe('괌')
    const fin = finalizeRegisterDestinationFields({
      title: '이탈리아 일주 11일',
      destination: '일주',
      destinationRaw: '일주',
      primaryDestination: '일주',
    })
    expect(fin.destination).toBe('이탈리아')
    expect(fin.primaryDestination).toBe('이탈리아')
  })

  it('list label skips polluted stored destination', () => {
    expect(
      resolveProductListDestinationLabel({
        primaryDestination: '일주',
        destination: '일주',
        title: '튀르키예 일주 9일',
        countryKey: 'turkey',
      }),
    ).toBe('튀르키예')
    expect(
      resolveProductListDestinationLabel({
        primaryDestination: '노쇼핑',
        title: '[치앙마이] #노쇼핑 4일',
      }),
    ).toBe('치앙마이')
  })
})
