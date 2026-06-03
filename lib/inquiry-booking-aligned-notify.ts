/**
 * travel_consult(홈·상품 상담 신청) 접수 알림 — 패키지 예약(`POST /api/bookings`)과 동일 Solapi·SMTP 템플릿.
 */

import type { AdminBookingAlertPayload } from '@/lib/booking-alert-payload'
import { buildAdminBookingShortAlertLine } from '@/lib/booking-alert-payload'
import {
  buildBookingAdminEmailSubject,
  buildBookingAdminEmailText,
  bookingAdminNotificationRecipient,
  logBookingSmtpEnvPresence,
  type BookingRowForAdminEmail,
} from '@/lib/booking-email'
import { adminInquiryLmsHeadcountLine } from '@/lib/admin-inquiry-lms-content'
import { parseInquiryPayloadJson } from '@/lib/inquiry-notification-format'
import { getSiteOrigin } from '@/lib/site-metadata'
import { sendAdminShortAlertSms, sendBookingRequestReceivedLmsFallback } from '@/lib/notification-service'
import { sendBookingRequestReceivedAlimTalk } from '@/lib/solapi-alimtalk'
import nodemailer from 'nodemailer'

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

function syntheticBookingRowForEmail(
  row: TravelInquiryNotifyRow,
  productLabel: string,
  adminPayload: AdminBookingAlertPayload,
): BookingRowForAdminEmail {
  const dep = adminPayload.preferredOrSelectedDate
  const selectedDate = dep && /^\d{4}-\d{2}-\d{2}$/.test(dep)
    ? new Date(`${dep}T00:00:00.000Z`)
    : row.createdAt

  return {
    id: 0,
    bookingNumber: row.inquiryNumber,
    productId: row.productId ?? '',
    productTitle: productLabel,
    selectedDate,
    createdAt: row.createdAt,
    pricingMode: 'inquiry_travel_consult',
    adultCount: 0,
    childBedCount: 0,
    childNoBedCount: 0,
    infantCount: 0,
    totalKrwAmount: 0,
    totalLocalAmount: 0,
    localCurrency: 'KRW',
    customerName: row.applicantName,
    customerPhone: row.applicantPhone,
    customerEmail: row.applicantEmail,
    requestNotes: row.message,
    preferredContactChannel: row.preferredContactChannel,
    singleRoomRequested: false,
    childInfantBirthDatesJson: null,
    originSourceSnapshot: row.snapshotOriginSource,
    originCodeSnapshot: null,
    product: null,
  }
}

function buildTravelInquiryAdminEmailText(
  row: TravelInquiryNotifyRow,
  booking: BookingRowForAdminEmail,
  adminPayload: AdminBookingAlertPayload,
): string {
  const base = buildBookingAdminEmailText(booking, adminPayload)
  const origin = getSiteOrigin()
  const detailLink = origin
    ? `${origin.replace(/\/$/, '')}/admin/inquiries/${row.id}`
    : `/admin/inquiries/${row.id}`
  return `${base}\n\n■ 문의 상세(통합 상담·예약)\n${detailLink}\n(접수 유형: 홈·상품 여행 상담 / CustomerInquiry)`
}

async function sendTravelInquiryBookingStyleAdminEmail(
  row: TravelInquiryNotifyRow,
  productLabel: string,
  adminPayload: AdminBookingAlertPayload,
): Promise<boolean> {
  const host = process.env.SMTP_HOST?.trim()
  const portRaw = process.env.SMTP_PORT?.trim()
  const user = process.env.SMTP_USER?.trim()
  const pass = process.env.SMTP_PASS?.trim()
  const fromName = process.env.SMTP_FROM_NAME?.trim()
  const fromEmail = process.env.SMTP_FROM_EMAIL?.trim()
  const to = bookingAdminNotificationRecipient()
  const secure = process.env.SMTP_SECURE === 'true'
  const port = Number(portRaw || (secure ? 465 : 587))

  const missing: string[] = []
  if (!host) missing.push('SMTP_HOST')
  if (!portRaw) missing.push('SMTP_PORT')
  if (!user) missing.push('SMTP_USER')
  if (!pass) missing.push('SMTP_PASS')
  if (!fromName) missing.push('SMTP_FROM_NAME')
  if (!fromEmail) missing.push('SMTP_FROM_EMAIL')
  if (!to) missing.push('BOOKING_NOTIFICATION_EMAIL 또는 INQUIRY_NOTIFICATION_EMAIL')

  if (missing.length) {
    logBookingSmtpEnvPresence(console.warn)
    console.warn('[inquiry-booking-aligned] admin_email_skipped', missing.join(', '))
    return false
  }

  const booking = syntheticBookingRowForEmail(row, productLabel, adminPayload)
  const subject = buildBookingAdminEmailSubject(booking)
  const text = buildTravelInquiryAdminEmailText(row, booking, adminPayload)
  const html = `<pre style="font-family:system-ui,Segoe UI,sans-serif;font-size:14px;line-height:1.45;white-space:pre-wrap">${text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')}</pre>`

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    ...(!secure && port === 587 ? { requireTLS: true as const } : {}),
  })

  const replyTo =
    row.applicantEmail?.trim() && row.applicantEmail.includes('@')
      ? row.applicantEmail.trim()
      : undefined

  await transporter.sendMail({
    from: { name: fromName!, address: fromEmail! },
    to: to!,
    subject,
    text,
    html,
    ...(replyTo ? { replyTo } : {}),
  })
  return true
}

export type TravelInquiryBookingAlignedNotifyResult = {
  emailOk: boolean
  adminSms: { skipped: boolean; ok: boolean }
  customerAlimtalkOk: boolean
}

/** `travel_consult` — 예약 접수와 동일 알림톡·LMS·관리자 문자·관리자 메일 */
export async function notifyTravelConsultInquiryBookingAligned(
  row: TravelInquiryNotifyRow,
  productLabel: string,
): Promise<TravelInquiryBookingAlignedNotifyResult> {
  const adminPayload = buildBookingAlertPayloadFromTravelInquiry(row, productLabel)
  const paxSummary = adminPayload.paxSummary
  const selectedDateLabel = adminPayload.preferredOrSelectedDate?.trim() || '협의'

  let emailOk = false
  try {
    emailOk = await sendTravelInquiryBookingStyleAdminEmail(row, productLabel, adminPayload)
  } catch (e) {
    console.error(
      '[inquiry-booking-aligned] admin_email_failed',
      JSON.stringify({
        inquiryId: row.id,
        error: e instanceof Error ? e.message.slice(0, 500) : String(e),
      }),
    )
  }

  const adminSmsText = buildAdminBookingShortAlertLine(adminPayload)
  const adminSms = await sendAdminShortAlertSms(adminSmsText, { inquiryId: row.id, channel: 'booking_aligned' })

  let customerAlimtalkOk = false
  const alim = await sendBookingRequestReceivedAlimTalk(0, {
    customerPhone: row.applicantPhone,
    bookingNumber: row.inquiryNumber,
    productTitle: productLabel,
    selectedDate: selectedDateLabel,
    paxSummary,
  })
  if (alim.ok) {
    customerAlimtalkOk = true
  } else if (alim.shouldSendLmsFallback) {
    const lms = await sendBookingRequestReceivedLmsFallback({
      bookingId: 0,
      customerPhone: row.applicantPhone,
      productTitle: productLabel,
      selectedDate: selectedDateLabel,
      paxSummary,
    })
    customerAlimtalkOk = lms.ok
    if (!lms.ok) {
      console.error(
        '[inquiry-booking-aligned] customer_lms_failed',
        JSON.stringify({ inquiryId: row.id, message: lms.message }),
      )
    }
  }

  return {
    emailOk,
    adminSms: {
      skipped: adminSms.skipped,
      ok: !adminSms.skipped && adminSms.failed.length === 0 && adminSms.succeeded.length > 0,
    },
    customerAlimtalkOk,
  }
}
