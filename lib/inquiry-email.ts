import nodemailer from 'nodemailer'

type InquiryMailInput = {
  inquiryId: string
  inquiryType: string
  applicantName: string
  applicantPhone: string
  applicantEmail: string | null
  message: string | null
  sourcePagePath: string | null
  createdAtIso: string
  payloadJson: string | null
}

function inquiryTypeLabel(type: string): string {
  if (type === 'travel_consult') return '여행 상담'
  if (type === 'institution_request') return '기관/단체 문의'
  if (type === 'overseas_training_quote') return '국외연수 문의'
  if (type === 'bus_quote') return '버스 견적 문의'
  return type
}

function parsePayload(json: string | null): Record<string, unknown> {
  if (!json) return {}
  try {
    const parsed = JSON.parse(json)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
    return {}
  } catch {
    return {}
  }
}

function payloadField(payload: Record<string, unknown>, key: string): string {
  const value = payload[key]
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'boolean') return value ? '예' : '아니오'
  return '-'
}

export async function sendInquiryReceivedEmail(input: InquiryMailInput): Promise<void> {
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

  const payload = parsePayload(input.payloadJson)
  const serviceScope = payloadField(payload, 'serviceScope')
  const organizationName = payloadField(payload, 'organizationName')
  const destinationSummary = payloadField(payload, 'destinationSummary')
  const departure =
    payloadField(payload, 'preferredDepartureDate') !== '-'
      ? payloadField(payload, 'preferredDepartureDate')
      : payloadField(payload, 'preferredDepartureMonth')
  const trainingPurpose = payloadField(payload, 'trainingPurpose')
  const headcount = payloadField(payload, 'headcount')

  const subject = `[Bong투어 문의접수] ${inquiryTypeLabel(input.inquiryType)} / ${input.applicantName}`
  const text = [
    'Bong투어 문의가 접수되었습니다.',
    '',
    `문의 ID: ${input.inquiryId}`,
    `접수 유형: ${inquiryTypeLabel(input.inquiryType)} (${input.inquiryType})`,
    `접수 시각: ${input.createdAtIso}`,
    '',
    `[신청자 정보]`,
    `이름: ${input.applicantName}`,
    `연락처: ${input.applicantPhone}`,
    `이메일: ${input.applicantEmail ?? '-'}`,
    '',
    `[국외연수 핵심 정보]`,
    `필요한 서비스: ${serviceScope}`,
    `기관명: ${organizationName}`,
    `희망 국가/도시: ${destinationSummary}`,
    `희망 일정/출발 시기: ${departure}`,
    `예상 인원: ${headcount}`,
    `연수 목적: ${trainingPurpose}`,
    '',
    `[문의 내용]`,
    input.message?.trim() || '-',
    '',
    `[유입 페이지]`,
    input.sourcePagePath ?? '-',
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

  await transporter.sendMail({
    from,
    to: receiver,
    subject,
    text,
  })
}

