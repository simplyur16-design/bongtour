import { describe, expect, it } from 'vitest'
import {
  buildOtaCompanyInvoiceDraft,
  computeInvoiceProfitKrw,
  parseOtaReceiptForInvoice,
} from '@/lib/bongtour-company-invoice'

describe('admin-ota-receipt-invoice', () => {
  // REGRESSION-FREEZE[admin-ota-receipt-invoice]
  it('parses Agoda-style KRW total and booking id', () => {
    const text = `
Agoda Booking Confirmation
예약 번호: 1234567890
숙소명: Test Hotel Phnom Penh
고객명: HONG GILDONG
체크인: 2026-11-01
체크아웃: 2026-11-03
총 결제 금액: KRW 450,000
`
    const p = parseOtaReceiptForInvoice(text)
    expect(p.provider).toBe('agoda')
    expect(p.bookingRef).toBe('1234567890')
    expect(p.sourceAmountKrw).toBe(450000)
    expect(p.guestName).toMatch(/HONG/i)
  })

  it('adds percent profit on top of source amount', () => {
    expect(computeInvoiceProfitKrw({ sourceAmountKrw: 100000, mode: 'percent', percent: 15, fixedKrw: 0 })).toBe(
      15000,
    )
    const draft = buildOtaCompanyInvoiceDraft({
      parsed: {
        provider: 'trip_com',
        bookingRef: 'T1',
        guestName: 'Kim',
        propertyOrService: 'Hotel',
        checkIn: null,
        checkOut: null,
        sourceAmountKrw: 100000,
        currencyHint: 'KRW',
        rawAmountMatches: ['100000'],
      },
      sourceAmountKrw: 100000,
      profitMode: 'percent',
      profitPercent: 10,
      profitFixedKrw: 0,
      now: new Date('2026-10-05T00:00:00.000Z'),
    })
    expect(draft.profitKrw).toBe(10000)
    expect(draft.totalKrw).toBe(110000)
  })
})
