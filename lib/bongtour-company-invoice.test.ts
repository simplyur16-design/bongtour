import { describe, expect, it } from 'vitest'
import {
  buildOtaCompanyCheckInVoucherDraft,
  buildOtaCompanyInvoiceDraft,
  computeInvoiceProfitKrw,
  parseOtaReceiptForInvoice,
  renderOtaCompanyCheckInVoucherHtml,
} from '@/lib/bongtour-company-invoice'
import {
  parseFrankfurterUsdKrw,
  usdAmountToKrw,
} from '@/lib/bongtour-usd-krw-rate'

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
객실 타입: Deluxe Twin
2박
총 결제 금액: KRW 450,000
`
    const p = parseOtaReceiptForInvoice(text)
    expect(p.provider).toBe('agoda')
    expect(p.bookingRef).toBe('1234567890')
    expect(p.sourceAmountKrw).toBe(450000)
    expect(p.guestName).toMatch(/HONG/i)
    expect(p.roomType).toMatch(/Deluxe/i)
    expect(p.nights).toBe(2)
  })

  it('uses entered amount as final total (no profit markup)', () => {
    expect(computeInvoiceProfitKrw({ sourceAmountKrw: 100000, mode: 'percent', percent: 15, fixedKrw: 0 })).toBe(
      0,
    )
    const draft = buildOtaCompanyInvoiceDraft({
      parsed: {
        provider: 'trip_com',
        bookingRef: 'T1',
        guestName: 'Kim',
        propertyOrService: 'Hotel',
        checkIn: null,
        checkOut: null,
        roomType: null,
        nights: null,
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
    expect(draft.profitKrw).toBe(0)
    expect(draft.totalKrw).toBe(100000)
  })

  // REGRESSION-FREEZE[admin-ota-receipt-invoice]: 체크인 바우처 + USD 입력일 환율 — manifest
  it('builds company check-in voucher from USD using input-date FX', () => {
    const rate = 1350
    expect(usdAmountToKrw(100, rate)).toBe(135000)
    const frank = parseFrankfurterUsdKrw({
      base: 'USD',
      date: '2026-10-03',
      rates: { KRW: 1350 },
    })
    expect(frank?.usdKrw).toBe(1350)
    expect(frank?.effectiveDate).toBe('2026-10-03')

    const draft = buildOtaCompanyCheckInVoucherDraft({
      parsed: {
        provider: 'trip_com',
        bookingRef: '998877',
        guestName: 'LEE',
        propertyOrService: 'Siem Reap Grand',
        checkIn: '2026-11-10',
        checkOut: '2026-11-12',
        roomType: 'Superior',
        nights: 2,
        sourceAmountKrw: null,
        currencyHint: 'USD',
        rawAmountMatches: [],
      },
      amountUsd: 128.5,
      rateDate: '2026-10-05',
      effectiveRateDate: '2026-10-03',
      usdKrwRate: rate,
      amountKrw: usdAmountToKrw(128.5, rate),
      now: new Date('2026-10-05T00:00:00.000Z'),
    })
    expect(draft.voucherNumber).toMatch(/^BT-VCH-/)
    expect(draft.amountUsd).toBe(128.5)
    expect(draft.amountKrw).toBe(173475)
    const html = renderOtaCompanyCheckInVoucherHtml(draft)
    expect(html).toContain('체크인 바우처')
    expect(html).toContain('Siem Reap Grand')
    expect(html).toContain('173,475원')
  })
})
