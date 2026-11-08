import { describe, expect, it } from 'vitest'
import type { ResultItem } from '@/components/products/ProductResultsList'
import { addDaysUtcYmd, kstTodayYmd } from '@/lib/calendar-ymd'
import { productDetailCardPreviewFromResultItem } from '@/lib/product-detail-card-preview-from-item'
import { storedUrgentDealYmdIsStillPublic } from '@/lib/supplier-urgent-deal'

function item(over: Partial<ResultItem>): ResultItem {
  return {
    id: 'p1',
    slug: 'pkg-yb-0012',
    title: '다낭',
    originSource: 'ybtour',
    productType: 'travel',
    primaryDestination: '다낭',
    duration: '3박5일',
    bgImageUrl: null,
    effectivePricePerPersonKrw: 500000,
    ...over,
  }
}

describe('expired urgent deal date is not linked or priced as urgent', () => {
  const today = kstTodayYmd()
  const yesterday = addDaysUtcYmd(today, -1)
  const future = addDaysUtcYmd(today, 10)

  it('uses the urgent-deal lower bound for yesterday, today, and a future date', () => {
    expect(storedUrgentDealYmdIsStillPublic(yesterday, today)).toBe(false)
    expect(storedUrgentDealYmdIsStillPublic(today, today)).toBe(true)
    expect(storedUrgentDealYmdIsStillPublic(future, today)).toBe(true)
  })

  it('drops a yesterday urgent date from the detail link and the urgent price', () => {
    const preview = productDetailCardPreviewFromResultItem(
      item({
        hasUrgentDeal: true,
        urgentDealNextDepartureDate: yesterday,
        urgentDealCurrentPriceKrw: 100000,
        urgentDealBaselinePriceKrw: 200000,
      }),
      (n) => String(n),
    )
    expect(preview.href).toBe('/products/pkg-yb-0012')
    expect(preview.priceKrw).toBe(500000)
  })

  it('keeps today and a future urgent date on the link', () => {
    for (const ymd of [today, future]) {
      const preview = productDetailCardPreviewFromResultItem(
        item({
          hasUrgentDeal: true,
          urgentDealNextDepartureDate: ymd,
          urgentDealCurrentPriceKrw: 100000,
        }),
        (n) => String(n),
      )
      expect(preview.href).toBe(`/products/pkg-yb-0012?departure=${ymd}`)
      expect(preview.priceKrw).toBe(100000)
    }
  })

  it('leaves a non-urgent card unchanged even if a date is present', () => {
    const preview = productDetailCardPreviewFromResultItem(
      item({
        hasUrgentDeal: false,
        urgentDealNextDepartureDate: future,
        urgentDealCurrentPriceKrw: 100000,
      }),
      (n) => String(n),
    )
    expect(preview.href).toBe('/products/pkg-yb-0012')
    expect(preview.priceKrw).toBe(500000)
  })
})
