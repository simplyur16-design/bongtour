import { describe, expect, it } from 'vitest'
import { normalizeModetourOptionalTourDisplayName, stripModetourOptionalTourNamePrefix } from './modetour-optional-tour-name'

describe('stripModetourOptionalTourNamePrefix', () => {
  it('strips paste markup only; keeps accurate tour names including country', () => {
    expect(stripModetourOptionalTourNamePrefix('#(선택관광) 달랏 와인농장')).toBe('달랏 와인농장')
    expect(stripModetourOptionalTourNamePrefix('#[선택] 마우이데이투어')).toBe('마우이데이투어')
    expect(stripModetourOptionalTourNamePrefix('[★담당자 추천 선택관광] 당악궁쇼 ($40/인)')).toBe(
      '당악궁쇼',
    )
    expect(stripModetourOptionalTourNamePrefix('#선택관광-십리화랑($20)')).toBe('십리화랑')
    // 정확한 옵션명 — 나라명 유지
    expect(stripModetourOptionalTourNamePrefix('베트남 전통 마사지 120분')).toBe('베트남 전통 마사지 120분')
    expect(stripModetourOptionalTourNamePrefix('홍콩 나이트투어')).toBe('홍콩 나이트투어')
    expect(stripModetourOptionalTourNamePrefix('마카오 데이투어')).toBe('마카오 데이투어')
    expect(stripModetourOptionalTourNamePrefix('싱가포르 유니버셜 스튜디오')).toBe(
      '싱가포르 유니버셜 스튜디오',
    )
    expect(stripModetourOptionalTourNamePrefix('황산 케이블카')).toBe('황산 케이블카')
    expect(stripModetourOptionalTourNamePrefix('부용진(선택관광/$100)')).toBe('부용진')
    expect(
      stripModetourOptionalTourNamePrefix('천계산 운봉화랑 전동카 + 노야정 케이블카 (선택관광) $60'),
    ).toBe('천계산 운봉화랑 전동카 + 노야정 케이블카')
    expect(stripModetourOptionalTourNamePrefix('카파도키아열기구투어 EUR')).toBe('카파도키아열기구투어')
  })
})

describe('normalizeModetourOptionalTourDisplayName', () => {
  it('uses fallback when only prefix remains', () => {
    expect(normalizeModetourOptionalTourDisplayName('#(선택관광)')).toBe('옵션')
  })
})
