import { randomBytes } from 'crypto'
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { META_OAUTH_STATE_COOKIE, oauthCookieSecureFromRequest } from '@/lib/meta-oauth-public'

export const dynamic = 'force-dynamic'

const META_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_read_user_content',
  'pages_manage_metadata',
  'instagram_basic',
  'instagram_manage_insights',
  'business_management',
  'read_insights',
].join(',')

/** GET /api/auth/meta — Meta OAuth authorize (관리자 전용) */
export async function GET(request: Request) {
  const session = await requireAdmin()
  if (!session?.user) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const appId = process.env.META_APP_ID?.trim()
  const redirectUri = process.env.META_REDIRECT_URI?.trim()
  const apiVersion = process.env.META_GRAPH_API_VERSION?.trim() || 'v22.0'

  if (!appId || !redirectUri) {
    return NextResponse.json(
      { error: 'Meta 환경변수 미설정 (META_APP_ID, META_REDIRECT_URI)' },
      { status: 500 },
    )
  }

  const state = randomBytes(32).toString('hex')
  const authUrl = new URL(`https://www.facebook.com/${apiVersion}/dialog/oauth`)
  authUrl.searchParams.set('client_id', appId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('scope', META_SCOPES)
  authUrl.searchParams.set('response_type', 'code')

  const response = NextResponse.redirect(authUrl.toString())
  response.cookies.set(META_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: oauthCookieSecureFromRequest(request),
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })

  return response
}
