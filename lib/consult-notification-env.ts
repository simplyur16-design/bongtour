import { bookingAdminNotificationRecipient } from '@/lib/booking-email'
import { TEMPLATE_ENV_KEYS, type InquiryCustomerAlimtalkKind } from '@/lib/inquiry-customer-alimtalk'
import { parseSolapiReceiverPhones } from '@/lib/notification-service'

function envSet(name: string): boolean {
  return Boolean(process.env[name]?.trim())
}

/** 운영 점검용 — 비밀값 미포함 */
export function summarizeConsultNotificationEnv() {
  const adminRecipients = parseSolapiReceiverPhones()
  const solapiCore =
    envSet('SOLAPI_API_KEY') && envSet('SOLAPI_API_SECRET') && envSet('SOLAPI_FROM_PHONE')
  const smtpCore =
    envSet('SMTP_HOST') &&
    envSet('SMTP_PORT') &&
    envSet('SMTP_USER') &&
    envSet('SMTP_PASS') &&
    envSet('SMTP_FROM_NAME') &&
    envSet('SMTP_FROM_EMAIL')
  const adminEmailTo = bookingAdminNotificationRecipient()

  const inquiryTemplates = (Object.entries(TEMPLATE_ENV_KEYS) as [InquiryCustomerAlimtalkKind, string][]).map(
    ([kind, envKey]) => ({
      kind,
      envKey,
      set: envSet(envKey),
    }),
  )

  return {
    smtp: {
      coreReady: smtpCore,
      adminRecipientReady: Boolean(adminEmailTo),
      bookingNotificationEmail: envSet('BOOKING_NOTIFICATION_EMAIL'),
      inquiryNotificationEmail: envSet('INQUIRY_NOTIFICATION_EMAIL'),
    },
    solapi: {
      coreReady: solapiCore,
      adminPhonesConfigured: envSet('SOLAPI_ADMIN_PHONES'),
      adminRecipientCount: adminRecipients.length,
      adminSmsWouldSend: solapiCore && adminRecipients.length > 0,
      pfId: envSet('SOLAPI_PFID'),
      bookingRequestTemplate: envSet('SOLAPI_TPL_BOOKING_REQUEST_RECEIVED'),
      customerAlimWouldSend:
        solapiCore && envSet('SOLAPI_PFID') && envSet('SOLAPI_TPL_BOOKING_REQUEST_RECEIVED'),
      customerLmsFallbackReady: solapiCore,
      legacyAdminPhoneSet: envSet('ADMIN_PHONE'),
    },
    inquiryCustomerAlimtalkTemplates: inquiryTemplates,
    staffReplyAlimTemplate: envSet('SOLAPI_TPL_INQUIRY_STAFF_REPLY'),
    wouldSendAnyAdminChannel: smtpCore && Boolean(adminEmailTo) && solapiCore && adminRecipients.length > 0,
    hints: [
      !smtpCore || !adminEmailTo
        ? '관리자 메일: SMTP 7키 + BOOKING_NOTIFICATION_EMAIL 또는 INQUIRY_NOTIFICATION_EMAIL'
        : null,
      !solapiCore || adminRecipients.length === 0
        ? '관리자 문자: SOLAPI_API_KEY/SECRET/FROM_PHONE + SOLAPI_ADMIN_PHONES(ADMIN_PHONE은 미사용)'
        : null,
      !inquiryTemplates.every((t) => t.set)
        ? '상담신청 고객 카톡 4종: SOLAPI_TPL_BUS/TRAINING/INSTITUTION/PRIVATE_QUOTE — 일반 travel_consult는 LMS만'
        : null,
      solapiCore && !envSet('SOLAPI_TPL_BOOKING_REQUEST_RECEIVED')
        ? '패키지 예약 고객 카톡: SOLAPI_TPL_BOOKING_REQUEST_RECEIVED 없으면 LMS 폴백만'
        : null,
      envSet('ADMIN_PHONE') && !envSet('SOLAPI_ADMIN_PHONES')
        ? 'ADMIN_PHONE만 있고 SOLAPI_ADMIN_PHONES가 비어 있음 — 문자 안 감'
        : null,
    ].filter(Boolean) as string[],
  }
}
