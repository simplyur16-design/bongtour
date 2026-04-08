import { randomBytes } from 'crypto'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const STATE_COOKIE = 'naver_oauth_state'
const REDIRECT_COOKIE = 'naver_oauth_redirect'
const COOKIE_MAX_AGE_SEC = 60 * 10

const cookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: COOKIE_MAX_AGE_SEC,
}

export async function GET(request: Request) {
  const clientId = process.env.NAVER_CLIENT_ID?.trim()
  const redirectUri = process.env.NAVER_CALLBACK_URL?.trim()
  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: '네이버 OAuth 환경 변수가 누락되었습니다.' }, { status: 500 })
  }

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

  const res = NextResponse.redirect(authorize.toString())
  res.cookies.set(STATE_COOKIE, state, cookieOpts)
  res.cookies.set(REDIRECT_COOKIE, encodedRedirect, cookieOpts)
  return res
}
