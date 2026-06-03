/**
 * travel_consult(홈·상품 상담 신청) 접수 알림 — `POST /api/bookings` 와 동일 SSOT(`notifyBookingStyleIntakeAlerts`).
 */

import type { AdminBookingAlertPayload } from '@/lib/booking-alert-payload'
import { notifyBookingStyleIntakeAlerts } from '@/lib/booking-style-intake-notify'
import type { BookingRowForAdminEmail } from '@/lib/booking-email'
import { adminInquiryLmsHeadcountLine } from '@/lib/admin-inquiry-lms-content'
import { parseInquiryPayloadJson } from '@/lib/inquiry-notification-format'
import { getSiteOrigin } from '@/lib/site-metadata'
import type { BookingForAlert } from '@/lib/notification-service'
import { sendInquiryCustomerAlimtalkOrLms } from '@/lib/inquiry-customer-notify'

export type TravelInquiryNotifyRow = {
  id: string
  inquiryNumber: string
  inquiryType: string
  applicantName: string
  applicantPhone: string
  applicantEmail: string | null
  message: string | null
  payloadJson: string | null
  productId: string | null
  snapshotProductTitle: string | null
  snapshotCardLabel: string | null
  snapshotOriginSource: string | null
  snapshotOriginUrl: string | null
  preferredContactChannel: string | null
  createdAt: Date
}

function mapPreferredContact(
  raw: string | null | undefined,
): AdminBookingAlertPayload['preferredContactChannel'] {
  const k = (raw ?? '').trim().toLowerCase()
  if (k === 'email') return 'email'
  if (k === 'kakao') return 'kakao'
  return 'phone'
}

export function buildBookingAlertPayloadFromTravelInquiry(
  row: TravelInquiryNotifyRow,
  productLabel: string,
): AdminBookingAlertPayload {
  const payload = parseInquiryPayloadJson(row.payloadJson)
  const paxSummary = adminInquiryLmsHeadcountLine(row.inquiryType, payload)
  const dep =
    (typeof payload.preferredDepartureDate === 'string' && payload.preferredDepartureDate.trim()) ||
    (typeof payload.preferredDepartureMonth === 'string' && payload.preferredDepartureMonth.trim()) ||
    (typeof payload.targetYearMonth === 'string' && payload.targetYearMonth.trim()) ||
    null
  const origin = getSiteOrigin()
  const adminLink = origin ? `${origin.replace(/\/$/, '')}/admin/bookings` : '/admin/bookings'

  return {
    customerName: row.applicantName,
    customerPhone: row.applicantPhone,
    customerEmail: (row.applicantEmail ?? '').trim(),
    bookingNumber: row.inquiryNumber,
    productTitle: productLabel,
    originSource: row.snapshotOriginSource?.trim() || 'travel_consult',
    preferredOrSelectedDate: dep,
    paxSummary: paxSummary === '-' ? '협의' : paxSummary,
    singleRoomRequested: false,
    preferredContactChannel: mapPreferredContact(row.preferredContactChannel),
    childInfantBirthDates: [],
    requestNotes: row.message?.trim() || null,
    adminLink,
  }
}

function syntheticBookingRows(
  row: TravelInquiryNotifyRow,
  productLabel: string,
  adminPayload: AdminBookingAlertPayload,
): { bookingForEmail: BookingRowForAdminEmail; bookingForSms: BookingForAlert } {
  const dep = adminPayload.preferredOrSelectedDate
  const selectedDate =
    dep && /^\d{4}-\d{2}-\d{2}$/.test(dep) ? new Date(`${dep}T00:00:00.000Z`) : row.createdAt

  const base = {
    id: 0,
    bookingNumber: row.inquiryNumber,
    productId: row.productId ?? '',
    productTitle: productLabel,
    selectedDate,
    adultCount: 0,
    childBedCount: 0,
    childNoBedCount: 0,
    infantCount: 0,
    totalKrwAmount: 0,
    totalLocalAmount: 0,
    localCurrency: 'KRW',
    customerName: row.applicantName,
    customerPhone: row.applicantPhone,
  }

  return {
    bookingForEmail: {
      ...base,
      createdAt: row.createdAt,
      pricingMode: 'inquiry_travel_consult',
      customerEmail: row.applicantEmail,
      requestNotes: row.message,
      preferredContactChannel: row.preferredContactChannel,
      singleRoomRequested: false,
      childInfantBirthDatesJson: null,
      originSourceSnapshot: row.snapshotOriginSource,
      originCodeSnapshot: null,
      product: null,
    },
    bookingForSms: { ...base, product: null },
  }
}

export type TravelInquiryBookingAlignedNotifyResult = {
  emailOk: boolean
  adminSms: { skipped: boolean; ok: boolean }
  /** 알림톡(ATA)만 — LMS 폴백 성공과 구분 */
  customerAlimtalkOk: boolean
  customerLmsOk: boolean
  customerLmsSkipped: boolean
  noRegisteredAlimtalkTemplate: boolean
}

/** `travel_consult` — 고객 알림톡 4종 해당 없으면 LMS만; 관리자는 예약과 동일 문자·메일 */
export async function notifyTravelConsultInquiryBookingAligned(
  row: TravelInquiryNotifyRow,
  productLabel: string,
): Promise<TravelInquiryBookingAlignedNotifyResult> {
  const adminPayload = buildBookingAlertPayloadFromTravelInquiry(row, productLabel)
  const { bookingForEmail, bookingForSms } = syntheticBookingRows(row, productLabel, adminPayload)
  const origin = getSiteOrigin()
  const detailLink = origin
    ? `${origin.replace(/\/$/, '')}/admin/inquiries/${row.id}`
    : `/admin/inquiries/${row.id}`
  const emailAppendix = [
    '■ 문의 상세(통합 상담·예약)',
    detailLink,
    '(접수 유형: 홈·상품 여행 상담 / CustomerInquiry)',
  ].join('\n')

  const travelConsultProductTitle = row.snapshotProductTitle?.trim() || productLabel

  const customerNotify = await sendInquiryCustomerAlimtalkOrLms({
    inquiryId: row.id,
    inquiryType: row.inquiryType,
    applicantName: row.applicantName,
    applicantPhone: row.applicantPhone,
    payloadJson: row.payloadJson,
    productLabel,
    travelConsultProductTitle,
    snapshotCardLabel: row.snapshotCardLabel,
  })
  const {
    customerAlimtalkOk,
    customerLmsOk,
    customerLmsSkipped,
    noRegisteredAlimtalkTemplate,
  } = customerNotify

  const r = await notifyBookingStyleIntakeAlerts({
    bookingForSms,
    bookingForEmail,
    adminPayload,
    customer: {
      phone: row.applicantPhone,
      bookingNumber: row.inquiryNumber,
      productTitle: productLabel,
      selectedDateLabel: adminPayload.preferredOrSelectedDate?.trim() || '협의',
      paxSummary: adminPayload.paxSummary,
    },
    emailAppendix,
    skipCustomerNotify: true,
    log: { inquiryId: row.id, channel: 'travel_consult' },
  })

  return {
    emailOk: r.emailOk,
    adminSms: r.adminSms,
    customerAlimtalkOk,
    customerLmsOk,
    customerLmsSkipped,
    noRegisteredAlimtalkTemplate,
  }
}
