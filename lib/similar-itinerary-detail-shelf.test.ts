import { describe, expect, it } from 'vitest'
import {
  deriveShelfTip,
  selectSimilarDetailPeers,
  shelfPackagePriceLabel,
  similarTripLengthRelation,
} from '@/lib/similar-itinerary-detail-shelf'

describe('similar itinerary detail shelf', () => {
  it('같은 박일은 exact, 하루 차이는 near, 그 밖은 far', () => {
    const anchor = { duration: '3박 4일' }
    expect(similarTripLengthRelation(anchor, { duration: '3박 4일' })).toBe('exact')
    expect(similarTripLengthRelation(anchor, { duration: '3박 5일' })).toBe('near')
    expect(similarTripLengthRelation(anchor, { duration: '2박 3일' })).toBe('near')
    expect(similarTripLengthRelation(anchor, { duration: '5박 6일' })).toBe('far')
    expect(similarTripLengthRelation(anchor, { duration: '5일' })).toBe('far')
  })

  it('같은 기간이 충분하면 하루 차이를 넣지 않고, 적으면 넓힌다', () => {
    const peers = [
      { id: 'a', relation: 'exact' as const },
      { id: 'b', relation: 'exact' as const },
      { id: 'c', relation: 'near' as const },
    ]
    expect(selectSimilarDetailPeers(peers, 2).widened).toBe(false)
    expect(selectSimilarDetailPeers(peers, 2).items.map((p) => p.id)).toEqual(['a', 'b'])
    const thin = selectSimilarDetailPeers(peers, 4)
    expect(thin.widened).toBe(true)
    expect(thin.items.map((p) => p.id)).toEqual(['a', 'b', 'c'])
    expect(selectSimilarDetailPeers([{ id: 'z', relation: 'far' }], 4).items).toEqual([])
  })

  it('외화 금액은 통화 코드를 유지하고 원으로 바꾸지 않는다', () => {
    expect(shelfPackagePriceLabel({ adultKrw: 120000, priceCurrency: 'USD', priceFrom: 890 }).label).toBe('USD 890')
    expect(shelfPackagePriceLabel({ adultKrw: 120000, priceCurrency: 'KRW', priceFrom: 890 }).label).toContain('원')
  })

  it('노팁과 팁 원문 금액을 구분한다', () => {
    expect(deriveShelfTip(['노팁 노옵션']).kind).toBe('no')
    expect(deriveShelfTip(['가이드팁 USD 20']).label).toContain('USD 20')
  })
})
