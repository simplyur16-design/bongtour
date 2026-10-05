import { describe, expect, it } from 'vitest'
import {
  BONGTOUR_TAX_SERVICE_INCLUDED_NOTE,
  BONGTOUR_TAX_SERVICE_INCLUDED_NOTE_EN,
  buildOtaCompanyCheckInVoucherDraft,
  buildOtaCompanyInvoiceDraft,
  computeInvoiceProfitKrw,
  parseOtaReceiptForInvoice,
  renderOtaCompanyCheckInVoucherBilingualHtml,
  renderOtaCompanyCheckInVoucherHtml,
  renderOtaCompanyInvoiceHtml,
} from '@/lib/bongtour-company-invoice'
import {
  parseFrankfurterUsdKrw,
  usdAmountToKrw,
} from '@/lib/bongtour-usd-krw-rate'

function emptyParsed(
  overrides: Partial<ReturnType<typeof parseOtaReceiptForInvoice>> = {},
): ReturnType<typeof parseOtaReceiptForInvoice> {
  return {
    provider: 'unknown',
    bookingRef: null,
    guestName: null,
    propertyOrService: null,
    propertyNameKo: null,
    propertyNameEn: null,
    address: null,
    phone: null,
    checkIn: null,
    checkOut: null,
    checkInTime: null,
    checkOutTime: null,
    roomType: null,
    bedType: null,
    rooms: null,
    guestsAdults: null,
    guestsChildren: null,
    nights: null,
    breakfastStatus: 'unknown',
    breakfastText: null,
    taxServiceText: null,
    taxServiceIncluded: null,
    amenities: [],
    inclusionsText: null,
    exclusionsText: null,
    cancellationPolicy: null,
    specialRequests: null,
    paymentMethod: null,
    sourceAmountKrw: null,
    nightRateUsd: null,
    totalUsd: null,
    currencyHint: null,
    rawAmountMatches: [],
    ...overrides,
  }
}

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

  // REGRESSION-FREEZE[admin-ota-receipt-invoice]: 한/영·조식·세금·편의·취소·로고 바우처 — manifest
  it('extracts bilingual hotel, breakfast, tax, amenities, cancellation; renders KO+EN with logo and Booking ID', () => {
    const text = `
Booked And Payable Through : Agoda Company Pte, Ltd.
Arrival : 체크인 : 2026년 11월 02일
Departure : 체크아웃 : 2026년 11월 05일
Booking ID : 예약 번호 : 1761671537
Client : 고객명 : Sample Guest
Property : 숙소명 : 비아 인 프라임 아카사카 / VIA INN PRIME AKASAKA
Address : 주소 : 2-6-17 Akasaka, Minato-ku
객실 수 : 1
성인 수 : 2
객실 타입 : Via Inn Single Room
조식 : 조식 포함
세금 및 봉사료 포함
객실 편의시설 : 무료 Wi-Fi, 에어컨, 욕조
취소 정책 : 체크인 1일 전까지 무료 취소. 이후 1박 요금 청구.
특별 요청 : 고층 희망
1박 : USD 64.25
총 결제 금액 : USD 192.75
`
    const p = parseOtaReceiptForInvoice(text)
    expect(p.provider).toBe('agoda')
    expect(p.bookingRef).toBe('1761671537')
    expect(p.propertyNameKo).toMatch(/비아/)
    expect(p.propertyNameEn).toMatch(/VIA INN/i)
    expect(p.nights).toBe(3)
    expect(p.breakfastStatus).toBe('included')
    expect(p.taxServiceIncluded).toBe(true)
    expect(p.amenities.some((a) => /Wi-?Fi|와이파이/i.test(a))).toBe(true)
    expect(p.cancellationPolicy).toMatch(/무료 취소|1박/)
    expect(p.specialRequests).toMatch(/고층/)
    expect(p.nightRateUsd).toBe(64.25)
    expect(p.totalUsd).toBe(192.75)

    const draft = buildOtaCompanyCheckInVoucherDraft({
      parsed: p,
      amountUsd: 192.75,
      nightRateUsd: 64.25,
      rateDate: '2026-10-05',
      effectiveRateDate: '2026-10-03',
      usdKrwRate: 1350,
      amountKrw: usdAmountToKrw(192.75, 1350),
      nightRateKrw: usdAmountToKrw(64.25, 1350),
      now: new Date('2026-10-05T00:00:00.000Z'),
      logoUrl: 'https://bongtour.com/images/bongtour-logo.webp',
    })
    const htmlKo = renderOtaCompanyCheckInVoucherHtml(draft, 'ko')
    const htmlEn = renderOtaCompanyCheckInVoucherHtml(draft, 'en')
    const htmlBoth = renderOtaCompanyCheckInVoucherBilingualHtml(draft)
    expect(htmlKo).toContain('Booking ID')
    expect(htmlKo).toContain('1761671537')
    expect(htmlKo).toContain('bongtour-logo.webp')
    expect(htmlKo).toContain('VIA INN')
    expect(htmlKo).toContain('조식 포함')
    expect(htmlKo).toContain('취소정책')
    expect(htmlKo).toContain(BONGTOUR_TAX_SERVICE_INCLUDED_NOTE)
    expect(htmlEn).toContain('Check-in Voucher')
    expect(htmlEn).toContain('1761671537')
    expect(htmlEn).toContain(BONGTOUR_TAX_SERVICE_INCLUDED_NOTE_EN)
    expect(htmlEn).toContain('Cancellation policy')
    expect(htmlBoth).toContain('page-break')
    expect(htmlBoth).toContain('Check-in Voucher')
  })

  it('uses entered amount as final total (no profit markup) and states tax/service included', () => {
    expect(computeInvoiceProfitKrw({ sourceAmountKrw: 100000, mode: 'percent', percent: 15, fixedKrw: 0 })).toBe(
      0,
    )
    const draft = buildOtaCompanyInvoiceDraft({
      parsed: emptyParsed({
        provider: 'trip_com',
        bookingRef: 'T1',
        guestName: 'Kim',
        propertyOrService: 'Hotel',
        sourceAmountKrw: 100000,
        currencyHint: 'KRW',
        rawAmountMatches: ['100000'],
      }),
      sourceAmountKrw: 100000,
      profitMode: 'percent',
      profitPercent: 10,
      profitFixedKrw: 0,
      now: new Date('2026-10-05T00:00:00.000Z'),
    })
    expect(draft.profitKrw).toBe(0)
    expect(draft.totalKrw).toBe(100000)
    expect(draft.taxServiceIncludedNote).toBe(BONGTOUR_TAX_SERVICE_INCLUDED_NOTE)
    expect(renderOtaCompanyInvoiceHtml(draft)).toContain(BONGTOUR_TAX_SERVICE_INCLUDED_NOTE)
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
      parsed: emptyParsed({
        provider: 'trip_com',
        bookingRef: '998877',
        guestName: 'LEE',
        propertyOrService: 'Siem Reap Grand',
        propertyNameEn: 'Siem Reap Grand',
        checkIn: '2026-11-10',
        checkOut: '2026-11-12',
        roomType: 'Superior',
        nights: 2,
        breakfastStatus: 'not_included',
        breakfastText: '조식 불포함',
        cancellationPolicy: 'Non-refundable',
        currencyHint: 'USD',
      }),
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
    expect(draft.nightRateUsd).toBe(64.25)
    const html = renderOtaCompanyCheckInVoucherHtml(draft, 'ko')
    expect(html).toContain('체크인 바우처')
    expect(html).toContain('Siem Reap Grand')
    expect(html).toContain('173,475원')
    expect(html).toContain('조식 불포함')
    expect(html).toContain('998877')
    expect(html).toContain(BONGTOUR_TAX_SERVICE_INCLUDED_NOTE)
  })
})
