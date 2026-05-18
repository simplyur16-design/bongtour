import { describe, expect, it } from 'vitest'
import { normalizeModetourOptionalTourDisplayName, stripModetourOptionalTourNamePrefix } from './modetour-optional-tour-name'

describe('stripModetourOptionalTourNamePrefix', () => {
  it('strips #(선택관광) prefix', () => {
    expect(stripModetourOptionalTourNamePrefix('#(선택관광) 달랏 와인농장')).toBe('달랏 와인농장')
  })

  it('strips #선택관광- and #선택관광 - variants', () => {
    expect(stripModetourOptionalTourNamePrefix('#선택관광-십리화랑($20)')).toBe('십리화랑($20)')
    expect(stripModetourOptionalTourNamePrefix('#선택관광 - 황산 발마사지 ($30/인)')).toBe('황산 발마사지 ($30/인)')
  })

  it('strips #선택옵션- prefix', () => {
    expect(stripModetourOptionalTourNamePrefix('#선택옵션-백두산 발마사지 ($30/인)')).toBe('백두산 발마사지 ($30/인)')
  })

  it('strips #name(선택관광) suffix variant', () => {
    expect(stripModetourOptionalTourNamePrefix('#코끼리트래킹(선택관광)')).toBe('코끼리트래킹')
  })

  it('leaves normal names unchanged', () => {
    expect(stripModetourOptionalTourNamePrefix('황산 케이블카')).toBe('황산 케이블카')
  })
})

describe('normalizeModetourOptionalTourDisplayName', () => {
  it('uses fallback when only prefix remains', () => {
    expect(normalizeModetourOptionalTourDisplayName('#(선택관광)')).toBe('옵션')
  })
})
