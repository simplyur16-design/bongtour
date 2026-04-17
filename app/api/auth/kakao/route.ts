import { randomBytes } from 'crypto'
import { NextResponse } from 'next/server'
import {
  KAKAO_OAUTH_REDIRECT_COOKIE,
  KAKAO_OAUTH_STATE_COOKIE,
  buildKakaoOAuthStateCookieOptions,
  kakaoOAuthLog,
  maskKakaoClientId,
  maskKakaoState,
  resolveKakaoOAuthPublicOrigin,
  resolveKakaoRedirectUri,
} from '@/lib/kakao-oauth-public'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const clientId = process.env.KAKAO_CLIENT_ID?.trim()
  if (!clientId) {
    return NextResponse.json({ error: '카카오 OAuth 환경 변수가 누락되었습니다.' }, { status: 500 })
  }

  const publicOrigin = resolveKakaoOAuthPublicOrigin(request)
  const redirectUri = resolveKakaoRedirectUri(request)
  const state = randomBytes(32).toString('hex')
  const { searchParams } = new URL(request.url)
  const cb = searchParams.get('callbackUrl') ?? '/'
  const normalized = cb.startsWith('/') ? cb : `/${cb}`
  const encodedRedirect = encodeURIComponent(normalized)

  const authorize = new URL('https://kauth.kakao.com/oauth/authorize')
  authorize.searchParams.set('client_id', clientId)
  authorize.searchParams.set('redirect_uri', redirectUri)
  authorize.searchParams.set('response_type', 'code')
  authorize.searchParams.set('state', state)

  const cookieOpts = buildKakaoOAuthStateCookieOptions(request)
  kakaoOAuthLog('authorize', {
    nodeEnv: process.env.NODE_ENV,
    publicOrigin,
    redirectUri,
    clientId: maskKakaoClientId(clientId),
    state: maskKakaoState(state),
    cookieSecure: cookieOpts.secure,
    cookieDomain: cookieOpts.domain ?? '(host-only)',
  })

  const res = NextResponse.redirect(authorize.toString())
  res.cookies.set(KAKAO_OAUTH_STATE_COOKIE, state, cookieOpts)
  res.cookies.set(KAKAO_OAUTH_REDIRECT_COOKIE, encodedRedirect, cookieOpts)
  return res
}
