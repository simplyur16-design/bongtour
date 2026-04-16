/**
 * 문의 스택 **운영 검수** 전용 env 검증.
 * - `npm run verify:inquiry:live` (scripts/local-verify-inquiry-live.ts, sandbox 아님) 에서만 사용.
 * - Ethereal / example.com / 코드 기본 카카오 URL / 빈 값 → 즉시 throw.
 */
import { KAKAO_OPEN_CHAT_URL_FALLBACK } from '@/lib/kakao-open-chat'

export const OPERATIONAL_INQUIRY_VERIFY_ENV_KEYS = [
  'SMTP_HOST',
  'SMTP_USER',
  'SMTP_PASS',
  'INQUIRY_MAIL_FROM',
  'INQUIRY_RECEIVER_EMAIL',
  'NEXT_PUBLIC_KAKAO_OPEN_CHAT_URL',
  'NEXT_PUBLIC_NAVER_TALKTALK_URL',
] as const

export type OperationalInquiryVerifyMaskedLog = {
  smtpHost: string
  inquiryMailFrom: string
  inquiryReceiver: string
  kakao: { host: string; pathname: string }
  naver: { host: string; pathname: string }
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
  const smtpUser = process.env.SMTP_USER?.trim()
  const smtpPass = process.env.SMTP_PASS?.trim()
  const mailFrom = process.env.INQUIRY_MAIL_FROM?.trim()
  const receiver = process.env.INQUIRY_RECEIVER_EMAIL?.trim()
  const kakao = process.env.NEXT_PUBLIC_KAKAO_OPEN_CHAT_URL?.trim()
  const naver = process.env.NEXT_PUBLIC_NAVER_TALKTALK_URL?.trim()

  if (!smtpHost) errors.push('SMTP_HOST 비어 있음')
  else if (isForbiddenSmtpHost(smtpHost)) errors.push('SMTP_HOST 가 테스트용 호스트(ethereal 등)입니다. 실제 SMTP 호스트를 설정하세요.')

  if (!smtpUser) errors.push('SMTP_USER 비어 있음')
  else if (smtpUser.toLowerCase().includes('ethereal')) errors.push('SMTP_USER 에 ethereal 이 포함되어 있습니다.')

  if (!smtpPass) errors.push('SMTP_PASS 비어 있음')

  if (!mailFrom) {
    errors.push('INQUIRY_MAIL_FROM 비어 있음 (SMTP_USER 로 대체 불가 — 운영 검수에서 명시 필수)')
  } else if (isForbiddenEmail(mailFrom)) {
    errors.push('INQUIRY_MAIL_FROM 이 example/ethereal 계열입니다.')
  }

  if (!receiver) {
    errors.push('INQUIRY_RECEIVER_EMAIL 비어 있음 (앱 코드 기본값 폴백으로는 운영 검수 불가)')
  } else if (isForbiddenEmail(receiver)) {
    errors.push('INQUIRY_RECEIVER_EMAIL 이 example/ethereal 계열입니다.')
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

  if (!naver) {
    errors.push('NEXT_PUBLIC_NAVER_TALKTALK_URL 비어 있음')
  } else {
    if (naver.toLowerCase().includes('example.com')) errors.push('NEXT_PUBLIC_NAVER_TALKTALK_URL 에 example.com 이 포함되어 있습니다.')
    try {
      const u = new URL(naver.startsWith('http') ? naver : `https://${naver}`)
      if (u.hostname.toLowerCase() !== 'talk.naver.com') {
        errors.push(`NEXT_PUBLIC_NAVER_TALKTALK_URL 호스트는 talk.naver.com 이어야 합니다. (현재: ${u.hostname})`)
      }
      if (!u.pathname || u.pathname === '/' || u.pathname.length < 3) {
        errors.push('NEXT_PUBLIC_NAVER_TALKTALK_URL 경로에 톡톡 진입 식별자가 없습니다.')
      }
      if (u.protocol !== 'https:') errors.push('NEXT_PUBLIC_NAVER_TALKTALK_URL 은 https:// 권장(운영 검수).')
    } catch {
      errors.push('NEXT_PUBLIC_NAVER_TALKTALK_URL 파싱 실패')
    }
  }

  if (errors.length) {
    throw new Error(
      `운영 검수 env 검증 실패 (${errors.length}건):\n- ${errors.join('\n- ')}\n\n필수 키: ${OPERATIONAL_INQUIRY_VERIFY_ENV_KEYS.join(', ')}`
    )
  }

  const kakaoHp = parseHostPath(kakao!, 'NEXT_PUBLIC_KAKAO_OPEN_CHAT_URL')
  const naverHp = parseHostPath(naver!, 'NEXT_PUBLIC_NAVER_TALKTALK_URL')

  return {
    smtpHost: smtpHost!,
    inquiryMailFrom: maskEmailForLog(mailFrom!),
    inquiryReceiver: maskEmailForLog(receiver!),
    kakao: kakaoHp,
    naver: naverHp,
  }
}
