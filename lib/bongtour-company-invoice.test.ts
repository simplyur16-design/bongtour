import { describe, expect, it } from 'vitest'
import {
  BONGTOUR_INVOICE_COMPANY,
  BONGTOUR_TAX_SERVICE_INCLUDED_NOTE,
  BONGTOUR_TAX_SERVICE_INCLUDED_NOTE_EN,
  BONGTOUR_VOUCHER_PAYMENT_METHOD,
  buildOtaCompanyCheckInVoucherDraft,
  buildOtaCompanyInvoiceDraft,
  computeInvoiceProfitKrw,
  joinOtaVoucherUploadTexts,
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
    hotelConfirmationRef: null,
    guestName: null,
    propertyOrService: null,
    propertyNameKo: null,
    propertyNameEn: null,
    address: null,
    addressKo: null,
    addressEn: null,
    phone: null,
    checkIn: null,
    checkOut: null,
    checkInKo: null,
    checkInEn: null,
    checkOutKo: null,
    checkOutEn: null,
    checkInTime: null,
    checkOutTime: null,
    roomType: null,
    roomTypeKo: null,
    roomTypeEn: null,
    bedType: null,
    bedTypeKo: null,
    bedTypeEn: null,
    rooms: null,
    guestsAdults: null,
    guestsChildren: null,
    nights: null,
    breakfastStatus: 'unknown',
    breakfastText: null,
    breakfastTextKo: null,
    breakfastTextEn: null,
    taxServiceText: null,
    taxServiceIncluded: null,
    amenities: [],
    amenitiesKo: [],
    amenitiesEn: [],
    inclusionsText: null,
    inclusionsTextKo: null,
    inclusionsTextEn: null,
    exclusionsText: null,
    exclusionsTextKo: null,
    exclusionsTextEn: null,
    cancellationPolicy: null,
    cancellationPolicyKo: null,
    cancellationPolicyEn: null,
    specialRequests: null,
    paymentMethod: 'CASH',
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
    expect(htmlEn).toContain('CASH')
    expect(htmlEn).toContain('E-commerce sales report')
    expect(htmlEn).toContain(BONGTOUR_INVOICE_COMPANY.mailOrderNoEn)
    expect(htmlEn).toContain(BONGTOUR_INVOICE_COMPANY.consultHoursEn)
    expect(htmlEn).toContain(BONGTOUR_INVOICE_COMPANY.email)
    expect(htmlEn).toContain(`Tourism business ${BONGTOUR_INVOICE_COMPANY.tourismRegistrationNo}`)
    expect(htmlEn).not.toContain('수원영통')
    expect(htmlEn).not.toContain('평일')
    expect(htmlEn).not.toMatch(/Mail-order/)
    expect(htmlBoth).toContain('page-break')
    expect(htmlBoth).toContain('Check-in Voucher')
    expect(draft.paymentMethod).toBe(BONGTOUR_VOUCHER_PAYMENT_METHOD)
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
        breakfastTextKo: '조식 불포함',
        breakfastTextEn: 'Breakfast not included',
        cancellationPolicy: 'Non-refundable',
        cancellationPolicyKo: '환불 불가',
        cancellationPolicyEn: 'Non-refundable',
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

  // REGRESSION-FREEZE[admin-ota-receipt-invoice]: 실바우처 OCR 라벨 파싱 — manifest
  it('parses Gemini OCR labels from Mercure/Trip-style English voucher', () => {
    const text = `Booking ID : 2610130768
예약 번호 : 1400829634320451
고객명 : SEOYOUNG JEONG
숙소명 : Mercure ICON Singapore City Centre
Property : Mercure ICON Singapore City Centre
주소 : 8 Club Street, #01-03, 069472, Singapore
전화 : +65-67680008
체크인 : Oct 13, 2026 Tue After 3:00 PM
체크아웃 : Oct 18, 2026 Sun Before 11:00 AM
객실 타입 : Classic Twin Room
침대 타입 : 2 single beds
객실 수 : 1
성인 수 : 2
조식 : 불포함
Breakfast : not included (No meals included)
객실 편의시설 : Toothbrushes, Toothpaste, Body wash, Shampoo, Conditioner, Soap, Shower cap, Private bathroom, Private toilet, Hair dryer, Shower, Bath towels, Hot water (24 hours), Slippers
취소 정책 : You'll be charged the cancellation fee if you don't check in.
결제 방법 : Prepay Online
세금 및 봉사료 포함
총 결제 금액 : KRW 1,062,752
Nights : 5박`
    const p = parseOtaReceiptForInvoice(text)
    expect(p.bookingRef).toBe('2610130768')
    expect(p.hotelConfirmationRef).toBe('1400829634320451')
    expect(p.provider).toBe('trip_com')
    expect(p.nights).toBe(5)
    expect(p.breakfastStatus).toBe('not_included')
    expect(p.cancellationPolicy).toMatch(/cancellation fee/i)
    expect(p.amenities).toContain('Toothbrushes')
    expect(p.amenities.join(' ')).not.toMatch(/취소|결제|부가가치세/)
    expect(p.sourceAmountKrw).toBe(1062752)
    expect(p.propertyNameEn).toMatch(/Mercure ICON/i)

    const draft = buildOtaCompanyCheckInVoucherDraft({
      parsed: p,
      amountUsd: 786,
      nightRateUsd: 157.2,
      rateDate: '2026-10-05',
      effectiveRateDate: '2026-10-03',
      usdKrwRate: 1350,
      amountKrw: usdAmountToKrw(786, 1350),
      logoUrl: 'https://bongtour.com/images/bongtour-logo.webp',
      now: new Date('2026-10-05T00:00:00.000Z'),
    })
    const html = renderOtaCompanyCheckInVoucherBilingualHtml(draft)
    expect(html).toContain('2610130768')
    expect(html).toContain('1400829634320451')
    expect(html).toContain('bongtour-logo.webp')
    expect(html).toContain('Mercure ICON')
    expect(html).toContain('CASH')
    expect(html).toContain('E-commerce sales report')
    expect(html).toContain(BONGTOUR_INVOICE_COMPANY.mailOrderNoEn)
    expect(html).toContain(BONGTOUR_INVOICE_COMPANY.consultHoursEn)
    expect(html).toContain(BONGTOUR_INVOICE_COMPANY.email)
    expect(html).not.toMatch(/Mail-order 2024-수원영통/)
    expect(draft.paymentMethod).toBe('CASH')
    expect(draft.exclusionsTextKo).toBeNull()
    expect(draft.exclusionsTextEn).toBeNull()
  })

  it('parses Korean OCR labels with bilingual hotel and tax breakdown', () => {
    const text = `Booking ID : 1400829634320451
예약 번호 : 1400829634320451
고객명 : JEONG SEOYOUNG
숙소명 : 머큐어 아이콘 싱가포르 시티 센터 / Mercure ICON Singapore City Centre
체크인 : 2026년 10월 13일 15:00 이후
체크아웃 : 2026년 10월 18일 11:00 이전
객실 타입 : 클래식 트윈룸
조식 : 불포함
객실 편의시설 : 칫솔, 치약, 바디워시, 샴푸
포함사항 : 서비스 요금 88,633원, 부가가치세 87,746원
취소 정책 : 체크인하지 않으실 경우, 취소 수수료가 청구됩니다.
결제 방법 : 온라인 사전 결제 (Prepay Online)
세금 및 봉사료 포함
총 결제 금액 : KRW 1,062,752
Nights : 5박`
    const p = parseOtaReceiptForInvoice(text)
    expect(p.bookingRef).toBe('1400829634320451')
    expect(p.hotelConfirmationRef).toBeNull()
    expect(p.propertyNameKo).toMatch(/머큐어/)
    expect(p.propertyNameEn).toMatch(/Mercure/i)
    expect(p.inclusionsText).toMatch(/부가가치세/)
    expect(p.cancellationPolicy).toMatch(/취소 수수료/)
    expect(p.amenities).toEqual(expect.arrayContaining(['칫솔', '치약']))
  })

  // REGRESSION-FREEZE[admin-ota-receipt-invoice]: 한글+영문 바우처 한 세트 병합 — manifest
  it('merges Korean+English voucher OCR set into one bilingual draft with visa Booking ID', () => {
    const ko = `Booking ID : 1400829634320451
예약 번호 : 1400829634320451
고객명 : JEONG SEOYOUNG
숙소명 : 머큐어 아이콘 싱가포르 시티 센터 / Mercure ICON Singapore City Centre
주소 : 싱가포르 8 Club Street, #01-03, 069472
체크인 : 2026년 10월 13일 15:00 이후
체크아웃 : 2026년 10월 18일 11:00 이전
객실 타입 : 클래식 트윈룸
침대 타입 : 싱글 침대 2개
조식 : 불포함
객실 편의시설 : 칫솔, 치약, 바디워시, 샴푸
포함사항 : 서비스 요금 88,633원, 부가가치세 87,746원
취소 정책 : 체크인하지 않으실 경우, 취소 수수료가 청구됩니다.
결제 방법 : 온라인 사전 결제 (Prepay Online)
세금 및 봉사료 포함
총 결제 금액 : KRW 1,062,752
Nights : 5박`
    const en = `Booking ID : 2610130768
예약 번호 : 1400829634320451
고객명 : SEOYOUNG JEONG
숙소명 : Mercure ICON Singapore City Centre
Address : 8 Club Street, #01-03, 069472, Singapore
체크인 : Oct 13, 2026 Tue After 3:00 PM
체크아웃 : Oct 18, 2026 Sun Before 11:00 AM
Room Type : Classic Twin Room
침대 타입 : 2 single beds
Breakfast : not included (No meals included)
객실 편의시설 : Toothbrushes, Toothpaste, Body wash, Shampoo
취소 정책 : You'll be charged the cancellation fee if you don't check in.
결제 방법 : Prepay Online
세금 및 봉사료 포함
총 결제 금액 : KRW 1,062,752
Nights : 5박`
    const merged = joinOtaVoucherUploadTexts([ko, en])
    const p = parseOtaReceiptForInvoice(merged)
    expect(p.bookingRef).toBe('2610130768')
    expect(p.hotelConfirmationRef).toBe('1400829634320451')
    expect(p.propertyNameKo).toMatch(/머큐어/)
    expect(p.propertyNameEn).toMatch(/Mercure/i)
    expect(p.roomTypeKo).toMatch(/클래식|트윈/)
    expect(p.roomTypeEn).toMatch(/Classic Twin/i)
    expect(p.checkInKo).toMatch(/2026년 10월 13일/)
    expect(p.checkInEn).toMatch(/Oct 13/)
    expect(p.breakfastTextKo).toMatch(/불포함/)
    expect(p.breakfastTextEn).toMatch(/not included/i)
    expect(p.amenitiesKo).toEqual(expect.arrayContaining(['칫솔']))
    expect(p.amenitiesEn).toEqual(expect.arrayContaining(['Toothbrushes']))
    expect(p.inclusionsTextKo).toMatch(/부가가치세/)
    expect(p.exclusionsTextKo).toBeNull()
    expect(p.paymentMethod).toBe('CASH')

    const draft = buildOtaCompanyCheckInVoucherDraft({
      parsed: p,
      amountUsd: 786,
      nightRateUsd: 157.2,
      rateDate: '2026-10-05',
      effectiveRateDate: '2026-10-03',
      usdKrwRate: 1350,
      amountKrw: usdAmountToKrw(786, 1350),
      logoUrl: 'https://bongtour.com/images/bongtour-logo.webp',
      now: new Date('2026-10-05T00:00:00.000Z'),
    })
    const html = renderOtaCompanyCheckInVoucherBilingualHtml(draft)
    expect(html).toContain('봉투어 체크인 바우처')
    expect(html).toContain('Check-in Voucher')
    expect(html).toContain('page-break')
    expect(html).toContain('2610130768')
    expect(html).toContain('클래식')
    expect(html).toContain('Classic Twin')
    expect(html).toContain('CASH')
    expect(html).toContain(BONGTOUR_INVOICE_COMPANY.email)
    expect(html).not.toContain('Prepay Online')
  })
})
