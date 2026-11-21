import { describe, expect, it } from 'vitest'
import {
  deriveShelfTip,
  groupSimilarShelfItems,
  interleaveSimilarCardsBySupplier,
  productCodeStem,
  selectSimilarDetailPeers,
  shelfPackagePriceLabel,
  similarShelfProductTitle,
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

  it('같은 공급사의 날짜만 다른 상품코드·같은 제목은 한 장으로 묶고 공급사를 고르게 뽑는다', () => {
    expect(productCodeStem('APP9945-261017BX')).toBe('APP9945')
    expect(productCodeStem('APP9945-261023BX')).toBe('APP9945')
    expect(productCodeStem('AVP238261002TWA')).toBe('AVP238')
    expect(productCodeStem('AVA6537C51')).toBe('AVA6537C51')
    const rows = [
      { id: 'a', supplierKey: 'verygoodtour', originCode: 'APP9945-261017BX', title: '다낭 호이안 5성 호텔 미식', priceSort: 579000 },
      { id: 'b', supplierKey: 'verygoodtour', originCode: 'APP9945-261023BX', title: '다낭 호이안 5성 호텔 미식', priceSort: 579000 },
      { id: 'c', supplierKey: 'hanatour', originCode: 'AVP100', title: '바나힐 야경 다낭', priceSort: 718000 },
      { id: 'd', supplierKey: 'modetour', originCode: 'AVA1', title: '네스타 호이안 자유', priceSort: 690000 },
    ]
    const groups = groupSimilarShelfItems(rows)
    expect(groups).toHaveLength(3)
    const cards = groups.map((group) => ({
      supplierKey: group[0]!.supplierKey,
      priceSort: Math.min(...group.map((item) => item.priceSort)),
    }))
    expect(interleaveSimilarCardsBySupplier(cards, 3).map((card) => card.supplierKey)).toEqual([
      'hanatour',
      'modetour',
      'verygoodtour',
    ])
  })

  it('노팁과 팁 원문 금액을 구분한다', () => {
    expect(deriveShelfTip(['노팁 노옵션']).kind).toBe('no')
    expect(deriveShelfTip(['가이드팁 USD 20']).label).toContain('USD 20')
  })

  it('장소와 박일만 있는 짧은 제목 대신 공급사 상품명을 쓴다', () => {
    expect(similarShelfProductTitle('다낭 3박 5일', '신라모노그램 망고빙수 다낭 5일')).toBe('신라모노그램 망고빙수 다낭 5일')
    expect(similarShelfProductTitle('다낭/호이안 5일 #5성 #NO옵션', null)).toContain('#5성')
  })
})
