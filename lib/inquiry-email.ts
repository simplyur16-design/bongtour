import nodemailer from 'nodemailer'

import {
  buildInquiryEmailSubject,
  buildInquiryEmailSummaryBlock,
  inquiryPayloadField,
  parseInquiryPayloadJson,
  resolveInquiryAlertPrefix,
  type InquiryNotifyInput,
} from '@/lib/inquiry-notification-format'

export type { InquiryNotifyInput }

function inquiryTypeLabelLegacy(type: string): string {
  if (type === 'travel_consult') return '여행 상담'
  if (type === 'institution_request') return '기관/단체 문의'
  if (type === 'overseas_training_quote') return '국외연수 문의'
  if (type === 'bus_quote') return '버스 견적 문의'
  return type
}

type InquirySendResult = Awaited<ReturnType<ReturnType<typeof nodemailer.createTransport>['sendMail']>>

/** 비밀번호는 절대 로그하지 않음 */
export function logInquirySmtpEnvPresence(logger: typeof console.error = console.error): void {
  const portRaw = process.env.SMTP_PORT?.trim()
  const secureRaw = process.env.SMTP_SECURE?.trim()
  logger(
    '[inquiry-email] smtp_env_presence',
    JSON.stringify({
      SMTP_HOST: Boolean(process.env.SMTP_HOST?.trim()),
      SMTP_PORT: Boolean(portRaw),
      SMTP_SECURE_defined: secureRaw !== undefined && secureRaw !== '',
      SMTP_USER: Boolean(process.env.SMTP_USER?.trim()),
      SMTP_PASS: Boolean(process.env.SMTP_PASS?.trim()),
      SMTP_FROM_EMAIL: Boolean(process.env.SMTP_FROM_EMAIL?.trim()),
      SMTP_FROM_NAME: Boolean(process.env.SMTP_FROM_NAME?.trim()),
      INQUIRY_NOTIFICATION_EMAIL: Boolean(process.env.INQUIRY_NOTIFICATION_EMAIL?.trim()),
    })
  )
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

export async function sendInquiryReceivedEmail(input: InquiryNotifyInput): Promise<InquirySendResult> {
  const host = process.env.SMTP_HOST?.trim()
  const portRaw = process.env.SMTP_PORT?.trim()
  const user = process.env.SMTP_USER?.trim()
  const pass = process.env.SMTP_PASS?.trim()
  const fromName = process.env.SMTP_FROM_NAME?.trim()
  const fromEmail = process.env.SMTP_FROM_EMAIL?.trim()
  const to = process.env.INQUIRY_NOTIFICATION_EMAIL?.trim()
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
  if (!to) missing.push('INQUIRY_NOTIFICATION_EMAIL')

  if (missing.length) {
    logInquirySmtpEnvPresence(console.error)
    throw new Error(`SMTP 환경변수가 설정되지 않았습니다. (${missing.join(', ')})`)
  }

  const fromNameFinal = fromName as string
  const fromEmailFinal = fromEmail as string
  const toFinal = to as string

  const customerReply = input.applicantEmail?.trim() ?? ''
  const replyTo = looksLikeEmail(customerReply) ? customerReply : undefined

  const prefix = resolveInquiryAlertPrefix(input)
  const payload = parseInquiryPayloadJson(input.payloadJson)
  const serviceScope = inquiryPayloadField(payload, 'serviceScope')
  const organizationName = inquiryPayloadField(payload, 'organizationName')
  const destinationSummary = inquiryPayloadField(payload, 'destinationSummary')
  const departure =
    inquiryPayloadField(payload, 'preferredDepartureDate') !== '-'
      ? inquiryPayloadField(payload, 'preferredDepartureDate')
      : inquiryPayloadField(payload, 'preferredDepartureMonth')
  const trainingPurpose = inquiryPayloadField(payload, 'trainingPurpose')
  const headcount = inquiryPayloadField(payload, 'headcount')

  const subject = buildInquiryEmailSubject(input, prefix)
  const summary = buildInquiryEmailSummaryBlock(input, prefix)

  const text = [
    summary,
    '■ 회신 안내',
    replyTo
      ? '이 메일에 "회신"하면 고객 이메일(Reply-To)로 전달됩니다.'
      : '고객 이메일이 없어 Reply-To 가 설정되지 않았습니다. 아래 연락처로만 회신하세요.',
    '',
    '■ 문의 메타',
    `문의 유형(API): ${input.inquiryType} (${inquiryTypeLabelLegacy(input.inquiryType)})`,
    `접수 시각: ${input.createdAtIso}`,
    `고객명: ${input.applicantName.trim() || '-'}`,
    `고객 연락처: ${input.applicantPhone.trim() || '-'}`,
    `고객 이메일: ${input.applicantEmail?.trim() || '(없음)'}`,
    '',
    `[문의 내용]`,
    input.message?.trim() || '-',
    '',
    `[유입 페이지]`,
    input.sourcePagePath ?? '-',
    '',
    `[국외연수 폼 필드 보조]`,
    `필요한 서비스: ${serviceScope}`,
    `기관명: ${organizationName}`,
    `희망 국가/도시: ${destinationSummary}`,
    `희망 일정/출발 시기: ${departure}`,
    `예상 인원: ${headcount}`,
    `연수 목적: ${trainingPurpose}`,
    '',
    '[payloadJson]',
    input.payloadJson ?? '-',
  ].join('\n')

  const html = `<pre style="font-family:system-ui,Segoe UI,sans-serif;font-size:14px;line-height:1.45;white-space:pre-wrap">${escapeHtml(text)}</pre>`

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    /** 네이버·다수 호스트: 587 + STARTTLS 조합에서 연결 안정화 */
    ...(!secure && port === 587 ? { requireTLS: true as const } : {}),
  })

  const mail: Parameters<typeof transporter.sendMail>[0] = {
    from: { name: fromNameFinal, address: fromEmailFinal },
    to: toFinal,
    subject,
    text,
    html,
  }
  if (replyTo) {
    mail.replyTo = replyTo
  }

  return transporter.sendMail(mail)
}
