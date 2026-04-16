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

export async function sendInquiryReceivedEmail(input: InquiryNotifyInput): Promise<InquirySendResult> {
  const host = process.env.SMTP_HOST?.trim()
  const portRaw = process.env.SMTP_PORT?.trim()
  const user = process.env.SMTP_USER?.trim()
  const pass = process.env.SMTP_PASS?.trim()
  const from = process.env.INQUIRY_MAIL_FROM?.trim() || user
  const receiver = process.env.INQUIRY_RECEIVER_EMAIL?.trim() || 'bongtour24@naver.com'
  const secure = process.env.SMTP_SECURE === 'true'
  const port = Number(portRaw || (secure ? 465 : 587))

  if (!host || !port || !user || !pass || !from) {
    throw new Error('SMTP 환경변수가 설정되지 않았습니다.')
  }

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
    `[기술] API inquiryType: ${input.inquiryType} (${inquiryTypeLabelLegacy(input.inquiryType)})`,
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

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  })

  return transporter.sendMail({
    from,
    to: receiver,
    subject,
    text,
  })
}
