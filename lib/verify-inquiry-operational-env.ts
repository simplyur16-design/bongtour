/**
 * 문의 스택 **운영 검수** 전용 env 검증.
 * - `npm run verify:inquiry:live` (scripts/local-verify-inquiry-live.ts, sandbox 아님) 에서만 사용.
 * - Ethereal / example.com / 코드 기본 카카오 URL / 빈 값 → 즉시 throw.
 */
import { KAKAO_OPEN_CHAT_URL_FALLBACK } from '@/lib/kakao-open-chat'

export const OPERATIONAL_INQUIRY_VERIFY_ENV_KEYS = [
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_FROM_NAME',
  'SMTP_FROM_EMAIL',
  'INQUIRY_NOTIFICATION_EMAIL',
  'NEXT_PUBLIC_KAKAO_OPEN_CHAT_URL',
] as const

export type OperationalInquiryVerifyMaskedLog = {
  smtpHost: string
  smtpFromEmail: string
  inquiryNotificationEmail: string
  kakao: { host: string; pathname: string }
}

function maskLocalPart(local: string): string {
  const t = local.trim()
  if (t.length <= 2) return '**'
  return `${t.slice(0, 2)}***`
}

function maskEmailForLog(email: string): string {
  const [local, domain] = email.split('@').map((s) => s?.trim() ?? '')
  if (!domain) return '(invalid)'
  return `${maskLocalPart(local)}@${domain}`
}

function parseHostPath(urlRaw: string, label: string): { host: string; pathname: string } {
  const raw = urlRaw.trim()
  try {
    const u = new URL(raw)
    return { host: u.hostname, pathname: u.pathname || '/' }
  } catch {
    throw new Error(`운영 검수: ${label} URL 파싱 실패 — 올바른 http(s) URL 인지 확인하세요.`)
  }
}

function isForbiddenSmtpHost(host: string): boolean {
  return host.toLowerCase().includes('ethereal')
}

function isForbiddenEmail(addr: string): boolean {
  const a = addr.toLowerCase()
  return a.endsWith('@example.com') || a.includes('@example.org') || a.includes('ethereal.email')
}

/**
 * 운영 검수 시작 전 env 전부 검증. 실패 시 어떤 키가 문제인지 한 번에 나열.
 */
export function assertOperationalInquiryVerifyEnv(): OperationalInquiryVerifyMaskedLog {
  const errors: string[] = []

  const smtpHost = process.env.SMTP_HOST?.trim()
  const smtpPort = process.env.SMTP_PORT?.trim()
  const smtpUser = process.env.SMTP_USER?.trim()
  const smtpPass = process.env.SMTP_PASS?.trim()
  const fromName = process.env.SMTP_FROM_NAME?.trim()
  const fromEmail = process.env.SMTP_FROM_EMAIL?.trim()
  const receiver = process.env.INQUIRY_NOTIFICATION_EMAIL?.trim()
  const kakao = process.env.NEXT_PUBLIC_KAKAO_OPEN_CHAT_URL?.trim()

  if (!smtpHost) errors.push('SMTP_HOST 비어 있음')
  else if (isForbiddenSmtpHost(smtpHost)) errors.push('SMTP_HOST 가 테스트용 호스트(ethereal 등)입니다. 실제 SMTP 호스트를 설정하세요.')

  if (!smtpUser) errors.push('SMTP_USER 비어 있음')
  else if (smtpUser.toLowerCase().includes('ethereal')) errors.push('SMTP_USER 에 ethereal 이 포함되어 있습니다.')

  if (!smtpPass) errors.push('SMTP_PASS 비어 있음')

  if (!smtpPort) errors.push('SMTP_PORT 비어 있음')
  else if (!Number.isFinite(Number(smtpPort)) || Number(smtpPort) <= 0) errors.push('SMTP_PORT 가 유효한 양의 정수가 아님')

  if (!fromName) errors.push('SMTP_FROM_NAME 비어 있음')

  if (!fromEmail) {
    errors.push('SMTP_FROM_EMAIL 비어 있음')
  } else if (isForbiddenEmail(fromEmail)) {
    errors.push('SMTP_FROM_EMAIL 이 example/ethereal 계열입니다.')
  }

  if (!receiver) {
    errors.push('INQUIRY_NOTIFICATION_EMAIL 비어 있음')
  } else if (isForbiddenEmail(receiver)) {
    errors.push('INQUIRY_NOTIFICATION_EMAIL 이 example/ethereal 계열입니다.')
  }

  if (!kakao) {
    errors.push('NEXT_PUBLIC_KAKAO_OPEN_CHAT_URL 비어 있음')
  } else {
    const kNorm = kakao.replace(/\/$/, '')
    const fNorm = KAKAO_OPEN_CHAT_URL_FALLBACK.replace(/\/$/, '')
    if (kNorm.toLowerCase() === fNorm.toLowerCase()) {
      errors.push(
        `NEXT_PUBLIC_KAKAO_OPEN_CHAT_URL 이 코드 기본값과 동일합니다. 실제 운영 오픈채팅(또는 채널) URL을 넣으세요. (기본값: ${KAKAO_OPEN_CHAT_URL_FALLBACK})`
      )
    }
    try {
      const u = new URL(kakao)
      if (u.protocol !== 'https:' && u.protocol !== 'http:') errors.push('카카오 URL scheme 이 http(s) 가 아닙니다.')
    } catch {
      errors.push('NEXT_PUBLIC_KAKAO_OPEN_CHAT_URL 파싱 실패')
    }
  }

  if (errors.length) {
    throw new Error(
      `운영 검수 env 검증 실패 (${errors.length}건):\n- ${errors.join('\n- ')}\n\n필수 키: ${OPERATIONAL_INQUIRY_VERIFY_ENV_KEYS.join(', ')}`
    )
  }

  const kakaoHp = parseHostPath(kakao!, 'NEXT_PUBLIC_KAKAO_OPEN_CHAT_URL')

  return {
    smtpHost: smtpHost!,
    smtpFromEmail: maskEmailForLog(fromEmail!),
    inquiryNotificationEmail: maskEmailForLog(receiver!),
    kakao: kakaoHp,
  }
}
