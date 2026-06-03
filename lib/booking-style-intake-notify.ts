/**
 * 패키지 예약·travel_consult 상담 신청 공통 알림 — `POST /api/bookings` 와 동일 순서·동일 함수.
 */

import type { AdminBookingAlertPayload } from '@/lib/booking-alert-payload'
import { sendBookingReceivedEmailToAdmin, type BookingRowForAdminEmail } from '@/lib/booking-email'
import {
  parseSolapiReceiverPhones,
  sendAdminNotificationWithPayload,
  sendBookingRequestReceivedLmsFallback,
  type BookingForAlert,
} from '@/lib/notification-service'
import { sendBookingRequestReceivedAlimTalk } from '@/lib/solapi-alimtalk'

export type BookingStyleIntakeNotifyInput = {
  /** Solapi·로그용. 0 이하면 Booking.notificationStatus DB 갱신 생략(문의) */
  bookingForSms: BookingForAlert
  bookingForEmail: BookingRowForAdminEmail
  adminPayload: AdminBookingAlertPayload
  customer: {
    phone: string
    bookingNumber: string
    productTitle: string
    selectedDateLabel: string
    paxSummary: string
  }
  /** 문의 상세 링크 등 — 관리자 메일 본문 맨 아래에만 추가 */
  emailAppendix?: string
  /** true면 고객 알림톡/LMS 생략(문의 전용 템플릿을 상위에서 발송) */
  skipCustomerNotify?: boolean
  log: { bookingId?: number; inquiryId?: string; channel: 'booking' | 'travel_consult' }
}

export type BookingStyleIntakeNotifyResult = {
  emailOk: boolean
  adminSms: { skipped: boolean; ok: boolean }
  customerNotifyOk: boolean
}

/** 예약 접수(`bookings/route`)와 동일: 고객 알림톡→LMS → 관리자 문자 → 관리자 메일 */
export async function notifyBookingStyleIntakeAlerts(
  input: BookingStyleIntakeNotifyInput,
): Promise<BookingStyleIntakeNotifyResult> {
  const { bookingForSms, bookingForEmail, adminPayload, customer, emailAppendix, skipCustomerNotify, log } =
    input
  const logRef = log.bookingId ?? log.inquiryId ?? '-'
  const tag = log.channel === 'booking' ? '[booking]' : '[inquiry-booking-aligned]'

  const hasSolapiKey = Boolean(process.env.SOLAPI_API_KEY?.trim())
  const hasSolapiSecret = Boolean(process.env.SOLAPI_API_SECRET?.trim())
  const adminRecipients = parseSolapiReceiverPhones()
  const hasAdminRecipients = adminRecipients.length > 0
  const hasSenderPhone = Boolean(process.env.SOLAPI_FROM_PHONE?.trim())
  const smsEnvOk = hasSolapiKey && hasSolapiSecret && hasAdminRecipients && hasSenderPhone

  if (!smsEnvOk) {
    const missing: string[] = []
    if (!hasSolapiKey) missing.push('SOLAPI_API_KEY')
    if (!hasSolapiSecret) missing.push('SOLAPI_API_SECRET')
    if (!hasAdminRecipients) missing.push('SOLAPI_ADMIN_PHONES')
    if (!hasSenderPhone) missing.push('SOLAPI_FROM_PHONE')
    console.warn(`${tag} sms skipped: missing env`, missing.join(', '), JSON.stringify(log))
  } else {
    console.log(
      `${tag} sms start`,
      JSON.stringify({
        ref: logRef,
        adminRecipientCount: adminRecipients.length,
      }),
    )
  }

  let customerNotifyOk = false
  const alimBookingId = bookingForSms.id > 0 ? bookingForSms.id : 0
  if (!skipCustomerNotify) try {
    const alim = await sendBookingRequestReceivedAlimTalk(alimBookingId, {
      customerPhone: customer.phone,
      bookingNumber: customer.bookingNumber,
      productTitle: customer.productTitle,
      selectedDate: customer.selectedDateLabel,
      paxSummary: customer.paxSummary,
    })
    if (alim.ok) {
      customerNotifyOk = true
    } else if (alim.shouldSendLmsFallback) {
      const lms = await sendBookingRequestReceivedLmsFallback({
        bookingId: alimBookingId,
        customerPhone: customer.phone,
        productTitle: customer.productTitle,
        selectedDate: customer.selectedDateLabel,
        paxSummary: customer.paxSummary,
      })
      customerNotifyOk = lms.ok
      if (!lms.ok) {
        console.error(
          `${tag} customer_lms_failed`,
          JSON.stringify({ ref: logRef, message: lms.message, detail: alim.detail }),
        )
      }
    }
  } catch (e) {
    console.error(`${tag} customer_notification_exception`, e, JSON.stringify({ ref: logRef }))
  }

  let adminSmsSkipped = true
  let adminSmsOk = false
  if (smsEnvOk) {
    adminSmsSkipped = false
    try {
      const r = await sendAdminNotificationWithPayload(bookingForSms, adminPayload)
      adminSmsOk = r.ok
      if (r.ok) {
        console.log(`${tag} sms sent`, JSON.stringify({ ref: logRef }))
      } else {
        console.error(
          `${tag} sms failed:`,
          r.message,
          JSON.stringify({ ref: logRef, code: r.code }),
        )
      }
    } catch (e) {
      console.error(`${tag} sms exception:`, e, JSON.stringify({ ref: logRef }))
    }
  }

  let emailOk = false
  try {
    emailOk = await sendBookingReceivedEmailToAdmin(bookingForEmail, adminPayload, emailAppendix)
    if (emailOk) console.log(`${tag} email sent`, JSON.stringify({ ref: logRef }))
  } catch (e) {
    console.error(`${tag} email failed:`, e, JSON.stringify({ ref: logRef }))
  }

  return {
    emailOk,
    adminSms: { skipped: adminSmsSkipped, ok: adminSmsOk },
    customerNotifyOk,
  }
}
