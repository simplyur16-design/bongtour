import { randomBytes } from 'crypto'
import { NextResponse } from 'next/server'
import {
  NAVER_OAUTH_REDIRECT_COOKIE,
  NAVER_OAUTH_STATE_COOKIE,
  buildNaverOAuthStateCookieOptions,
  maskNaverClientId,
  maskNaverState,
  naverOAuthLog,
  resolveNaverOAuthPublicOrigin,
  resolveNaverRedirectUri,
} from '@/lib/naver-oauth-public'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const clientId = process.env.NAVER_CLIENT_ID?.trim()
  if (!clientId) {
    return NextResponse.json({ error: '네이버 OAuth 환경 변수가 누락되었습니다.' }, { status: 500 })
  }

  const publicOrigin = resolveNaverOAuthPublicOrigin(request)
  const redirectUri = resolveNaverRedirectUri(request)
  const state = randomBytes(32).toString('hex')
  const { searchParams } = new URL(request.url)
  const cb = searchParams.get('callbackUrl') ?? '/'
  const normalized = cb.startsWith('/') ? cb : `/${cb}`
  const encodedRedirect = encodeURIComponent(normalized)

  const authorize = new URL('https://nid.naver.com/oauth2.0/authorize')
  authorize.searchParams.set('response_type', 'code')
  authorize.searchParams.set('client_id', clientId)
  authorize.searchParams.set('redirect_uri', redirectUri)
  authorize.searchParams.set('state', state)

  const cookieOpts = buildNaverOAuthStateCookieOptions(request)
  naverOAuthLog('authorize', {
    nodeEnv: process.env.NODE_ENV,
    publicOrigin,
    redirectUri,
    clientId: maskNaverClientId(clientId),
    state: maskNaverState(state),
    cookieSecure: cookieOpts.secure,
    cookieDomain: cookieOpts.domain ?? '(host-only)',
  })

  const res = NextResponse.redirect(authorize.toString())
  res.cookies.set(NAVER_OAUTH_STATE_COOKIE, state, cookieOpts)
  res.cookies.set(NAVER_OAUTH_REDIRECT_COOKIE, encodedRedirect, cookieOpts)
  return res
}
