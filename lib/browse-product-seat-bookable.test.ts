import { describe, expect, it } from 'vitest'
import { isBrowseProductFullySoldOut } from '@/lib/browse-product-seat-bookable'
import type { ProductBrowseDepartureRow } from '@/lib/product-browse-full-include'

function dep(
  partial: Partial<ProductBrowseDepartureRow> & { adultPrice: number | null },
): ProductBrowseDepartureRow {
  return {
    productId: 'p1',
    baselineAdultPrice: null,
    departureDate: new Date('2026-08-01'),
    minPax: null,
    outboundDepartureAt: null,
    carrierName: null,
    seatCount: null,
    seatsStatusRaw: null,
    statusRaw: null,
    isBookable: null,
    ...partial,
  }
}

describe('isBrowseProductFullySoldOut', () => {
  it('가격 있는 날이 전부 잔여 0이면 판매완료', () => {
    expect(
      isBrowseProductFullySoldOut([
        dep({ adultPrice: 1_200_000, seatCount: 0, seatsStatusRaw: '잔여0' }),
        dep({ adultPrice: 1_250_000, seatsStatusRaw: '잔여0' }),
      ]),
    ).toBe(true)
  })

  it('가격 없음·출발 없음·좌석 미수집은 판매완료 아님', () => {
    expect(isBrowseProductFullySoldOut([])).toBe(false)
    expect(isBrowseProductFullySoldOut([dep({ adultPrice: 0 })])).toBe(false)
    expect(isBrowseProductFullySoldOut([dep({ adultPrice: 1_000_000 })])).toBe(false)
    expect(isBrowseProductFullySoldOut([dep({ adultPrice: 839_000, seatCount: 0 })])).toBe(false)
  })

  it('가격 있는 날 중 하나라도 잔여석 있으면 판매완료 아님', () => {
    expect(
      isBrowseProductFullySoldOut([
        dep({ adultPrice: 1_200_000, seatCount: 0 }),
        dep({ adultPrice: 1_250_000, seatCount: 2 }),
      ]),
    ).toBe(false)
  })
})
