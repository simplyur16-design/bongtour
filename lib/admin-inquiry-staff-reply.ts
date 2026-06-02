import nodemailer from 'nodemailer'
import { SolapiMessageService } from 'solapi'
import { isInquiryAdminStatus } from '@/lib/admin-inquiry'

function digitsOnlyPhone(raw: string): string {
  return raw.replace(/\D/g, '')
}

function isPlausibleKrSmsTo(digits: string): boolean {
  return digits.length >= 10 && digits.length <= 15
}

export type StaffReplyChannel = 'email' | 'sms' | 'alimtalk'

export type StaffInquiryReplyInput = {
  inquiryNumber: string
  applicantName: string
  applicantPhone: string
  applicantEmail: string | null
  replyText: string
  channel: StaffReplyChannel
}

export type StaffInquiryReplyResult =
  | { ok: true; channel: StaffReplyChannel; detail?: string }
  | { ok: false; channel: StaffReplyChannel; error: string }

function truncateForSms(s: string, max: number): string {
  const t = s.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

function buildReplySmsBody(inquiryNumber: string, replyText: string): string {
  return [
    '[봉투어] 문의 답변',
    `접수번호: ${inquiryNumber}`,
    '',
    truncateForSms(replyText, 900),
  ].join('\n')
}

export async function sendStaffInquiryReply(input: StaffInquiryReplyInput): Promise<StaffInquiryReplyResult> {
  const reply = input.replyText.trim()
  if (!reply) {
    return { ok: false, channel: input.channel, error: '답변 내용을 입력해 주세요.' }
  }

  if (input.channel === 'email') {
    const to = input.applicantEmail?.trim()
    if (!to || !to.includes('@')) {
      return { ok: false, channel: 'email', error: '고객 이메일이 없어 이메일 발송을 할 수 없습니다.' }
    }

    const host = process.env.SMTP_HOST?.trim()
    const portRaw = process.env.SMTP_PORT?.trim()
    const user = process.env.SMTP_USER?.trim()
    const pass = process.env.SMTP_PASS?.trim()
    const fromName = process.env.SMTP_FROM_NAME?.trim() ?? '봉투어'
    const fromEmail = process.env.SMTP_FROM_EMAIL?.trim()
    const secure = process.env.SMTP_SECURE === 'true'
    const port = Number(portRaw || (secure ? 465 : 587))

    if (!host || !fromEmail || !user || !pass) {
      return { ok: false, channel: 'email', error: 'SMTP 설정이 없어 이메일을 보낼 수 없습니다.' }
    }

    const subject = `[봉투어] 문의 답변 (${input.inquiryNumber})`
    const text = [
      `${input.applicantName}님, 안녕하세요. 봉투어입니다.`,
      '',
      reply,
      '',
      `— 접수번호 ${input.inquiryNumber}`,
    ].join('\n')

    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
        ...(!secure && port === 587 ? { requireTLS: true as const } : {}),
      })
      await transporter.sendMail({
        from: { name: fromName, address: fromEmail },
        to,
        subject,
        text,
      })
      return { ok: true, channel: 'email' }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { ok: false, channel: 'email', error: msg }
    }
  }

  const apiKey = process.env.SOLAPI_API_KEY?.trim()
  const apiSecret = process.env.SOLAPI_API_SECRET?.trim()
  const senderRaw = process.env.SOLAPI_FROM_PHONE?.trim()
  if (!apiKey || !apiSecret || !senderRaw) {
    return { ok: false, channel: input.channel, error: '문자 발송(Solapi) 환경변수가 설정되지 않았습니다.' }
  }

  const to = digitsOnlyPhone(input.applicantPhone)
  if (!to || !isPlausibleKrSmsTo(to)) {
    return { ok: false, channel: input.channel, error: '유효한 고객 휴대폰 번호가 없습니다.' }
  }

  const from = digitsOnlyPhone(senderRaw)
  if (!from || !isPlausibleKrSmsTo(from)) {
    return { ok: false, channel: input.channel, error: '발신번호 설정이 올바르지 않습니다.' }
  }

  const text = buildReplySmsBody(input.inquiryNumber, reply)

  if (input.channel === 'alimtalk') {
    const pfId = process.env.SOLAPI_PFID?.trim()
    const templateId = process.env.SOLAPI_TPL_INQUIRY_STAFF_REPLY?.trim()
    if (pfId && templateId) {
      try {
        const svc = new SolapiMessageService(apiKey, apiSecret)
        await svc.send({
          to,
          from,
          type: 'ATA',
          kakaoOptions: {
            pfId,
            templateId,
            variables: {
              '#{inquiryNumber}': input.inquiryNumber,
              '#{reply}': truncateForSms(reply, 500),
              '#{name}': input.applicantName.slice(0, 40),
            },
          },
        })
        return { ok: true, channel: 'alimtalk' }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.warn('[admin-inquiry-staff-reply] alimtalk_failed_lms_fallback', msg)
      }
    }
  }

  try {
    const svc = new SolapiMessageService(apiKey, apiSecret)
    await svc.send({ from, to, text })
    return {
      ok: true,
      channel: input.channel,
      detail: input.channel === 'alimtalk' ? 'alimtalk_template_missing_or_failed_sent_as_lms' : undefined,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, channel: input.channel, error: msg }
  }
}

export function parseStaffReplyChannel(v: unknown): StaffReplyChannel | null {
  if (v === 'email' || v === 'sms' || v === 'alimtalk') return v
  return null
}

export function parseOptionalInquiryStatus(v: unknown): string | null {
  if (typeof v !== 'string' || !v.trim()) return null
  return isInquiryAdminStatus(v.trim()) ? v.trim() : null
}
