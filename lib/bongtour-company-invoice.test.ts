import { describe, expect, it } from 'vitest'
import {
  BONGTOUR_INVOICE_COMPANY,
  BONGTOUR_TAX_SERVICE_INCLUDED_NOTE,
  BONGTOUR_TAX_SERVICE_INCLUDED_NOTE_EN,
  BONGTOUR_VOUCHER_PAYMENT_METHOD,
  buildOtaCompanyAirVoucherDraft,
  buildOtaCompanyCheckInVoucherDraft,
  buildOtaCompanyInvoiceDraft,
  computeInvoiceProfitKrw,
  computeVoucherTotalUsdFromNightRate,
  extractAirVoucherPassengerNamesFromText,
  formatAirVoucherPassengerNames,
  joinOtaVoucherUploadTexts,
  otaProviderDisplayName,
  otaVoucherNoteNeedsEnglishTranslation,
  parseAdminAirlineEticketText,
  parseOtaReceiptForInvoice,
  renderOtaCompanyAirVoucherBilingualHtml,
  renderOtaCompanyAirVoucherHtml,
  renderOtaCompanyCheckInVoucherBilingualHtml,
  renderOtaCompanyCheckInVoucherHtml,
  renderOtaCompanyInvoiceHtml,
  resolveOtaVoucherNotePair,
  resolveLockedOtaAmountFromParsed,
  parseOtaPaymentDateYmd,
  normalizeOtaCompanyInvoiceFees,
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
    paymentMethod: 'CASH (Prepaid)',
    paymentDate: null,
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
    expect(htmlKo).toContain('bongtour-logo')
    expect(htmlKo).toContain('VIA INN')
    expect(htmlKo).toContain('조식 포함')
    expect(htmlKo).toContain('취소정책')
    expect(htmlKo).toContain(BONGTOUR_TAX_SERVICE_INCLUDED_NOTE)
    expect(htmlEn).toContain('Check-in Voucher')
    expect(htmlEn).toContain('1761671537')
    expect(htmlEn).toContain(BONGTOUR_TAX_SERVICE_INCLUDED_NOTE_EN)
    expect(htmlEn).toContain('CASH (Prepaid)')
    expect(htmlEn).toContain('E-commerce sales report')
    expect(htmlEn).toContain(BONGTOUR_INVOICE_COMPANY.mailOrderNoEn)
    expect(htmlEn).toContain(BONGTOUR_INVOICE_COMPANY.consultHoursEn)
    expect(htmlEn).toContain(BONGTOUR_INVOICE_COMPANY.email)
    expect(htmlEn).toContain(`Tourism business ${BONGTOUR_INVOICE_COMPANY.tourismRegistrationNo}`)
    expect(htmlEn).not.toContain('수원영통')
    expect(htmlEn).not.toContain('평일')
    expect(htmlEn).not.toMatch(/Mail-order/)
    expect(htmlEn).not.toContain('Property (local name)')
    expect(htmlEn).not.toContain('무료 Wi-Fi')
    expect(htmlEn).not.toContain('취소 정책')
    expect(htmlBoth).toContain('page-break')
    expect(htmlBoth).toContain('Check-in Voucher')
    expect(draft.paymentMethod).toBe(BONGTOUR_VOUCHER_PAYMENT_METHOD)
  })

  it('uses OTA stay amount + separate company fees; visa off forces visa fees to 0', () => {
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
      fees: {
        hotelReservationFeeKrw: 20000,
        airTicketingFeeKrw: 30000,
        travelInsuranceKrw: 15000,
        visaApplied: false,
        visaFeeKrw: 99999,
        visaAgencyFeeKrw: 88888,
      },
      now: new Date('2026-10-05T00:00:00.000Z'),
    })
    expect(draft.profitKrw).toBe(0)
    expect(draft.otaStayKrw).toBe(100000)
    expect(draft.sourceAmountKrw).toBe(100000)
    expect(draft.hotelReservationFeeKrw).toBe(20000)
    expect(draft.airTicketingFeeKrw).toBe(30000)
    expect(draft.travelInsuranceKrw).toBe(15000)
    expect(draft.visaApplied).toBe(false)
    expect(draft.visaFeeKrw).toBe(0)
    expect(draft.visaAgencyFeeKrw).toBe(0)
    expect(draft.totalKrw).toBe(165000)
    expect(draft.taxServiceIncludedNote).toBe(BONGTOUR_TAX_SERVICE_INCLUDED_NOTE)
    const html = renderOtaCompanyInvoiceHtml(draft)
    expect(html).toContain(BONGTOUR_TAX_SERVICE_INCLUDED_NOTE)
    expect(html).toContain('OTA 숙박비')
    expect(html).toContain('호텔예약수수료')
    expect(html).toContain('항공발권수수료')
    expect(html).toContain('여행자보험')
    expect(html).not.toContain('비자신청비')
    expect(html).not.toContain('비자대행수수료')
  })

  // REGRESSION-FREEZE[admin-ota-receipt-invoice]: OTA 금액 하드잠금·결제당일 — manifest
  it('locks OTA amounts from parsed text and prefers payment-day YMD', () => {
    expect(parseOtaPaymentDateYmd('결제일 : 2026년 9월 12일')).toBe('2026-09-12')
    expect(parseOtaPaymentDateYmd('Payment Date: Oct 3, 2026')).toBe('2026-10-03')
    const lockedUsd = resolveLockedOtaAmountFromParsed(
      emptyParsed({ totalUsd: 192.75, nightRateUsd: 64.25, nights: 3 }),
    )
    expect(lockedUsd?.source).toBe('totalUsd')
    expect(lockedUsd?.totalUsd).toBe(192.75)
    const lockedNight = resolveLockedOtaAmountFromParsed(
      emptyParsed({ nightRateUsd: 157.2, nights: 5 }),
    )
    expect(lockedNight?.source).toBe('nightRateTimesNights')
    expect(lockedNight?.totalUsd).toBe(786)
    const lockedKrw = resolveLockedOtaAmountFromParsed(emptyParsed({ sourceAmountKrw: 450000 }))
    expect(lockedKrw?.source).toBe('sourceAmountKrw')
    expect(lockedKrw?.amountKrwDirect).toBe(450000)
    expect(resolveLockedOtaAmountFromParsed(emptyParsed())).toBeNull()
    expect(normalizeOtaCompanyInvoiceFees({ visaApplied: true, visaFeeKrw: 50000 }).visaFeeKrw).toBe(
      50000,
    )
  })

  it('invoice with visaApplied adds visa fee lines; voucher draft has no fee fields', () => {
    const inv = buildOtaCompanyInvoiceDraft({
      parsed: emptyParsed({ bookingRef: 'V1', sourceAmountKrw: 200000 }),
      sourceAmountKrw: 200000,
      fees: {
        hotelReservationFeeKrw: 10000,
        visaApplied: true,
        visaFeeKrw: 80000,
        visaAgencyFeeKrw: 20000,
      },
      now: new Date('2026-10-05T00:00:00.000Z'),
    })
    expect(inv.totalKrw).toBe(310000)
    const invHtml = renderOtaCompanyInvoiceHtml(inv)
    expect(invHtml).toContain('비자신청비')
    expect(invHtml).toContain('비자대행수수료')

    const voucher = buildOtaCompanyCheckInVoucherDraft({
      parsed: emptyParsed({ bookingRef: 'V1', nights: 2 }),
      amountUsd: 100,
      rateDate: '2026-09-12',
      effectiveRateDate: '2026-09-12',
      usdKrwRate: 1350,
      amountKrw: 135000,
      now: new Date('2026-10-05T00:00:00.000Z'),
    })
    expect(voucher).not.toHaveProperty('hotelReservationFeeKrw')
    const vHtml = renderOtaCompanyCheckInVoucherHtml(voucher, 'ko')
    expect(vHtml).toContain('결제당일 환율')
    expect(vHtml).not.toContain('호텔예약수수료')
    expect(vHtml).not.toContain('항공발권수수료')
  })

  // REGRESSION-FREEZE[admin-ota-receipt-invoice]: 체크인 바우처 + USD 입력일 환율 — manifest
  it('builds company check-in voucher from USD using payment-day FX', () => {
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
    expect(html).toContain('bongtour-logo')
    expect(html).toContain('Mercure ICON')
    expect(html).toContain('CASH (Prepaid)')
    expect(html).toContain('E-commerce sales report')
    expect(html).toContain(BONGTOUR_INVOICE_COMPANY.mailOrderNoEn)
    expect(html).toContain(BONGTOUR_INVOICE_COMPANY.consultHoursEn)
    expect(html).toContain(BONGTOUR_INVOICE_COMPANY.email)
    expect(html).not.toMatch(/Mail-order 2024-수원영통/)
    expect(draft.paymentMethod).toBe('CASH (Prepaid)')
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

  // REGRESSION-FREEZE[admin-ota-receipt-invoice]: 1박×박수=총액 — manifest
  it('computes voucher total from night rate × nights', () => {
    expect(computeVoucherTotalUsdFromNightRate(157.2, 5)).toBe(786)
    expect(computeVoucherTotalUsdFromNightRate(64.25, 2)).toBe(128.5)
    expect(computeVoucherTotalUsdFromNightRate(null, 5)).toBeNull()
    expect(computeVoucherTotalUsdFromNightRate(100, 0)).toBeNull()

    const draft = buildOtaCompanyCheckInVoucherDraft({
      parsed: emptyParsed({
        provider: 'trip_com',
        bookingRef: '2610130768',
        nights: 5,
        roomTypeKo: '클래식 트윈룸',
        roomTypeEn: 'Classic Twin Room',
        checkInKo: '2026년 10월 13일 15:00 이후',
        checkInEn: 'Oct 13, 2026 Tue After 3:00 PM',
        checkOutKo: '2026년 10월 18일 11:00 이전',
        checkOutEn: 'Oct 18, 2026 Sun Before 11:00 AM',
      }),
      amountUsd: computeVoucherTotalUsdFromNightRate(157.2, 5)!,
      nightRateUsd: 157.2,
      rateDate: '2026-10-05',
      effectiveRateDate: '2026-10-03',
      usdKrwRate: 1350,
      amountKrw: usdAmountToKrw(786, 1350),
      now: new Date('2026-10-05T00:00:00.000Z'),
    })
    expect(draft.amountUsd).toBe(786)
    expect(draft.nightRateUsd).toBe(157.2)
    expect(draft.roomTypeKo).toBe('클래식 트윈룸')
    expect(draft.roomTypeEn).toBe('Classic Twin Room')
    expect(draft.checkInKo).toMatch(/2026년 10월 13일/)
    expect(draft.checkInEn).toMatch(/Oct 13/)
    const html = renderOtaCompanyCheckInVoucherBilingualHtml(draft)
    expect(html).toContain('클래식 트윈룸')
    expect(html).toContain('Classic Twin Room')
    expect(html).toContain('2026년 10월 13일')
    expect(html).toContain('Oct 13, 2026')
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
    expect(p.paymentMethod).toBe('CASH (Prepaid)')

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
    const htmlEn = renderOtaCompanyCheckInVoucherHtml(draft, 'en')
    // 로고 워드마크 + 문서 종류만 — 브랜드명 헤더 반복 없음
    expect(html).toContain('체크인 바우처')
    expect(html).toContain('Check-in Voucher')
    expect(html).not.toMatch(/class="brand"/)
    expect(htmlEn).not.toMatch(/<h1>BongTour Check-in Voucher<\/h1>/)
    expect(html).not.toMatch(/<h1>봉투어 체크인 바우처<\/h1>/)
    expect(html).toContain('page-break')
    expect(html).toContain('2610130768')
    expect(html).toContain('클래식')
    expect(html).toContain('Classic Twin')
    expect(html).toContain('CASH (Prepaid)')
    expect(html).toContain(BONGTOUR_INVOICE_COMPANY.email)
    expect(html).not.toContain('Prepay Online')
    // EN page must not leak Korean amenities / inclusions / local name
    expect(htmlEn).toContain('Toothbrushes')
    expect(htmlEn).toContain('Service charge')
    expect(htmlEn).toContain('VAT')
    expect(htmlEn).not.toContain('칫솔')
    expect(htmlEn).not.toContain('부가가치세')
    expect(htmlEn).not.toContain('머큐어')
    expect(htmlEn).not.toContain('Property (local name)')
    expect(htmlEn).toMatch(/data:image\/|bongtour-logo/)
  })

  // REGRESSION-FREEZE[admin-ota-foreign-tax-note]: 해외숙박 현지세·국내부가세 불가 — manifest
  it('states foreign local tax included and no Korean VAT refund/invoice', () => {
    expect(BONGTOUR_TAX_SERVICE_INCLUDED_NOTE).toMatch(/현지 세금/)
    expect(BONGTOUR_TAX_SERVICE_INCLUDED_NOTE).toMatch(/국내 부가가치세 환급·세금계산서/)
    expect(BONGTOUR_TAX_SERVICE_INCLUDED_NOTE).not.toMatch(/세금\(부가가치세 등\)/)
    expect(BONGTOUR_TAX_SERVICE_INCLUDED_NOTE_EN).toMatch(/local taxes as charged by the property\/OTA/)
    expect(BONGTOUR_TAX_SERVICE_INCLUDED_NOTE_EN).toMatch(/Korean VAT refund and tax invoice/)
    expect(BONGTOUR_TAX_SERVICE_INCLUDED_NOTE_EN).not.toMatch(/including VAT\)\./)
  })

  // REGRESSION-FREEZE[admin-ota-voucher-note-en]: 비고 한→영 + OTA명 — manifest
  it('puts OTA provider next to Booking ID and translates note for EN voucher', () => {
    expect(otaProviderDisplayName('trip_com')).toBe('Trip.com')
    expect(otaProviderDisplayName('agoda')).toBe('Agoda')
    expect(otaVoucherNoteNeedsEnglishTranslation('레이트 체크인 요청')).toBe(true)
    expect(otaVoucherNoteNeedsEnglishTranslation('Late check-in')).toBe(false)
    expect(resolveOtaVoucherNotePair({ note: 'Late check-in' }).noteEn).toBe('Late check-in')
    expect(resolveOtaVoucherNotePair({ note: '레이트 체크인' }).noteEn).toBeNull()
    expect(
      resolveOtaVoucherNotePair({
        note: '레이트 체크인',
        noteEnOverride: 'Late check-in requested',
      }).noteEn,
    ).toBe('Late check-in requested')

    const draft = buildOtaCompanyCheckInVoucherDraft({
      parsed: emptyParsed({
        provider: 'trip_com',
        bookingRef: '2610130768',
        nights: 2,
      }),
      amountUsd: 200,
      nightRateUsd: 100,
      rateDate: '2026-10-05',
      effectiveRateDate: '2026-10-05',
      usdKrwRate: 1350,
      amountKrw: usdAmountToKrw(200, 1350),
      note: '레이트 체크인 요청',
      noteEnOverride: 'Late check-in requested',
      now: new Date('2026-10-05T00:00:00.000Z'),
    })
    expect(draft.note).toBe('레이트 체크인 요청')
    expect(draft.noteEn).toBe('Late check-in requested')
    const htmlKo = renderOtaCompanyCheckInVoucherHtml(draft, 'ko')
    const htmlEn = renderOtaCompanyCheckInVoucherHtml(draft, 'en')
    expect(htmlKo).toContain('OTA (예약처)')
    expect(htmlKo).toContain('Trip.com')
    expect(htmlKo).toContain('레이트 체크인 요청')
    expect(htmlEn).toContain('OTA')
    expect(htmlEn).toContain('Trip.com')
    expect(htmlEn).toContain('Late check-in requested')
    expect(htmlEn).not.toContain('레이트 체크인 요청')
  })
})

// REGRESSION-FREEZE[admin-ota-air-voucher]: 항공권 바우처 — 승객명·OTA 금지 — manifest
describe('admin-ota-air-voucher', () => {
  it('formatAirVoucherPassengerNames keeps 1 and 8 names as-is', () => {
    expect(formatAirVoucherPassengerNames(['KIM/MINSU'])).toBe('KIM/MINSU')
    const eight = [
      'KIM/A',
      'KIM/B',
      'LEE/C',
      'PARK/D',
      'CHOI/E',
      'JUNG/F',
      'HAN/G',
      'YOON/H',
    ]
    expect(formatAirVoucherPassengerNames(eight)).toBe(eight.join(', '))
  })

  it('guestNameOverride from hotel voucher wins over e-ticket passengers', () => {
    const draft = buildOtaCompanyAirVoucherDraft({
      parsed: {
        passengers: ['ETICKET/ONLY'],
        pnr: 'ABC123',
        ticketNumber: '1801234567890',
        bookingRef: 'ABC123',
        flights: [
          {
            flightNo: 'KE123',
            airline: 'KOREAN AIR',
            depAirport: 'ICN',
            arrAirport: 'NRT',
            depAt: null,
            arrAt: null,
            cabinClass: null,
            status: null,
          },
        ],
      },
      guestNameOverride: 'KIM/MINSU, LEE/JIYOON',
      now: new Date('2026-10-05T00:00:00.000Z'),
    })
    expect(draft.documentKind).toBe('air_voucher')
    expect(draft.guestName).toBe('KIM/MINSU, LEE/JIYOON')
  })

  it('air voucher HTML has passengers and no OTA / Trip.com / Agoda label', () => {
    const eight = [
      'KIM/A',
      'KIM/B',
      'LEE/C',
      'PARK/D',
      'CHOI/E',
      'JUNG/F',
      'HAN/G',
      'YOON/H',
    ]
    const draft = buildOtaCompanyAirVoucherDraft({
      parsed: {
        passengers: eight,
        pnr: 'PNR888',
        ticketNumber: '1809999888877',
        bookingRef: 'PNR888',
        flights: [
          {
            flightNo: 'OZ701',
            airline: 'ASIANA AIRLINES',
            depAirport: 'ICN',
            arrAirport: 'NRT',
            depAt: '2026-07-29T07:35:00',
            arrAt: '2026-07-29T09:50:00',
            cabinClass: 'Y',
            status: 'OK',
          },
        ],
      },
      now: new Date('2026-10-05T00:00:00.000Z'),
    })
    expect(draft.guestName).toBe(eight.join(', '))
    const html = renderOtaCompanyAirVoucherBilingualHtml(draft)
    const htmlKo = renderOtaCompanyAirVoucherHtml(draft, 'ko')
    expect(html).toContain('항공권 바우처')
    expect(html).toContain('Flight Voucher')
    expect(html).toContain('KIM/A, KIM/B, LEE/C, PARK/D, CHOI/E, JUNG/F, HAN/G, YOON/H')
    expect(html).toContain('OZ701')
    expect(html).toContain('PNR888')
    expect(html).not.toContain('OTA (예약처)')
    expect(html).not.toContain('Trip.com')
    expect(html).not.toContain('Agoda')
    expect(htmlKo).not.toMatch(/\bOTA\b/)
  })

  it('parseAdminAirlineEticketText reads passenger line', () => {
    const parsed = parseAdminAirlineEticketText(`
Passenger Name KIM/MINSU, LEE/JIYOON
Booking Reference ABCDE1
eTicket number: 1801234567890
KE 123 ICN NRT 01JAN26 10:00
`)
    expect(parsed.passengers.length).toBeGreaterThanOrEqual(1)
    expect(formatAirVoucherPassengerNames(parsed.passengers)).toMatch(/KIM/)
  })

  it('extracts passengers when name is on the next OCR line', () => {
    const names = extractAirVoucherPassengerNamesFromText(`
Passenger Name
KIM/MINSU MR
LEE/JIYOON MS
Booking Reference ABCDE1
`)
    expect(names).toEqual(['KIM/MINSU', 'LEE/JIYOON'])
    const parsed = parseAdminAirlineEticketText(`
Passenger Name
PARK/JUNHO
PNR: ZZ9999
OZ 701 ICN NRT 29JUL26 07:35
`)
    expect(parsed.passengers).toContain('PARK/JUNHO')
  })

  it('extracts Korean label and LAST, FIRST title forms', () => {
    expect(extractAirVoucherPassengerNamesFromText('승객 성명: 홍길동')).toEqual(['홍길동'])
    expect(
      extractAirVoucherPassengerNamesFromText(`
Traveler Name
KIM, MIN SU MR
`),
    ).toEqual(['KIM/MIN SU'])
    expect(extractAirVoucherPassengerNamesFromText('KIM, MIN SU MR\n')).toEqual(['KIM/MIN SU'])
  })
})
