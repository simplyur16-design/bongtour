import { describe, expect, it } from 'vitest'
import { matchProductToOverseasNode } from '@/lib/match-overseas-product'

describe('matchProductToOverseasNode — 세부 아일랜드 vs EU 아일랜드', () => {
  it('세부 아일랜드 상품은 필리핀·세부로 매칭', () => {
    const m = matchProductToOverseasNode({
      title: '세부 아일랜드 3박 5일',
      originSource: 'ybtour',
      primaryDestination: '인천세부인천',
      destination: '인천세부인천',
    })
    expect(m?.countryKey).toBe('philippines')
    expect(m?.leafKey).toBe('cebu')
    expect(m?.matchedTerm).toBe('세부')
  })

  it('제이파크 아일랜드 해시만 있어도 세부 우선', () => {
    const m = matchProductToOverseasNode({
      title: '세부 3박5일 #제이파크 아일랜드 #디럭스가든뷰',
      originSource: 'ybtour',
      primaryDestination: '인천세부인천',
    })
    expect(m?.countryKey).toBe('philippines')
    expect(m?.leafKey).toBe('cebu')
  })

  it('런던 상품은 영국 매칭 유지', () => {
    const m = matchProductToOverseasNode({
      title: '런던 자유여행 9일',
      originSource: 'hanatour',
      primaryDestination: '영국 런던',
      destination: '영국 런던',
    })
    expect(m?.countryKey).toBe('uk')
  })
})

describe('matchProductToOverseasNode — 사이판 아일랜드관광 vs EU 아일랜드', () => {
  // REGRESSION-FREEZE[saipan-island-tour-geo-priority]
  it('사이판+아일랜드관광은 saipan', () => {
    const m = matchProductToOverseasNode({
      title:
        '사이판 크라운플라자 오션프론트룸 <전일정호텔식/레이트체크아웃/아일랜드관광/마나가하섬/별빛크루즈> 3박 5일',
      originSource: 'modetour',
      primaryDestination: '사이판',
      destinationRaw: '사이판',
    })
    expect(m?.countryKey).toBe('saipan')
    expect(m?.leafKey).toBe('saipan')
  })
})
