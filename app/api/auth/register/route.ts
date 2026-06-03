import { getPublicMutationOriginError, publicMutationOriginJsonResponse } from '@/lib/public-mutation-origin'
import { emailSignupGoneJsonResponse } from '@/lib/auth-block-email-signup'

function getClientIp(headers: Headers): string {
  const xff = headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]?.trim() || 'unknown'
  return headers.get('x-real-ip') || 'unknown'
}

/** 신규 이메일 회원가입 폐기 — 기존 계정은 /auth/signin credentials 로그인 유지 */
export async function POST(req: Request) {
  const originErr = getPublicMutationOriginError(req)
  if (originErr) return publicMutationOriginJsonResponse(originErr)

  const ip = getClientIp(req.headers)
  return emailSignupGoneJsonResponse('auth.register.email-signup-disabled', { ip })
}
