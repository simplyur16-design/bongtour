import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'
import {
  exchangeCodeForToken,
  exchangeShortLivedForLongLived,
  getInstagramBusinessAccountId,
  getMetaUserPages,
  tokenExpiresAtFromResponse,
} from '@/lib/meta-graph-client'
import { debugError } from '@/lib/bong-marketing/debug-log'
import { META_OAUTH_STATE_COOKIE, safeMetaStateEqual } from '@/lib/meta-oauth-public'

export const dynamic = 'force-dynamic'

function integrationsRedirect(request: Request, params: Record<string, string>): NextResponse {
  const target = new URL('/admin/marketing/integrations', request.url)
  for (const [k, v] of Object.entries(params)) {
    target.searchParams.set(k, v)
  }
  return NextResponse.redirect(target)
}

/** GET /api/auth/meta/callback */
export async function GET(request: Request) {
  const session = await requireAdmin()
  if (!session?.user) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const oauthErr = url.searchParams.get('error')
  const oauthErrDesc = url.searchParams.get('error_description')

  if (oauthErr) {
    const res = integrationsRedirect(request, { error: oauthErrDesc || oauthErr })
    res.cookies.delete(META_OAUTH_STATE_COOKIE)
    return res
  }

  if (!code || !state) {
    const res = integrationsRedirect(request, { error: 'missing_code_or_state' })
    res.cookies.delete(META_OAUTH_STATE_COOKIE)
    return res
  }

  const cookieStore = await cookies()
  const savedState = cookieStore.get(META_OAUTH_STATE_COOKIE)?.value
  if (!savedState || !safeMetaStateEqual(savedState, state)) {
    const res = integrationsRedirect(request, { error: 'invalid_state' })
    res.cookies.delete(META_OAUTH_STATE_COOKIE)
    return res
  }

  try {
    const shortToken = await exchangeCodeForToken(code)
    const longToken = await exchangeShortLivedForLongLived(shortToken.access_token)
    const pages = await getMetaUserPages(longToken.access_token)

    if (!pages.length) {
      const res = integrationsRedirect(request, { error: 'no_pages' })
      res.cookies.delete(META_OAUTH_STATE_COOKIE)
      return res
    }

    const bongtourPage = pages[0]
    const instagramBusinessId = await getInstagramBusinessAccountId(
      bongtourPage.id,
      bongtourPage.access_token,
    )

    const expiresAt = tokenExpiresAtFromResponse(longToken)

    await prisma.bongMetaConnection.upsert({
      where: { provider: 'meta' },
      update: {
        userAccessToken: longToken.access_token,
        userTokenExpiresAt: expiresAt,
        pageId: bongtourPage.id,
        pageName: bongtourPage.name,
        pageAccessToken: bongtourPage.access_token,
        instagramBusinessId,
        connectedAt: new Date(),
      },
      create: {
        provider: 'meta',
        userAccessToken: longToken.access_token,
        userTokenExpiresAt: expiresAt,
        pageId: bongtourPage.id,
        pageName: bongtourPage.name,
        pageAccessToken: bongtourPage.access_token,
        instagramBusinessId,
        connectedAt: new Date(),
      },
    })

    const res = integrationsRedirect(request, { success: '1' })
    res.cookies.delete(META_OAUTH_STATE_COOKIE)
    return res
  } catch (err) {
    debugError('meta-oauth', 'callback 처리 실패:', err)
    const res = integrationsRedirect(request, {
      error: err instanceof Error ? err.message : 'token_exchange_failed',
    })
    res.cookies.delete(META_OAUTH_STATE_COOKIE)
    return res
  }
}
