/**
 * 봉투어 회사 인보이스·체크인 바우처 — OTA(Trip.com/Agoda) 영수증 기반 발행 SSOT.
 * PDF/본문에서 예약·숙소(한/영)·조식·세금포함·편의시설을 추출하고,
 * 입력 금액(1박·총액) = 최종 합계(이익 가산 없음). 서비스요금·세금은 포함 문구로 명시.
 * REGRESSION-FREEZE[admin-ota-receipt-invoice]: OTA 영수증→회사 인보이스 — manifest
 */

import { COMPANY_FOOTER } from '@/lib/company-footer'
import { enrichHotelBilingual } from '@/lib/simplyur/trip-inbox/bilingual-hotel'
import type { TripHotelSegmentPayload } from '@/lib/simplyur/trip-inbox/types'

export const BONGTOUR_INVOICE_COMPANY = {
  legalName: '봉투어',
  brandName: 'BongTour',
  businessRegistrationNo: COMPANY_FOOTER.bizRegNo,
  /** 관광사업자등록 — site SSOT `LEGAL_ENTITY.tourismRegNo` */
  tourismRegistrationNo: '2024-0033',
  /** 통신판매업 신고번호 (메일주문 ≠ 이메일) */
  mailOrderNo: '2024-수원영통-1596',
  mailOrderNoEn: '2024-Suwon Yeongtong-1596',
  phone: COMPANY_FOOTER.phoneDisplay,
  email: COMPANY_FOOTER.emailDisplay,
  consultHours: '평일 08:00–19:00',
  consultHoursEn: 'Weekdays 08:00–19:00',
  address: '',
} as const

/** 호텔 제시용 회사 바우처 결제 표기 (고객→회사 결제 완료) */
export const BONGTOUR_VOUCHER_PAYMENT_METHOD = 'CASH' as const

/** 금액에 항상 붙이는 포함 고지 (이익율 재계산 대신 포함 명시) */
export const BONGTOUR_TAX_SERVICE_INCLUDED_NOTE =
  '본 금액에는 서비스요금 및 세금(부가가치세 등)이 포함되어 있습니다.'

export type OtaInvoiceProvider = 'trip_com' | 'agoda' | 'unknown'

export type OtaInvoiceProfitMode = 'percent' | 'fixed'

export type OtaAdminDocumentKind = 'invoice' | 'voucher'

export type OtaBreakfastStatus = 'included' | 'not_included' | 'unknown'

export type OtaReceiptParsedAmount = {
  provider: OtaInvoiceProvider
  /** Booking ID / 예약번호 (바우처 핵심) */
  bookingRef: string | null
  /** Booking ID와 다른 호텔/보조 확인번호 */
  hotelConfirmationRef: string | null
  guestName: string | null
  /** 원문 숙소명 (한/영 혼합 가능) */
  propertyOrService: string | null
  propertyNameKo: string | null
  propertyNameEn: string | null
  address: string | null
  addressKo: string | null
  addressEn: string | null
  phone: string | null
  checkIn: string | null
  checkOut: string | null
  checkInKo: string | null
  checkInEn: string | null
  checkOutKo: string | null
  checkOutEn: string | null
  checkInTime: string | null
  checkOutTime: string | null
  roomType: string | null
  roomTypeKo: string | null
  roomTypeEn: string | null
  bedType: string | null
  bedTypeKo: string | null
  bedTypeEn: string | null
  rooms: number | null
  guestsAdults: number | null
  guestsChildren: number | null
  nights: number | null
  breakfastStatus: OtaBreakfastStatus
  breakfastText: string | null
  breakfastTextKo: string | null
  breakfastTextEn: string | null
  /** 원문에서 읽은 세금·봉사료 포함 문구 */
  taxServiceText: string | null
  taxServiceIncluded: boolean | null
  amenities: string[]
  amenitiesKo: string[]
  amenitiesEn: string[]
  inclusionsText: string | null
  inclusionsTextKo: string | null
  inclusionsTextEn: string | null
  exclusionsText: string | null
  exclusionsTextKo: string | null
  exclusionsTextEn: string | null
  cancellationPolicy: string | null
  cancellationPolicyKo: string | null
  cancellationPolicyEn: string | null
  specialRequests: string | null
  paymentMethod: string | null
  /** 영수증에서 읽은 공급가(원). 파싱 실패 시 null */
  sourceAmountKrw: number | null
  /** 원문 1박 요금(USD) — 있으면 */
  nightRateUsd: number | null
  /** 원문 총액(USD) — 있으면 */
  totalUsd: number | null
  currencyHint: string | null
  rawAmountMatches: string[]
}

export type OtaCompanyInvoiceDraft = {
  invoiceNumber: string
  issuedAtIso: string
  provider: OtaInvoiceProvider
  bookingRef: string | null
  guestName: string | null
  serviceDescription: string
  sourceAmountKrw: number
  sourceAmountUsd: number | null
  rateDate: string | null
  usdKrwRate: number | null
  profitMode: OtaInvoiceProfitMode
  profitPercent: number
  profitFixedKrw: number
  profitKrw: number
  totalKrw: number
  taxServiceIncludedNote: string
  company: typeof BONGTOUR_INVOICE_COMPANY
  note: string
}

export type OtaVoucherLocale = 'ko' | 'en'

export type OtaCompanyCheckInVoucherDraft = {
  voucherNumber: string
  issuedAtIso: string
  provider: OtaInvoiceProvider
  /** Booking ID — 바우처에 정확히 표기 */
  bookingRef: string | null
  hotelConfirmationRef: string | null
  guestName: string | null
  propertyName: string
  propertyNameKo: string | null
  propertyNameEn: string | null
  addressKo: string | null
  addressEn: string | null
  phone: string | null
  roomTypeKo: string | null
  roomTypeEn: string | null
  bedTypeKo: string | null
  bedTypeEn: string | null
  rooms: number | null
  guestsAdults: number | null
  guestsChildren: number | null
  checkInKo: string | null
  checkInEn: string | null
  checkOutKo: string | null
  checkOutEn: string | null
  checkInTime: string | null
  checkOutTime: string | null
  nights: number | null
  breakfastStatus: OtaBreakfastStatus
  breakfastTextKo: string | null
  breakfastTextEn: string | null
  taxServiceText: string | null
  taxServiceIncludedNote: string
  taxServiceIncludedNoteEn: string
  amenitiesKo: string[]
  amenitiesEn: string[]
  inclusionsTextKo: string | null
  inclusionsTextEn: string | null
  exclusionsTextKo: string | null
  exclusionsTextEn: string | null
  cancellationPolicyKo: string | null
  cancellationPolicyEn: string | null
  specialRequests: string | null
  /** 항상 CASH (호텔 제시용) */
  paymentMethod: typeof BONGTOUR_VOUCHER_PAYMENT_METHOD
  /** 표기 1박 금액(USD) */
  nightRateUsd: number | null
  nightRateKrw: number | null
  /** 표기 총액(USD) */
  amountUsd: number
  rateDate: string
  effectiveRateDate: string
  usdKrwRate: number
  amountKrw: number
  logoUrl: string
  company: typeof BONGTOUR_INVOICE_COMPANY
  note: string
}

export const BONGTOUR_TAX_SERVICE_INCLUDED_NOTE_EN =
  'This amount includes service charges and applicable taxes (including VAT).'

export const BONGTOUR_LOGO_PATH = '/images/bongtour-logo.webp'

export function resolveBongtourLogoUrl(baseUrl?: string | null): string {
  const base = (baseUrl || process.env.NEXT_PUBLIC_SITE_URL || 'https://bongtour.com').replace(
    /\/$/,
    '',
  )
  return `${base}${BONGTOUR_LOGO_PATH}`
}

function detectProvider(text: string): OtaInvoiceProvider {
  const lower = text.toLowerCase()
  if (lower.includes('agoda') || text.includes('아고다')) return 'agoda'
  if (
    lower.includes('trip.com') ||
    lower.includes('ctrip') ||
    text.includes('트립닷컴') ||
    /prepay\s*online/i.test(text)
  ) {
    return 'trip_com'
  }
  return 'unknown'
}

function parseMoneyToken(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.]/g, '')
  if (!cleaned) return null
  const n = Number(cleaned)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n)
}

function parseUsdToken(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.]/g, '')
  if (!cleaned) return null
  const n = Number(cleaned)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n * 100) / 100
}

function cleanLine(s: string | null | undefined): string | null {
  if (!s) return null
  const t = s.replace(/\s+/g, ' ').trim()
  return t || null
}

function nightsFromDates(checkIn: string | null, checkOut: string | null): number | null {
  if (!checkIn || !checkOut) return null
  const parseYmd = (raw: string): Date | null => {
    const iso = raw.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/)
    if (iso) return new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])))
    const ko = raw.match(/(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/)
    if (ko) return new Date(Date.UTC(Number(ko[1]), Number(ko[2]) - 1, Number(ko[3])))
    return null
  }
  const a = parseYmd(checkIn)
  const b = parseYmd(checkOut)
  if (!a || !b) return null
  const diff = Math.round((b.getTime() - a.getTime()) / 86_400_000)
  return diff > 0 && diff < 120 ? diff : null
}

function splitPropertyNames(raw: string | null): {
  propertyOrService: string | null
  propertyNameKo: string | null
  propertyNameEn: string | null
} {
  if (!raw) return { propertyOrService: null, propertyNameKo: null, propertyNameEn: null }
  const stub: TripHotelSegmentPayload = {
    type: 'hotel',
    property_name: raw,
    property_name_user: null,
    property_name_dest: null,
    address: null,
    address_user: null,
    address_dest: null,
    dest_lang: null,
    phone: null,
    check_in_at: null,
    check_out_at: null,
    check_in_window: null,
    rooms: null,
    room_type: null,
    guests_adults: null,
    guests_children: null,
    pay_at: null,
    booking_ref: null,
    travelers: [],
  }
  const enriched = enrichHotelBilingual(stub)
  const en = cleanLine(enriched.property_name_user)
  const ko = cleanLine(enriched.property_name_dest)
  return {
    propertyOrService: cleanLine(raw),
    propertyNameKo: ko,
    propertyNameEn: en,
  }
}

function parseBreakfast(text: string): {
  status: OtaBreakfastStatus
  text: string | null
  textKo: string | null
  textEn: string | null
} {
  const lineKo = parseLabeledLine(text, [/조식/, /아침\s*식사/])
  const lineEn = parseLabeledLine(text, [/Breakfast/i])
  const line = lineKo || lineEn

  const blob = `${lineKo ?? ''} ${lineEn ?? ''} ${text}`
  let status: OtaBreakfastStatus = 'unknown'
  if (
    /조식\s*(?:불포함|없음|미포함)|breakfast\s*(?:not\s*included|excluded)|room\s*only|숙박만|no\s*meals?/i.test(
      blob,
    )
  ) {
    status = 'not_included'
  } else if (
    /조식\s*포함|무료\s*조식|breakfast\s*(?:included|inclusive)|free\s*breakfast|조식\s*제공/i.test(blob)
  ) {
    status = 'included'
  } else if (line) {
    if (/불포함|없음|not\s*included|room\s*only|no\s*meals?/i.test(line)) status = 'not_included'
    else if (/포함|included|free|제공/i.test(line)) status = 'included'
  }

  const textKo =
    lineKo ||
    (status === 'included' ? '조식 포함' : status === 'not_included' ? '조식 불포함' : null)
  const textEn =
    lineEn ||
    (status === 'included'
      ? 'Breakfast included'
      : status === 'not_included'
        ? 'Breakfast not included'
        : null)

  return { status, text: textKo || textEn, textKo, textEn }
}

function parseTaxService(text: string): { included: boolean | null; text: string | null } {
  const line =
    cleanLine(
      text.match(
        /((?:세금|부가가치세|VAT|Tax(?:es)?|Service\s*charge|봉사료|서비스\s*요금)[^\n]{0,80}(?:포함|included|inclusive)[^\n]*)/i,
      )?.[1],
    ) ||
    cleanLine(
      text.match(
        /((?:Inclusive\s*of|Includes?)\s*(?:all\s*)?(?:taxes?|VAT|service\s*charges?)[^\n]*)/i,
      )?.[1],
    ) ||
    cleanLine(
      text.match(
        /(세금\s*(?:및\s*)?(?:봉사료|서비스\s*요금)?\s*포함|부가가치세\s*포함|VAT\s*included)[^\n]*/i,
      )?.[0],
    )

  if (line) return { included: true, text: line }
  if (/세금\s*별도|tax(?:es)?\s*(?:excluded|not\s*included)|VAT\s*excluded/i.test(text)) {
    return { included: false, text: '세금 별도' }
  }
  return { included: null, text: null }
}

function parseLabeledLine(text: string, labels: RegExp[]): string | null {
  for (const label of labels) {
    const re = new RegExp(`${label.source}\\s*[:：]\\s*([^\\n]+)`, label.flags.includes('i') ? 'i' : undefined)
    const v = cleanLine(text.match(re)?.[1])
    if (v) return v
  }
  return null
}

function parseAmenityList(raw: string | null): string[] {
  if (!raw) return []
  return [
    ...new Set(
      raw
        .split(/[,，·•|/｜]+/)
        .map((s) => s.replace(/^[\-\d.)\s]+/, '').trim())
        .filter(
          (s) =>
            s.length >= 2 &&
            s.length <= 60 &&
            !/포함사항|불포함|취소|결제|세금|부가가치세|서비스\s*요금|편의시설\s*:/i.test(s),
        ),
    ),
  ].slice(0, 16)
}

function parseAmenities(text: string): { ko: string[]; en: string[]; merged: string[] } {
  const koRaw = parseLabeledLine(text, [/객실\s*(?:편의\s*)?시설/, /편의\s*시설/])
  const enRaw = parseLabeledLine(text, [/Room\s*(?:amenities|facilities)/i, /Amenities/i])
  const ko = parseAmenityList(koRaw)
  const en = parseAmenityList(enRaw)
  const merged = en.length ? en : ko
  if (!merged.length) {
    const singles: string[] = []
    for (const re of [
      /무료\s*(?:Wi-?Fi|와이파이)/gi,
      /수영장|Pool/gi,
      /주차(?:장)?|Parking/gi,
      /피트니스|Gym|Fitness/gi,
      /스파|Spa/gi,
    ]) {
      const m = text.match(re)
      if (m) singles.push(m[0].replace(/\s+/g, ' ').trim())
    }
    const fallback = [...new Set(singles)].slice(0, 12)
    return { ko: fallback, en: fallback, merged: fallback }
  }
  return { ko: ko.length ? ko : en, en: en.length ? en : ko, merged }
}

function isBreakfastExclusionNoise(raw: string | null): boolean {
  if (!raw) return true
  return /meal|breakfast|조식|아침|not\s*included|불포함|편의시설|amenities|toothbrush|칫솔/i.test(raw)
}

function parseInclusions(text: string): { ko: string | null; en: string | null; merged: string | null } {
  const ko = parseLabeledLine(text, [/포함\s*(?:사항|내용)/])
  const en = parseLabeledLine(text, [/Inclusions?/i, /What(?:'s| is)\s*included/i])
  // 조식 포함 문장·편의시설 나열은 포함사항으로 쓰지 않음
  const cleanInc = (v: string | null) => {
    if (!v) return null
    if (/편의시설|amenities|toothbrush|칫솔|조식|breakfast/i.test(v) && !/세금|부가가치세|서비스|VAT|tax|service/i.test(v)) {
      return null
    }
    return v
  }
  const koC = cleanInc(ko)
  const enC = cleanInc(en)
  return { ko: koC, en: enC, merged: koC || enC }
}

function parseExclusions(text: string): { ko: string | null; en: string | null; merged: string | null } {
  // "Not included" alone matches breakfast lines — 명시 라벨만
  const ko = parseLabeledLine(text, [/불포함\s*(?:사항|내용)/])
  const en = parseLabeledLine(text, [/Exclusions?/i])
  const koC = isBreakfastExclusionNoise(ko) ? null : ko
  const enC = isBreakfastExclusionNoise(en) ? null : en
  return { ko: koC, en: enC, merged: koC || enC }
}

function parseCancellationPolicy(text: string): {
  ko: string | null
  en: string | null
  merged: string | null
} {
  const ko = cleanLine(
    text.match(/(?:취소\s*(?:정책|규정|수수료))\s*[:：]\s*([^\n]+)/)?.[1],
  )?.slice(0, 900) ?? null
  const en = cleanLine(
    text.match(/(?:Cancellation\s*(?:Policy|policy)|Refund\s*policy)\s*[:：]\s*([^\n]+)/i)?.[1],
  )?.slice(0, 900) ?? null
  if (ko || en) return { ko, en, merged: ko || en }
  const block = text.match(
    /(?:Free\s*cancellation|Non[- ]?refundable|무료\s*취소|환불\s*불가)[^\n]{0,200}/i,
  )?.[0]
  const merged = cleanLine(block)?.slice(0, 900) ?? null
  return { ko: merged, en: merged, merged }
}

function parseSpecialRequests(text: string): string | null {
  return (
    cleanLine(
      text.match(
        /(?:특별\s*(?:요청|요구)|Special\s*requests?)\s*[:：]?\s*([^\n]+)/i,
      )?.[1],
    ) || null
  )
}

function splitBilingualValue(raw: string | null): { ko: string | null; en: string | null } {
  if (!raw) return { ko: null, en: null }
  if (raw.includes('/')) {
    const parts = raw.split(/\s*\/\s*/).map((s) => s.trim()).filter(Boolean)
    const ko = parts.find((p) => /[\uAC00-\uD7A3]/.test(p)) || null
    const en = parts.find((p) => /[A-Za-z]/.test(p) && !/[\uAC00-\uD7A3]/.test(p)) || null
    if (ko || en) return { ko: ko ?? null, en: en ?? (ko ? null : raw) }
  }
  if (/[\uAC00-\uD7A3]/.test(raw) && !/[A-Za-z]{3,}/.test(raw)) return { ko: raw, en: null }
  if (/[A-Za-z]/.test(raw) && !/[\uAC00-\uD7A3]/.test(raw)) return { ko: null, en: raw }
  return { ko: raw, en: raw }
}

function parseBedType(text: string): { ko: string | null; en: string | null; merged: string | null } {
  const ko = parseLabeledLine(text, [/침대\s*(?:타입|종류)/])
  const en = parseLabeledLine(text, [/Bed\s*(?:type|Type)/i])
  if (ko || en) {
    const fromKo = splitBilingualValue(ko)
    const fromEn = splitBilingualValue(en)
    return {
      ko: fromKo.ko || ko,
      en: fromEn.en || en || fromKo.en,
      merged: ko || en,
    }
  }
  return { ko: null, en: null, merged: null }
}

function parseRoomType(text: string): { ko: string | null; en: string | null; merged: string | null } {
  const ko =
    parseLabeledLine(text, [/객실\s*(?:타입|유형|종류)/]) ||
    cleanLine(text.match(/Room\s*Type\s*[:：]\s*[^\n]*객실\s*타입\s*[:：]\s*([^\n]+)/i)?.[1])
  const en = parseLabeledLine(text, [/Room\s*(?:Type|Category)/i])
  if (ko || en) {
    const fromKo = splitBilingualValue(ko)
    const fromEn = splitBilingualValue(en)
    return {
      ko: fromKo.ko || (ko && /[\uAC00-\uD7A3]/.test(ko) ? ko : null),
      en: fromEn.en || en || fromKo.en || (ko && !/[\uAC00-\uD7A3]/.test(ko) ? ko : null),
      merged: ko || en,
    }
  }
  return { ko: null, en: null, merged: null }
}

function parseClockHint(raw: string | null): string | null {
  if (!raw) return null
  const m = raw.match(/(\d{1,2}\s*:\s*\d{2}|\d{1,2}\s*시)/)
  return m?.[1]?.replace(/\s+/g, '') ?? null
}

/** 박수: 체크인~아웃 일수 우선. "1박 :" 요금 라벨은 제외 */
function parseNightsCount(
  text: string,
  checkIn: string | null,
  checkOut: string | null,
): number | null {
  const fromDates = nightsFromDates(checkIn, checkOut)
  if (fromDates != null) return fromDates
  const stay =
    text.match(/(?:숙박\s*(?:일수|기간)|Number\s*of\s*nights?|Nights?\s*stay)\s*[:：]?\s*(\d+)/i)?.[1] ||
    text.match(/(?:^|[^\d])(\d+)\s*박(?:\s|$|,|·|\/)/m)?.[1] ||
    text.match(/(?:^|[^\d])(\d+)\s*nights?(?:\s|$|,|·|\/)(?!\s*(?:rate|price|금액|요금))/im)?.[1] ||
    null
  const n = stay ? Number(stay) : null
  return n != null && Number.isFinite(n) && n > 0 && n < 120 ? n : null
}

/** Trip.com / Agoda 영수증·바우처 본문에서 숙박·금액·포함사항 추출 */
export function parseOtaReceiptForInvoice(text: string): OtaReceiptParsedAmount {
  const provider = detectProvider(text)
  // Booking ID 라벨 최우선 (비자/체크인 바우처 SSOT). 예약 번호는 보조.
  const bookingIdExplicit =
    cleanLine(
      text.match(/Booking\s*ID\s*[:：]\s*(?:예약\s*번호\s*[:：]\s*)?([A-Z0-9-]{5,})/i)?.[1],
    ) || null
  const bookingRefAlt =
    cleanLine(text.match(/예약\s*번호\s*[:：]\s*([A-Z0-9-]{5,})/)?.[1]) ||
    cleanLine(text.match(/Confirmation(?:\s*(?:No\.?|Number|ID))?\s*[:：]?\s*([A-Z0-9-]{5,})/i)?.[1]) ||
    cleanLine(text.match(/Order\s*(?:ID|No\.?|Number)\s*[:：]?\s*([A-Z0-9-]{6,})/i)?.[1]) ||
    cleanLine(text.match(/확인\s*번호\s*[:：]?\s*([A-Z0-9-]{6,})/)?.[1]) ||
    cleanLine(text.match(/트립닷컴\s*예약번호\s*([A-Z0-9-]{5,})/i)?.[1]) ||
    null
  const bookingRef = bookingIdExplicit || bookingRefAlt

  const guestName =
    cleanLine(text.match(/고객명\s*[:：]\s*([^\n]+)/)?.[1]) ||
    cleanLine(text.match(/Client\s*[:：]\s*[^\n]*고객명\s*[:：]\s*([^\n]+)/i)?.[1]) ||
    cleanLine(text.match(/(?:Guest|Traveler|Passenger)\s*[:：]\s*([^\n]+)/i)?.[1]) ||
    cleanLine(text.match(/투숙객\s*[:：]\s*([^\n]+)/)?.[1]) ||
    null

  const propertyRaw =
    cleanLine(text.match(/Property\s*[:：]\s*[^\n]*숙소명\s*[:：]\s*([^\n]+)/i)?.[1]) ||
    cleanLine(text.match(/숙소명\s*[:：]\s*([^\n]+)/)?.[1]) ||
    cleanLine(text.match(/Property\s*[:：]\s*([^\n]+)/i)?.[1]) ||
    cleanLine(text.match(/Hotel\s*(?:name)?\s*[:：]\s*([^\n]+)/i)?.[1]) ||
    cleanLine(text.match(/상품명\s*[:：]\s*([^\n]+)/)?.[1]) ||
    null
  const names = splitPropertyNames(propertyRaw)

  const addressKo = parseLabeledLine(text, [/주소/])
  const addressEn = parseLabeledLine(text, [/Address/i])
  const address = addressKo || addressEn

  const phone =
    cleanLine(text.match(/(?:전화|Tel|Phone|연락처)\s*[:：]?\s*([+\d][\d\-\s()]{6,})/i)?.[1]) || null

  const checkInKo = parseLabeledLine(text, [/체크인/])
  const checkInEn = parseLabeledLine(text, [/Check[- ]?in/i, /Arrival/i])
  const checkOutKo = parseLabeledLine(text, [/체크아웃/])
  const checkOutEn = parseLabeledLine(text, [/Check[- ]?out/i, /Departure/i])
  const checkIn =
    cleanLine(text.match(/Arrival\s*[:：]\s*[^\n]*체크인\s*[:：]\s*([^\n]+)/i)?.[1]) ||
    checkInKo ||
    checkInEn ||
    null
  const checkOut =
    cleanLine(text.match(/Departure\s*[:：]\s*[^\n]*체크아웃\s*[:：]\s*([^\n]+)/i)?.[1]) ||
    checkOutKo ||
    checkOutEn ||
    null

  const room = parseRoomType(text)
  const roomsRaw = Number(text.match(/객실\s*수\s*[:：]?\s*(\d+)/)?.[1] ?? NaN)
  const adultsRaw = Number(text.match(/성인\s*수\s*[:：]?\s*(\d+)/)?.[1] ?? NaN)
  const childrenRaw = Number(text.match(/아동\s*수\s*[:：]?\s*(\d+)/)?.[1] ?? NaN)

  const nights = parseNightsCount(text, checkIn, checkOut)

  const breakfast = parseBreakfast(text)
  const tax = parseTaxService(text)
  const amenities = parseAmenities(text)
  const inclusions = parseInclusions(text)
  const exclusions = parseExclusions(text)
  const cancellation = parseCancellationPolicy(text)
  const specialRequests = parseSpecialRequests(text)
  const bed = parseBedType(text)

  const amountPatterns: RegExp[] = [
    /(?:총\s*(?:결제\s*)?금액|결제\s*금액|합계|총액|Total\s*(?:Amount|Price|Due)?|Grand\s*Total|Amount\s*Paid)\s*[:：]?\s*(?:KRW|₩|￦)?\s*([\d,]+)\s*(?:원|KRW)?/gi,
    /(?:KRW|₩|￦)\s*([\d,]{4,})/g,
    /([\d,]{4,})\s*원/g,
  ]

  const matches: string[] = []
  const candidates: number[] = []
  for (const re of amountPatterns) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(text))) {
      const token = m[1] ?? ''
      matches.push(token)
      const n = parseMoneyToken(token)
      if (n != null && n >= 1000) candidates.push(n)
    }
  }

  let sourceAmountKrw: number | null = null
  if (candidates.length) sourceAmountKrw = Math.max(...candidates)

  const nightRateUsd =
    parseUsdToken(
      text.match(
        /(?:1\s*박|박당|night(?:ly)?\s*(?:rate|price)|per\s*night)\s*[:：]?\s*(?:USD|US\$|\$)?\s*([\d,.]+)/i,
      )?.[1] ?? '',
    ) || null

  const totalUsd =
    parseUsdToken(
      text.match(
        /(?:총\s*(?:결제\s*)?금액|합계|Total\s*(?:Amount|Price|Due)?|Grand\s*Total)\s*[:：]?\s*(?:USD|US\$|\$)\s*([\d,.]+)/i,
      )?.[1] ?? '',
    ) ||
    parseUsdToken(text.match(/(?:USD|US\$)\s*([\d,.]+)/i)?.[1] ?? '') ||
    null

  const currencyHint = /KRW|₩|￦|원/.test(text)
    ? 'KRW'
    : /USD|\$/.test(text)
      ? 'USD'
      : null

  return {
    provider,
    bookingRef: bookingRef ? bookingRef.trim() : null,
    hotelConfirmationRef:
      bookingRefAlt && bookingIdExplicit && bookingRefAlt !== bookingIdExplicit
        ? bookingRefAlt
        : null,
    guestName,
    propertyOrService: names.propertyOrService,
    propertyNameKo: names.propertyNameKo,
    propertyNameEn: names.propertyNameEn,
    address,
    addressKo: addressKo || address,
    addressEn: addressEn || address,
    phone,
    checkIn,
    checkOut,
    checkInKo: checkInKo || checkIn,
    checkInEn: checkInEn || checkIn,
    checkOutKo: checkOutKo || checkOut,
    checkOutEn: checkOutEn || checkOut,
    checkInTime: parseClockHint(checkIn),
    checkOutTime: parseClockHint(checkOut),
    roomType: room.merged,
    roomTypeKo: room.ko || room.merged,
    roomTypeEn: room.en || room.merged,
    bedType: bed.merged,
    bedTypeKo: bed.ko || bed.merged,
    bedTypeEn: bed.en || bed.merged,
    rooms: Number.isFinite(roomsRaw) && roomsRaw > 0 ? roomsRaw : null,
    guestsAdults: Number.isFinite(adultsRaw) && adultsRaw > 0 ? adultsRaw : null,
    guestsChildren: Number.isFinite(childrenRaw) && childrenRaw >= 0 ? childrenRaw : null,
    nights,
    breakfastStatus: breakfast.status,
    breakfastText: breakfast.text,
    breakfastTextKo: breakfast.textKo,
    breakfastTextEn: breakfast.textEn,
    taxServiceText: tax.text,
    taxServiceIncluded: tax.included,
    amenities: amenities.merged,
    amenitiesKo: amenities.ko,
    amenitiesEn: amenities.en,
    inclusionsText: inclusions.merged,
    inclusionsTextKo: inclusions.ko || inclusions.merged,
    inclusionsTextEn: inclusions.en || inclusions.merged,
    exclusionsText: exclusions.merged,
    exclusionsTextKo: exclusions.ko || exclusions.merged,
    exclusionsTextEn: exclusions.en || exclusions.merged,
    cancellationPolicy: cancellation.merged,
    cancellationPolicyKo: cancellation.ko || cancellation.merged,
    cancellationPolicyEn: cancellation.en || cancellation.merged,
    specialRequests,
    paymentMethod: BONGTOUR_VOUCHER_PAYMENT_METHOD,
    sourceAmountKrw,
    nightRateUsd,
    totalUsd,
    currencyHint,
    rawAmountMatches: [...new Set(matches)].slice(0, 12),
  }
}

/** @deprecated 이익 가산 폐지 — 항상 0. 호환용으로 남김. */
export function computeInvoiceProfitKrw(_args: {
  sourceAmountKrw: number
  mode: OtaInvoiceProfitMode
  percent: number
  fixedKrw: number
}): number {
  return 0
}

export function buildOtaCompanyInvoiceDraft(args: {
  parsed: OtaReceiptParsedAmount
  sourceAmountKrw: number
  /** @deprecated 무시됨 — 입력 금액이 최종 합계 */
  profitMode?: OtaInvoiceProfitMode
  /** @deprecated 무시됨 */
  profitPercent?: number
  /** @deprecated 무시됨 */
  profitFixedKrw?: number
  guestNameOverride?: string | null
  note?: string
  now?: Date
  sourceAmountUsd?: number | null
  rateDate?: string | null
  usdKrwRate?: number | null
}): OtaCompanyInvoiceDraft {
  const now = args.now ?? new Date()
  const source = Math.max(0, Math.round(args.sourceAmountKrw))
  const ymd = now.toISOString().slice(0, 10).replace(/-/g, '')
  const rand = Math.floor(Math.random() * 9000 + 1000)
  const hotel =
    args.parsed.propertyNameKo && args.parsed.propertyNameEn
      ? `${args.parsed.propertyNameKo} / ${args.parsed.propertyNameEn}`
      : args.parsed.propertyNameKo ||
        args.parsed.propertyNameEn ||
        args.parsed.propertyOrService
  const serviceParts = [
    hotel,
    args.parsed.checkIn && args.parsed.checkOut
      ? `${args.parsed.checkIn} ~ ${args.parsed.checkOut}`
      : null,
    args.parsed.bookingRef ? `예약 ${args.parsed.bookingRef}` : null,
    args.parsed.provider === 'agoda'
      ? 'Agoda 숙박'
      : args.parsed.provider === 'trip_com'
        ? 'Trip.com 예약'
        : 'OTA 예약',
  ].filter(Boolean)

  return {
    invoiceNumber: `BT-INV-${ymd}-${rand}`,
    issuedAtIso: now.toISOString(),
    provider: args.parsed.provider,
    bookingRef: args.parsed.bookingRef,
    guestName: (args.guestNameOverride ?? args.parsed.guestName)?.trim() || null,
    serviceDescription: serviceParts.join(' · ') || '여행 서비스',
    sourceAmountKrw: source,
    sourceAmountUsd:
      args.sourceAmountUsd != null && Number.isFinite(args.sourceAmountUsd)
        ? Math.round(Number(args.sourceAmountUsd) * 100) / 100
        : null,
    rateDate: args.rateDate ?? null,
    usdKrwRate:
      args.usdKrwRate != null && Number.isFinite(args.usdKrwRate) ? Number(args.usdKrwRate) : null,
    profitMode: 'percent',
    profitPercent: 0,
    profitFixedKrw: 0,
    profitKrw: 0,
    totalKrw: source,
    taxServiceIncludedNote: BONGTOUR_TAX_SERVICE_INCLUDED_NOTE,
    company: BONGTOUR_INVOICE_COMPANY,
    note: String(args.note ?? '').trim(),
  }
}

export function buildOtaCompanyCheckInVoucherDraft(args: {
  parsed: OtaReceiptParsedAmount
  amountUsd: number
  nightRateUsd?: number | null
  rateDate: string
  effectiveRateDate: string
  usdKrwRate: number
  amountKrw: number
  nightRateKrw?: number | null
  guestNameOverride?: string | null
  propertyOverride?: string | null
  propertyNameKoOverride?: string | null
  propertyNameEnOverride?: string | null
  roomTypeOverride?: string | null
  checkInOverride?: string | null
  checkOutOverride?: string | null
  note?: string
  now?: Date
  logoUrl?: string | null
}): OtaCompanyCheckInVoucherDraft {
  const now = args.now ?? new Date()
  const ymd = now.toISOString().slice(0, 10).replace(/-/g, '')
  const rand = Math.floor(Math.random() * 9000 + 1000)
  const propertyNameKo =
    cleanLine(args.propertyNameKoOverride) || cleanLine(args.parsed.propertyNameKo)
  const propertyNameEn =
    cleanLine(args.propertyNameEnOverride) || cleanLine(args.parsed.propertyNameEn)
  const propertyName =
    cleanLine(args.propertyOverride) ||
    [propertyNameKo, propertyNameEn].filter(Boolean).join(' / ') ||
    cleanLine(args.parsed.propertyOrService) ||
    '숙소'

  const nights = args.parsed.nights
  let nightRateUsd =
    args.nightRateUsd != null && Number.isFinite(args.nightRateUsd) && args.nightRateUsd > 0
      ? Math.round(Number(args.nightRateUsd) * 100) / 100
      : args.parsed.nightRateUsd
  const amountUsd = Math.round(Math.max(0, Number(args.amountUsd)) * 100) / 100
  if ((nightRateUsd == null || nightRateUsd <= 0) && nights && nights > 0 && amountUsd > 0) {
    nightRateUsd = Math.round((amountUsd / nights) * 100) / 100
  }

  let nightRateKrw =
    args.nightRateKrw != null && Number.isFinite(args.nightRateKrw)
      ? Math.max(0, Math.round(args.nightRateKrw))
      : null
  if (nightRateKrw == null && nightRateUsd != null) {
    nightRateKrw = Math.round(nightRateUsd * Number(args.usdKrwRate))
  }

  return {
    voucherNumber: `BT-VCH-${ymd}-${rand}`,
    issuedAtIso: now.toISOString(),
    provider: args.parsed.provider,
    bookingRef: args.parsed.bookingRef,
    hotelConfirmationRef: args.parsed.hotelConfirmationRef,
    guestName: (args.guestNameOverride ?? args.parsed.guestName)?.trim() || null,
    propertyName,
    propertyNameKo,
    propertyNameEn,
    addressKo: args.parsed.addressKo || args.parsed.address,
    addressEn: args.parsed.addressEn || args.parsed.address,
    phone: args.parsed.phone,
    roomTypeKo:
      cleanLine(args.roomTypeOverride) ||
      args.parsed.roomTypeKo ||
      args.parsed.roomType,
    roomTypeEn: args.parsed.roomTypeEn || args.parsed.roomType,
    bedTypeKo: args.parsed.bedTypeKo || args.parsed.bedType,
    bedTypeEn: args.parsed.bedTypeEn || args.parsed.bedType,
    rooms: args.parsed.rooms,
    guestsAdults: args.parsed.guestsAdults,
    guestsChildren: args.parsed.guestsChildren,
    checkInKo:
      cleanLine(args.checkInOverride) ||
      args.parsed.checkInKo ||
      args.parsed.checkIn,
    checkInEn: args.parsed.checkInEn || args.parsed.checkIn,
    checkOutKo:
      cleanLine(args.checkOutOverride) ||
      args.parsed.checkOutKo ||
      args.parsed.checkOut,
    checkOutEn: args.parsed.checkOutEn || args.parsed.checkOut,
    checkInTime: args.parsed.checkInTime,
    checkOutTime: args.parsed.checkOutTime,
    nights,
    breakfastStatus: args.parsed.breakfastStatus,
    breakfastTextKo: args.parsed.breakfastTextKo || args.parsed.breakfastText,
    breakfastTextEn: args.parsed.breakfastTextEn || args.parsed.breakfastText,
    taxServiceText: args.parsed.taxServiceText,
    taxServiceIncludedNote: BONGTOUR_TAX_SERVICE_INCLUDED_NOTE,
    taxServiceIncludedNoteEn: BONGTOUR_TAX_SERVICE_INCLUDED_NOTE_EN,
    amenitiesKo: args.parsed.amenitiesKo?.length
      ? args.parsed.amenitiesKo
      : args.parsed.amenities,
    amenitiesEn: args.parsed.amenitiesEn?.length
      ? args.parsed.amenitiesEn
      : args.parsed.amenities,
    inclusionsTextKo: args.parsed.inclusionsTextKo || args.parsed.inclusionsText,
    inclusionsTextEn: args.parsed.inclusionsTextEn || args.parsed.inclusionsText,
    exclusionsTextKo: args.parsed.exclusionsTextKo || args.parsed.exclusionsText,
    exclusionsTextEn: args.parsed.exclusionsTextEn || args.parsed.exclusionsText,
    cancellationPolicyKo:
      args.parsed.cancellationPolicyKo || args.parsed.cancellationPolicy,
    cancellationPolicyEn:
      args.parsed.cancellationPolicyEn || args.parsed.cancellationPolicy,
    specialRequests: args.parsed.specialRequests,
    paymentMethod: BONGTOUR_VOUCHER_PAYMENT_METHOD,
    nightRateUsd,
    nightRateKrw,
    amountUsd,
    rateDate: args.rateDate,
    effectiveRateDate: args.effectiveRateDate,
    usdKrwRate: Number(args.usdKrwRate),
    amountKrw: Math.max(0, Math.round(args.amountKrw)),
    logoUrl: args.logoUrl?.trim() || resolveBongtourLogoUrl(),
    company: BONGTOUR_INVOICE_COMPANY,
    note: String(args.note ?? '').trim(),
  }
}

export function formatKrw(n: number): string {
  return `${Math.round(n).toLocaleString('ko-KR')}원`
}

export function formatUsd(n: number): string {
  return `USD ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function breakfastLabel(
  status: OtaBreakfastStatus,
  text: string | null,
  locale: OtaVoucherLocale = 'ko',
): string {
  if (text) return text
  if (locale === 'en') {
    if (status === 'included') return 'Breakfast included'
    if (status === 'not_included') return 'Breakfast not included'
    return 'Breakfast info N/A'
  }
  if (status === 'included') return '조식 포함'
  if (status === 'not_included') return '조식 불포함'
  return '조식 정보 없음'
}

function rowHtml(k: string, v: string): string {
  return `<div class="row"><div class="k">${escapeHtml(k)}</div><div class="v">${v}</div></div>`
}

const VOUCHER_CSS = `
  body{font-family:system-ui,-apple-system,sans-serif;color:#111;margin:40px;max-width:720px}
  .header{display:flex;align-items:center;gap:16px;margin-bottom:8px}
  .logo{height:48px;width:auto;object-fit:contain}
  .brand{letter-spacing:0.04em;font-size:13px;color:#444;text-transform:uppercase}
  h1{font-size:24px;margin:6px 0 4px}
  .muted{color:#555;font-size:13px}
  .booking{margin-top:12px;padding:12px 14px;border:2px solid #111;font-size:15px;font-weight:700;letter-spacing:0.02em}
  .box{border:1px solid #222;padding:20px;margin-top:16px}
  .row{display:flex;justify-content:space-between;gap:16px;padding:8px 0;border-bottom:1px solid #eee}
  .row:last-child{border-bottom:0}
  .k{color:#555;font-size:12px;min-width:140px}
  .v{font-weight:600;text-align:right;flex:1;white-space:pre-wrap}
  .amount{margin-top:20px;padding:16px;background:#f6f6f6}
  .policy{margin-top:16px;padding:14px;border:1px solid #ddd;font-size:13px;line-height:1.5}
  .footer{margin-top:28px;font-size:12px;color:#666;line-height:1.5}
  .page-break{page-break-before:always;break-before:page;margin-top:48px;padding-top:24px;border-top:1px dashed #ccc}
  @media print{body{margin:16px}.page-break{border-top:0;margin-top:0;padding-top:0}}
`

/** 인쇄용 HTML (관리자 미리보기·window.print) */
export function renderOtaCompanyInvoiceHtml(draft: OtaCompanyInvoiceDraft): string {
  const c = draft.company
  const guest = draft.guestName || '고객'
  const issued = new Date(draft.issuedAtIso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
  const fxLine =
    draft.sourceAmountUsd != null && draft.usdKrwRate != null && draft.rateDate
      ? `<p class="muted">${formatUsd(draft.sourceAmountUsd)} · 환율 ${draft.rateDate} 기준 1 USD = ${draft.usdKrwRate.toLocaleString('ko-KR')} KRW</p>`
      : ''
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8"/>
<title>${draft.invoiceNumber}</title>
<style>
  body{font-family:system-ui,-apple-system,sans-serif;color:#111;margin:40px;max-width:720px}
  h1{font-size:22px;margin:0 0 4px}
  .muted{color:#555;font-size:13px}
  table{width:100%;border-collapse:collapse;margin-top:24px}
  th,td{border-bottom:1px solid #ddd;padding:10px 6px;text-align:left}
  th{font-size:12px;color:#555}
  td.num,th.num{text-align:right}
  .total{font-weight:700;font-size:16px}
  .footer{margin-top:32px;font-size:12px;color:#666;line-height:1.5}
  @media print{body{margin:16px}}
</style>
</head>
<body>
  <h1>${c.legalName} 인보이스</h1>
  <div class="muted">${c.brandName} · ${draft.invoiceNumber}</div>
  <div class="muted">발행일시 ${issued}</div>
  <p style="margin-top:20px"><strong>청구 대상</strong> ${escapeHtml(guest)}</p>
  <p class="muted">Booking ID ${escapeHtml(draft.bookingRef || '—')} · 공급원 ${draft.provider}</p>
  ${fxLine}
  <table>
    <thead><tr><th>내역</th><th class="num">금액</th></tr></thead>
    <tbody>
      <tr><td>${escapeHtml(draft.serviceDescription)}</td><td class="num">${formatKrw(draft.sourceAmountKrw)}</td></tr>
      <tr class="total"><td>합계</td><td class="num">${formatKrw(draft.totalKrw)}</td></tr>
    </tbody>
  </table>
  <p class="muted" style="margin-top:12px">${escapeHtml(draft.taxServiceIncludedNote)}</p>
  ${draft.note ? `<p style="margin-top:16px"><strong>비고</strong> ${escapeHtml(draft.note)}</p>` : ''}
  <div class="footer">
    사업자등록 ${c.businessRegistrationNo} · 관광사업자 ${c.tourismRegistrationNo}호 · 통신판매업 ${c.mailOrderNo}<br/>
    상담 ${c.phone} (${c.consultHours}) · ${c.email}
  </div>
</body>
</html>`
}

function renderVoucherBody(draft: OtaCompanyCheckInVoucherDraft, locale: OtaVoucherLocale): string {
  const c = draft.company
  const isKo = locale === 'ko'
  const guest = draft.guestName || (isKo ? '고객' : 'GUEST')
  const issued = new Date(draft.issuedAtIso).toLocaleString(isKo ? 'ko-KR' : 'en-US', {
    timeZone: 'Asia/Seoul',
  })
  const nightsLabel =
    draft.nights != null ? (isKo ? `${draft.nights}박` : `${draft.nights} night(s)`) : '—'
  const guestsParts = isKo
    ? [
        draft.guestsAdults != null ? `성인 ${draft.guestsAdults}` : null,
        draft.guestsChildren != null && draft.guestsChildren > 0
          ? `아동 ${draft.guestsChildren}`
          : null,
        draft.rooms != null ? `객실 ${draft.rooms}` : null,
      ]
    : [
        draft.guestsAdults != null ? `Adults ${draft.guestsAdults}` : null,
        draft.guestsChildren != null && draft.guestsChildren > 0
          ? `Children ${draft.guestsChildren}`
          : null,
        draft.rooms != null ? `Rooms ${draft.rooms}` : null,
      ]
  const hotelPrimary = isKo
    ? draft.propertyNameKo || draft.propertyNameEn || draft.propertyName
    : draft.propertyNameEn || draft.propertyNameKo || draft.propertyName
  const hotelSecondary = isKo
    ? draft.propertyNameEn && draft.propertyNameEn !== hotelPrimary
      ? draft.propertyNameEn
      : null
    : draft.propertyNameKo && draft.propertyNameKo !== hotelPrimary
      ? draft.propertyNameKo
      : null
  const address = isKo
    ? draft.addressKo || draft.addressEn
    : draft.addressEn || draft.addressKo
  const roomType = isKo
    ? draft.roomTypeKo || draft.roomTypeEn
    : draft.roomTypeEn || draft.roomTypeKo
  const bedType = isKo
    ? draft.bedTypeKo || draft.bedTypeEn
    : draft.bedTypeEn || draft.bedTypeKo
  const checkIn = isKo
    ? draft.checkInKo || draft.checkInEn
    : draft.checkInEn || draft.checkInKo
  const checkOut = isKo
    ? draft.checkOutKo || draft.checkOutEn
    : draft.checkOutEn || draft.checkOutKo
  const breakfastText = isKo ? draft.breakfastTextKo : draft.breakfastTextEn
  const breakfast = breakfastLabel(draft.breakfastStatus, breakfastText, locale)
  const amenitiesList = isKo ? draft.amenitiesKo : draft.amenitiesEn
  const amenities =
    amenitiesList.length > 0 ? escapeHtml(amenitiesList.join(isKo ? ' · ' : ', ')) : '—'
  const inclusionsText = isKo ? draft.inclusionsTextKo : draft.inclusionsTextEn
  const exclusionsText = isKo ? draft.exclusionsTextKo : draft.exclusionsTextEn
  const cancellationPolicy = isKo
    ? draft.cancellationPolicyKo
    : draft.cancellationPolicyEn
  const nightLine =
    draft.nightRateUsd != null
      ? `${formatUsd(draft.nightRateUsd)}${
          draft.nightRateKrw != null ? ` (${formatKrw(draft.nightRateKrw)})` : ''
        }`
      : '—'
  const taxNote = isKo ? draft.taxServiceIncludedNote : draft.taxServiceIncludedNoteEn
  const L = isKo
    ? {
        title: `${c.legalName} 체크인 바우처`,
        issued: `발행 ${issued}`,
        booking: 'Booking ID (예약번호)',
        guest: '투숙객',
        hotel: '숙소',
        hotelAlt: '숙소 (영문)',
        address: '주소',
        phone: '전화',
        room: '객실',
        bed: '침대',
        checkIn: '체크인',
        checkOut: '체크아웃',
        stay: '숙박',
        guests: '인원/객실',
        breakfast: '조식',
        amenities: '객실 편의시설',
        inclusions: '포함사항',
        exclusions: '불포함사항',
        payment: '결제',
        special: '특별요청',
        cancel: '취소정책',
        night: '1박 금액',
        total: '총 금액',
        fx: `환율일 ${draft.rateDate}${
          draft.effectiveRateDate !== draft.rateDate
            ? ` (고시 ${draft.effectiveRateDate})`
            : ''
        } · 1 USD = ${draft.usdKrwRate.toLocaleString('ko-KR')} KRW`,
        present: `본 바우처는 ${c.legalName} 예약 확인용입니다. 호텔 프론트에 제시해 주세요.`,
        note: '비고',
        footer: `사업자등록 ${c.businessRegistrationNo} · 관광사업자 ${c.tourismRegistrationNo}호 · 통신판매업 ${c.mailOrderNo}<br/>상담 ${c.phone} (${c.consultHours}) · ${c.email}`,
      }
    : {
        title: `${c.brandName} Check-in Voucher`,
        issued: `Issued ${issued}`,
        booking: 'Booking ID',
        guest: 'Guest',
        hotel: 'Property',
        hotelAlt: 'Property (local name)',
        address: 'Address',
        phone: 'Phone',
        room: 'Room type',
        bed: 'Bed type',
        checkIn: 'Check-in',
        checkOut: 'Check-out',
        stay: 'Stay',
        guests: 'Guests / rooms',
        breakfast: 'Breakfast',
        amenities: 'Room amenities',
        inclusions: 'Inclusions',
        exclusions: 'Exclusions',
        payment: 'Payment',
        special: 'Special requests',
        cancel: 'Cancellation policy',
        night: 'Per night',
        total: 'Total amount',
        fx: `FX date ${draft.rateDate}${
          draft.effectiveRateDate !== draft.rateDate
            ? ` (published ${draft.effectiveRateDate})`
            : ''
        } · 1 USD = ${draft.usdKrwRate.toLocaleString('en-US')} KRW`,
        present: `This voucher confirms a ${c.brandName} reservation. Please present it at the hotel front desk.`,
        note: 'Notes',
        // Mail-order sales report = 통신판매업 (not email). Email goes on Contact line.
        footer: `Business Reg. ${c.businessRegistrationNo} · Tourism business ${c.tourismRegistrationNo} · E-commerce sales report ${c.mailOrderNoEn}<br/>Contact ${c.phone} (${c.consultHoursEn}) · ${c.email}`,
      }

  return `
  <div class="header">
    <img class="logo" src="${escapeHtml(draft.logoUrl)}" alt="${escapeHtml(c.brandName)}" />
    <div>
      <div class="brand">${escapeHtml(c.brandName)}</div>
      <h1>${escapeHtml(L.title)}</h1>
      <div class="muted">${escapeHtml(draft.voucherNumber)} · ${escapeHtml(L.issued)}</div>
    </div>
  </div>
  <div class="booking">${escapeHtml(L.booking)}: ${escapeHtml(draft.bookingRef || '—')}${
    draft.hotelConfirmationRef
      ? `<div class="muted" style="margin-top:6px;font-weight:500">${
          isKo ? '호텔 확인번호' : 'Hotel confirmation'
        }: ${escapeHtml(draft.hotelConfirmationRef)}</div>`
      : ''
  }</div>
  <div class="box">
    ${rowHtml(L.guest, escapeHtml(guest))}
    ${rowHtml(L.hotel, escapeHtml(hotelPrimary))}
    ${hotelSecondary ? rowHtml(L.hotelAlt, escapeHtml(hotelSecondary)) : ''}
    ${address ? rowHtml(L.address, escapeHtml(address)) : ''}
    ${draft.phone ? rowHtml(L.phone, escapeHtml(draft.phone)) : ''}
    ${rowHtml(L.room, escapeHtml(roomType || '—'))}
    ${bedType ? rowHtml(L.bed, escapeHtml(bedType)) : ''}
    ${rowHtml(L.checkIn, escapeHtml(checkIn || '—'))}
    ${rowHtml(L.checkOut, escapeHtml(checkOut || '—'))}
    ${rowHtml(L.stay, escapeHtml(nightsLabel))}
    ${guestsParts.filter(Boolean).length ? rowHtml(L.guests, escapeHtml(guestsParts.filter(Boolean).join(isKo ? ' · ' : ', '))) : ''}
    ${rowHtml(L.breakfast, escapeHtml(breakfast))}
    ${rowHtml(L.amenities, amenities)}
    ${inclusionsText ? rowHtml(L.inclusions, escapeHtml(inclusionsText)) : ''}
    ${exclusionsText ? rowHtml(L.exclusions, escapeHtml(exclusionsText)) : ''}
    ${rowHtml(L.payment, escapeHtml(draft.paymentMethod))}
    ${draft.specialRequests ? rowHtml(L.special, escapeHtml(draft.specialRequests)) : ''}
  </div>
  ${
    cancellationPolicy
      ? `<div class="policy"><strong>${escapeHtml(L.cancel)}</strong><br/>${escapeHtml(cancellationPolicy)}</div>`
      : ''
  }
  <div class="amount">
    <div><strong>${escapeHtml(L.night)}</strong> ${nightLine}</div>
    <div style="margin-top:10px"><strong>${escapeHtml(L.total)}</strong> ${formatUsd(draft.amountUsd)}</div>
    <div class="muted" style="margin-top:6px">${escapeHtml(L.fx)}</div>
    <div style="margin-top:8px;font-size:18px;font-weight:700">${formatKrw(draft.amountKrw)}</div>
    <div class="muted" style="margin-top:10px">${escapeHtml(taxNote)}</div>
    ${
      draft.taxServiceText
        ? `<div class="muted" style="margin-top:4px">${isKo ? '원문' : 'Source'}: ${escapeHtml(draft.taxServiceText)}</div>`
        : ''
    }
    <div class="muted" style="margin-top:8px">${escapeHtml(L.present)}</div>
  </div>
  ${draft.note ? `<p style="margin-top:16px"><strong>${escapeHtml(L.note)}</strong> ${escapeHtml(draft.note)}</p>` : ''}
  <div class="footer">${L.footer}</div>`
}

/** 단일 언어 체크인 바우처 HTML */
export function renderOtaCompanyCheckInVoucherHtml(
  draft: OtaCompanyCheckInVoucherDraft,
  locale: OtaVoucherLocale = 'ko',
): string {
  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
<meta charset="utf-8"/>
<title>${draft.voucherNumber} (${locale.toUpperCase()})</title>
<style>${VOUCHER_CSS}</style>
</head>
<body>
${renderVoucherBody(draft, locale)}
</body>
</html>`
}

/** 한글 + 영문 바우처를 한 문서(인쇄 시 페이지 분리)로 */
export function renderOtaCompanyCheckInVoucherBilingualHtml(
  draft: OtaCompanyCheckInVoucherDraft,
): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8"/>
<title>${draft.voucherNumber} KO/EN</title>
<style>${VOUCHER_CSS}</style>
</head>
<body>
${renderVoucherBody(draft, 'ko')}
<div class="page-break"></div>
${renderVoucherBody(draft, 'en')}
</body>
</html>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
