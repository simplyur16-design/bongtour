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
})
