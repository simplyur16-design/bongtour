import { describe, expect, it } from 'vitest'
import { extractProductPriceTableByLabels } from '@/lib/product-price-table-extract'
import {
  backfillVerygoodAirtelPublicPriceRows,
  isVerygoodAirtelListing,
  verygoodPublicMergePriceTable,
} from '@/lib/verygood/verygood-airtel-public-price'

describe('isVerygoodAirtelListing', () => {
  it('matches air_hotel_free and airtel productType', () => {
    expect(isVerygoodAirtelListing('air_hotel_free', null)).toBe(true)
    expect(isVerygoodAirtelListing(null, 'airtel')).toBe(true)
    expect(isVerygoodAirtelListing(null, 'travel')).toBe(false)
  })
})

describe('verygoodPublicMergePriceTable', () => {
  it('keeps full body table for airtel', () => {
    const table = { adultPrice: 900_000, childExtraBedPrice: 800_000, childNoBedPrice: null, infantPrice: 100_000 }
    expect(verygoodPublicMergePriceTable(true, table, table)).toEqual(table)
  })

  it('strips adult/child for package public merge', () => {
    const table = { adultPrice: 900_000, childExtraBedPrice: 800_000, childNoBedPrice: null, infantPrice: 100_000 }
    expect(verygoodPublicMergePriceTable(false, table, table)).toEqual({
      adultPrice: null,
      childExtraBedPrice: null,
      childNoBedPrice: null,
      infantPrice: 100_000,
    })
  })
})

describe('extractProductPriceTableByLabels (참좋은 아동)', () => {
  it('reads plain 아동 row', () => {
    const blob = `구분\t가격
성인\t1,200,000원
아동\t1,000,000원
유아\t150,000원`
    const t = extractProductPriceTableByLabels(blob)
    expect(t?.adultPrice).toBe(1_200_000)
    expect(t?.childExtraBedPrice).toBe(1_000_000)
    expect(t?.infantPrice).toBe(150_000)
  })
})

describe('backfillVerygoodAirtelPublicPriceRows', () => {
  it('synthesizes a bookable row when calendar rows lack adult price', () => {
    const rows = backfillVerygoodAirtelPublicPriceRows(
      [{ id: 'd1', productId: 'p1', date: '2026-08-01', adult: 0, priceAdult: 0, childBed: 0, childNoBed: 0, infant: 0, priceGap: 0 }],
      { adultPrice: 890_000, childExtraBedPrice: 790_000, infantPrice: 120_000 },
      { productId: 'p1', fallbackDateYmd: '2026-08-01' },
    )
    expect(rows[0]?.priceAdult).toBe(890_000)
    expect(rows[0]?.priceChildWithBed).toBe(790_000)
    expect(rows[0]?.priceInfant).toBe(120_000)
  })
})
