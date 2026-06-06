import { NextResponse } from 'next/server'
import { jsonWithLeakGuard } from '@/lib/public-response-guard'

export function oauthCallbackServerError(
  provider: 'kakao' | 'naver',
  err: unknown,
  clearStateCookies: (response: NextResponse, request: Request) => void,
  request: Request,
): NextResponse {
  console.error(`[${provider}-oauth] callback:unhandled`, err)
  const detail =
    process.env.NODE_ENV === 'production'
      ? undefined
      : err instanceof Error
        ? err.message
        : String(err)
  const res = jsonWithLeakGuard(
    {
      error: '로그인 처리 중 오류가 발생했습니다.',
      ...(detail !== undefined ? { detail } : {}),
    },
    `auth.${provider}.callback.unhandled`,
    { status: 500 },
  )
  clearStateCookies(res, request)
  return res
}
