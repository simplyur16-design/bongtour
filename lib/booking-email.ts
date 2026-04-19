import nodemailer from 'nodemailer'

import type { AdminBookingAlertPayload } from '@/lib/booking-alert-payload'
import { formatDepartureDate, formatPaxSummary } from '@/lib/message-service'
import { formatOriginSourceForDisplay } from '@/lib/supplier-origin'

/** `POST /api/bookings` 직후 `prisma.booking.create` 결과 + `include: { product: true }` */
export type BookingRowForAdminEmail = {
  id: number
  productId: string
  productTitle: string
  selectedDate: Date
  createdAt: Date
  pricingMode: string | null
  adultCount: number
  childBedCount: number
  childNoBedCount: number
  infantCount: number
  totalKrwAmount: number
  totalLocalAmount: number
  localCurrency: string
  customerName: string
  customerPhone: string
  customerEmail: string | null
  requestNotes: string | null
  preferredContactChannel: string | null
  singleRoomRequested: boolean
  childInfantBirthDatesJson: string | null
  originSourceSnapshot: string | null
  originCodeSnapshot: string | null
  product?: {
    originSource: string
    originCode: string
    title: string
    supplierProductCode?: string | null
  } | null
}

function formatReceivedAtSeoul(d: Date): string {
  return d.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul', hour12: false }).slice(0, 16)
}

function safeDepartureLine(d: Date): string {
  if (Number.isNaN(d.getTime())) return '출발일 미확인'
  return formatDepartureDate(d)
}

/** 공백·null·undefined → 빈 문자열 */
function normText(s: string | null | undefined): string {
  return (s ?? '').trim()
}

function formatPreferredContactForAdmin(raw: string | null | undefined): string {
  const k = normText(raw).toLowerCase()
  if (!k) return '미지정'
  if (k === 'phone') return '전화'
  if (k === 'kakao') return '카카오톡'
  if (k === 'email') return '이메일'
  return normText(raw) || '미지정'
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function looksLikeEmail(s: string): boolean {
  const t = s.trim()
  return t.length > 3 && t.includes('@') && !t.includes(' ')
}

/** 예약 전용 수신 없으면 문의 수신으로 폴백(운영 단일 수신함) */
export function bookingAdminNotificationRecipient(): string | null {
  const bookingTo = process.env.BOOKING_NOTIFICATION_EMAIL?.trim()
  if (bookingTo) return bookingTo
  return process.env.INQUIRY_NOTIFICATION_EMAIL?.trim() || null
}

export function logBookingSmtpEnvPresence(logger: typeof console.error = console.error): void {
  const portRaw = process.env.SMTP_PORT?.trim()
  const secureRaw = process.env.SMTP_SECURE?.trim()
  logger(
    '[booking-email] smtp_env_presence',
    JSON.stringify({
      SMTP_HOST: Boolean(process.env.SMTP_HOST?.trim()),
      SMTP_PORT: Boolean(portRaw),
      SMTP_SECURE_defined: secureRaw !== undefined && secureRaw !== '',
      SMTP_USER: Boolean(process.env.SMTP_USER?.trim()),
      SMTP_PASS: Boolean(process.env.SMTP_PASS?.trim()),
      SMTP_FROM_EMAIL: Boolean(process.env.SMTP_FROM_EMAIL?.trim()),
      SMTP_FROM_NAME: Boolean(process.env.SMTP_FROM_NAME?.trim()),
      BOOKING_NOTIFICATION_EMAIL: Boolean(process.env.BOOKING_NOTIFICATION_EMAIL?.trim()),
      INQUIRY_NOTIFICATION_EMAIL: Boolean(process.env.INQUIRY_NOTIFICATION_EMAIL?.trim()),
    })
  )
}

export function buildBookingAdminEmailSubject(booking: BookingRowForAdminEmail): string {
  const name = normText(booking.customerName)
  const title = normText(booking.productTitle) || '상품명 미확인'
  if (name && title) return `[예약요청접수] ${name} / ${title}`
  if (title) return `[예약요청접수] ${title}`
  return `[예약요청접수] 예약 #${booking.id}`
}

export function buildBookingAdminEmailText(
  booking: BookingRowForAdminEmail,
  adminPayload: AdminBookingAlertPayload
): string {
  const listBase = adminPayload.adminLink.trim().replace(/\/$/, '')
  const detailLink = `${listBase}/${booking.id}`
  const departureLine = safeDepartureLine(booking.selectedDate)
  const receivedAt = Number.isNaN(booking.createdAt.getTime())
    ? '시각 미확인'
    : formatReceivedAtSeoul(booking.createdAt)

  const originRaw = normText(
    booking.originSourceSnapshot ?? booking.product?.originSource ?? adminPayload.originSource
  )
  const supplierName =
    formatOriginSourceForDisplay(originRaw || undefined) || originRaw || '공급사 미확인'

  const codeRaw = normText(booking.originCodeSnapshot ?? booking.product?.originCode)
  const codeAux = normText(booking.product?.supplierProductCode ?? undefined)
  const supplierProductNo = codeRaw || codeAux || '상품번호 미확인'

  const totalPax =
    booking.adultCount + booking.childBedCount + booking.childNoBedCount + booking.infantCount
  const paxLine = formatPaxSummary({
    productTitle: booking.productTitle,
    selectedDate: booking.selectedDate,
    adultCount: booking.adultCount,
    childBedCount: booking.childBedCount,
    childNoBedCount: booking.childNoBedCount,
    infantCount: booking.infantCount,
    totalKrwAmount: booking.totalKrwAmount,
    totalLocalAmount: booking.totalLocalAmount,
    localCurrency: booking.localCurrency,
    customerName: booking.customerName,
    customerPhone: booking.customerPhone,
    product: booking.product ?? undefined,
  })
  const births = adminPayload.childInfantBirthDates.length
    ? adminPayload.childInfantBirthDates.join('\n')
    : '-'
  const notes = (booking.requestNotes ?? adminPayload.requestNotes ?? '-').trim() || '-'
  const prefChannel = formatPreferredContactForAdmin(
    booking.preferredContactChannel ?? adminPayload.preferredContactChannel
  )

  const displayTitle = normText(booking.productTitle) || '상품명 미확인'
  const displayCustomerName = normText(booking.customerName) || '고객명 미확인'
  const displayPhone = normText(booking.customerPhone) || '연락처 미확인'
  const displayEmail = normText(booking.customerEmail) || '(없음)'

  const lines: string[] = [
    '━━━━━━━━━━━━━━━━',
    '■ 예약 요청 접수',
    '━━━━━━━━━━━━━━━━',
    `접수번호: ${booking.id}`,
    `접수시각: ${receivedAt}`,
    `공급사: ${supplierName}`,
    `상품번호: ${supplierProductNo}`,
    `상품명: ${displayTitle}`,
    `출발일: ${departureLine}`,
    `인원: 총 ${totalPax}명 (${paxLine})`,
    '',
    `고객명: ${displayCustomerName}`,
    `연락처: ${displayPhone}`,
    `이메일: ${displayEmail}`,
    `선호 연락 방식: ${prefChannel}`,
    '',
    '■ 관리자 확인',
    `목록: ${adminPayload.adminLink}`,
    `상세: ${detailLink}`,
    '',
    '■ 추가 정보',
    `요금 반영 방식: ${normText(booking.pricingMode) || '-'}`,
    `1인실 요청: ${booking.singleRoomRequested ? '예' : '아니오'}`,
    '',
    '■ 아동·유아 생년월일',
    births,
    '',
    '■ 요청사항',
    notes,
  ]

  const debugOn =
    process.env.BOOKING_ADMIN_EMAIL_DEBUG === '1' ||
    process.env.BOOKING_ADMIN_EMAIL_DEBUG === 'true'

  if (debugOn) {
    lines.push(
      '',
      '[개발 참고]',
      `internal productId: ${booking.productId}`,
      `departureRowId: ${adminPayload.departureRowId?.trim() || '-'}`,
      `preferredOrSelectedDate(필드): ${adminPayload.preferredOrSelectedDate ?? '-'}`,
      '알림 페이로드(요약 JSON):',
      JSON.stringify(
        {
          customerName: adminPayload.customerName,
          customerPhone: adminPayload.customerPhone,
          customerEmail: adminPayload.customerEmail,
          departureRowId: adminPayload.departureRowId,
          preferredOrSelectedDate: adminPayload.preferredOrSelectedDate,
          paxSummary: adminPayload.paxSummary,
          singleRoomRequested: adminPayload.singleRoomRequested,
          preferredContactChannel: adminPayload.preferredContactChannel,
        },
        null,
        2
      ),
      '',
      'childInfantBirthDatesJson (원문):',
      booking.childInfantBirthDatesJson?.trim() || '-'
    )
  }

  lines.push('━━━━━━━━━━━━━━━━')
  return lines.join('\n')
}

/**
 * 예약 접수 후 관리자 SMTP 메일.
 * SMTP_* 미설정 또는 수신(To) 없으면 발송 생략(throw 없음) → `false` 반환.
 * 문의 메일(`lib/inquiry-email.ts`)과 동일 SMTP 계정·다른 수신(BOOKING_NOTIFICATION_EMAIL 우선) 사용 가능.
 */
export async function sendBookingReceivedEmailToAdmin(
  booking: BookingRowForAdminEmail,
  adminPayload: AdminBookingAlertPayload
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
  else if (!Number.isFinite(port) || port <= 0) missing.push('SMTP_PORT(유효한 양의 정수 필요)')
  if (!user) missing.push('SMTP_USER')
  if (!pass) missing.push('SMTP_PASS')
  if (!fromName) missing.push('SMTP_FROM_NAME')
  if (!fromEmail) missing.push('SMTP_FROM_EMAIL')
  if (!to) missing.push('BOOKING_NOTIFICATION_EMAIL 또는 INQUIRY_NOTIFICATION_EMAIL')

  if (missing.length) {
    logBookingSmtpEnvPresence(console.warn)
    console.warn('[booking-email] skipped:', missing.join(', '))
    return false
  }

  const subject = buildBookingAdminEmailSubject(booking)
  const text = buildBookingAdminEmailText(booking, adminPayload)
  const html = `<pre style="font-family:system-ui,Segoe UI,sans-serif;font-size:14px;line-height:1.45;white-space:pre-wrap">${escapeHtml(text)}</pre>`

  const customerReply = booking.customerEmail?.trim() ?? ''
  const replyTo = looksLikeEmail(customerReply) ? customerReply : undefined

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    ...(!secure && port === 587 ? { requireTLS: true as const } : {}),
  })

  const mail: Parameters<typeof transporter.sendMail>[0] = {
    from: { name: fromName!, address: fromEmail! },
    to: to!,
    subject,
    text,
    html,
  }
  if (replyTo) {
    mail.replyTo = replyTo
  }

  await transporter.sendMail(mail)
  return true
}
