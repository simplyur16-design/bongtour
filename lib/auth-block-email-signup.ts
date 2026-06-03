import { jsonWithLeakGuard } from '@/lib/public-response-guard'

/** 고객·관리자 UI에 노출하는 신규 이메일 가입 중단 안내 */
export const EMAIL_SIGNUP_PUBLIC_MESSAGE =
  '현재 신규 가입은 카카오/네이버로만 가능합니다.'

export function logBlockedEmailSignup(
  source: string,
  detail?: Record<string, string | number | boolean | null | undefined>,
) {
  console.warn('[auth] email_signup_blocked', { source, status: 410, ...detail })
}

export function emailSignupGoneJsonResponse(leakTag: string, detail?: Record<string, string>) {
  logBlockedEmailSignup(leakTag, detail)
  return jsonWithLeakGuard(
    { error: EMAIL_SIGNUP_PUBLIC_MESSAGE, code: 'EMAIL_SIGNUP_DISABLED' },
    leakTag,
    { status: 410 },
  )
}
