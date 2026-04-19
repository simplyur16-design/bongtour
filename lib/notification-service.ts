import { inquiryTypeLabel } from '@/lib/admin-inquiry'
import { prisma } from '@/lib/prisma'
import { createSolapiAuthorizationHeader } from '@/lib/solapi-auth'
import { buildAdminNotificationMessage, buildAdminNotificationMessageFromPayload } from '@/lib/message-service'
import type { AdminBookingAlertPayload } from '@/lib/booking-alert-payload'
import { buildAdminInquiryLmsBody, type AdminInquiryLmsBodyInput } from '@/lib/admin-inquiry-lms-content'

const SOLAPI_SEND_URL = 'https://api.solapi.com/messages/v4/send'

const MAX_RETRIES = 2

export type BookingForAlert = {
  id: number
  productId: string | number
  productTitle: string
  selectedDate: Date
  adultCount: number
  childBedCount: number
  childNoBedCount: number
  infantCount: number
  totalKrwAmount: number
  totalLocalAmount: number
  localCurrency: string
  customerName: string
  customerPhone: string
  product?: {
    originSource: string
    originCode: string
    title: string
  } | null
}

export type SendAdminNotificationResult =
  | { ok: true }
  | { ok: false; code?: string; message: string }

async function updateBookingNotificationFailed(bookingId: number, errorMessage: string): Promise<void> {
  try {
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        notificationStatus: 'failed',
        notificationError: errorMessage.slice(0, 2000),
      },
    })
  } catch (e) {
    console.error('[notification-service] updateBookingNotificationFailed', e)
  }
}

async function sendSolapiMessage(
  apiKey: string,
  apiSecret: string,
  from: string,
  to: string,
  text: string
): Promise<{ ok: true } | { ok: false; code?: string; message: string }> {
  const authHeader = createSolapiAuthorizationHeader(apiKey, apiSecret)
  const res = await fetch(SOLAPI_SEND_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Authorization: authHeader,
    },
    body: JSON.stringify({ from, to, text }),
  })

  const data = (await res.json().catch(() => ({}))) as {
    statusCode?: string
    errorCode?: string
    statusMessage?: string
    message?: string
  }

  if (!res.ok) {
    const code = data.statusCode ?? data.errorCode ?? String(res.status)
    const message = data.statusMessage ?? data.message ?? res.statusText
    return { ok: false, code, message }
  }
  return { ok: true }
}

/**
 * 솔라피 API로 관리자 휴대폰에 상담 접수 알림 발송.
 * SOLAPI_API_KEY 등 네 변수가 모두 있을 때만 발송한다. 없으면 알림을 건너뛰고 ok(로그·DB 갱신 없음).
 * DB 저장 완료 후 비동기 호출. API 실패 시 DB에 notificationStatus='failed' 기록.
 * 재시도: 최대 MAX_RETRIES 회 (첫 요청 + 재시도).
 */
export async function sendAdminNotification(booking: BookingForAlert): Promise<SendAdminNotificationResult> {
  return sendAdminNotificationWithPayload(booking)
}

export async function sendAdminNotificationWithPayload(
  booking: BookingForAlert,
  payload?: AdminBookingAlertPayload
): Promise<SendAdminNotificationResult> {
  const apiKey = process.env.SOLAPI_API_KEY?.trim()
  const apiSecret = process.env.SOLAPI_API_SECRET?.trim()
  const adminPhone = process.env.ADMIN_PHONE?.trim()
  const senderPhone = process.env.SENDER_PHONE?.trim()

  if (!apiKey || !apiSecret || !adminPhone || !senderPhone) {
    return { ok: true }
  }

  const text = payload ? buildAdminNotificationMessageFromPayload(payload) : buildAdminNotificationMessage(booking)
  const from = senderPhone.replace(/-/g, '').trim()
  const to = adminPhone.replace(/-/g, '').trim()

  let lastResult: SendAdminNotificationResult = { ok: false, message: 'unknown' }
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    lastResult = await sendSolapiMessage(apiKey, apiSecret, from, to, text)
    if (lastResult.ok) {
      await prisma.booking.update({
        where: { id: booking.id },
        data: { notificationStatus: 'sent', notificationError: null },
      })
      return lastResult
    }
    console.error(
      `[sendAdminNotification] bookingId=${booking.id} attempt=${attempt}/${MAX_RETRIES} code=${lastResult.code ?? '-'} message=${lastResult.message}`
    )
    if (attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, 1000))
    }
  }

  const errorMessage = lastResult.code ? `${lastResult.code}: ${lastResult.message}` : lastResult.message
  await updateBookingNotificationFailed(booking.id, errorMessage)
  return lastResult
}

function digitsOnlyPhone(raw: string): string {
  return raw.replace(/\D/g, '')
}

/**
 * 문의 관리자 LMS 수신: `SOLAPI_RECEIVER` 쉼표 구분. trim·빈값 제거·숫자 기준 dedupe.
 * (테스트 라우트 등에서 수신 목록 표시용으로 export)
 */
export function parseSolapiReceiverPhones(): string[] {
  const raw = process.env.SOLAPI_RECEIVER?.trim()
  if (!raw) return []
  const rawParts = raw.split(',')
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of rawParts) {
    const d = digitsOnlyPhone(part.trim())
    if (!d) continue
    if (seen.has(d)) continue
    seen.add(d)
    out.push(d)
  }
  return out
}

export type SendAdminInquiryNotificationResult = {
  /** SOLAPI 키/발신번호 없음 또는 수신 번호 0건 */
  skipped: boolean
  succeeded: string[]
  failed: { to: string; code?: string; message: string }[]
}

function truncateForSms(s: string, max: number): string {
  const t = s.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

export type AdminInquiryNotificationParams = AdminInquiryLmsBodyInput

function buildInquiryCustomerLmsText(p: { inquiryType: string; productLabel: string }): string {
  return [
    '[봉투어] 상담문의가 접수되었습니다.',
    `문의유형: ${inquiryTypeLabel(p.inquiryType)}`,
    `문의상품: ${truncateForSms(p.productLabel, 200)}`,
    '담당자가 확인 후 연락드립니다.',
  ].join('\n')
}

/**
 * 문의 접수 — 관리자 LMS. `SOLAPI_API_KEY`, `SOLAPI_API_SECRET`, `SOLAPI_SENDER`, `SOLAPI_RECEIVER`(쉼표 구분 복수).
 * 키·발신·수신 0건이면 skipped. 고객 LMS·예약 문자 env 와 분리.
 */
export async function sendAdminInquiryNotification(p: AdminInquiryNotificationParams): Promise<SendAdminInquiryNotificationResult> {
  const apiKey = process.env.SOLAPI_API_KEY
  const apiSecret = process.env.SOLAPI_API_SECRET
  const senderRaw = process.env.SOLAPI_SENDER?.trim()

  if (!apiKey || !apiSecret || !senderRaw) {
    return { skipped: true, succeeded: [], failed: [] }
  }

  const recipients = parseSolapiReceiverPhones()
  if (recipients.length === 0) {
    return { skipped: true, succeeded: [], failed: [] }
  }

  const from = digitsOnlyPhone(senderRaw)
  if (!from) {
    return { skipped: true, succeeded: [], failed: [] }
  }

  const text = buildAdminInquiryLmsBody(p)
  const succeeded: string[] = []
  const failed: { to: string; code?: string; message: string }[] = []

  for (const to of recipients) {
    const r = await sendSolapiMessage(apiKey, apiSecret, from, to, text)
    if (r.ok) succeeded.push(to)
    else failed.push({ to, code: r.code, message: r.message })
  }

  if (failed.length === 0) {
    console.log(
      '[sendAdminInquiryNotification] all_succeeded',
      JSON.stringify({ inquiryId: p.inquiryId, succeeded })
    )
  }
  // 부분/전체 실패 로그는 POST /api/inquiries 가 `inquiry_admin_lms_failed` 로 남김

  return { skipped: false, succeeded, failed }
}

/**
 * 문의 접수 — 고객 LMS 폴백 (동일 env·동일 `messages/v4/send` 본문 형식).
 */
export async function sendInquiryCustomerLmsFallback(p: {
  inquiryId: string
  inquiryType: string
  productLabel: string
  applicantPhone: string
}): Promise<SendAdminNotificationResult> {
  const apiKey = process.env.SOLAPI_API_KEY
  const apiSecret = process.env.SOLAPI_API_SECRET
  const senderPhone = process.env.SENDER_PHONE

  if (!apiKey || !apiSecret || !senderPhone) {
    return { ok: true }
  }

  const toDigits = digitsOnlyPhone(p.applicantPhone)
  if (toDigits.length < 10) {
    console.error(
      '[sendInquiryCustomerLmsFallback] skipped invalid_phone',
      JSON.stringify({ inquiryId: p.inquiryId, applicantPhone: p.applicantPhone })
    )
    return { ok: false, message: 'invalid_phone' }
  }

  const from = senderPhone.replace(/-/g, '').trim()
  const text = buildInquiryCustomerLmsText({
    inquiryType: p.inquiryType,
    productLabel: p.productLabel,
  })
  const r = await sendSolapiMessage(apiKey, apiSecret, from, toDigits, text)
  if (!r.ok) {
    console.error(
      '[sendInquiryCustomerLmsFallback] failed',
      JSON.stringify({ inquiryId: p.inquiryId, code: r.code ?? null, message: r.message })
    )
  }
  return r
}

/** @deprecated sendAdminNotification 사용 권장 */
export async function sendBookingAlert(booking: BookingForAlert): Promise<SendAdminNotificationResult> {
  return sendAdminNotification(booking)
}
