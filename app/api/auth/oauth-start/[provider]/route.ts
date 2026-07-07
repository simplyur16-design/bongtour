import { type NextRequest } from 'next/server'
import { isSignInMethodEnabled } from '@/lib/auth/sign-in-method-catalog'
import {
  buildOAuthAutoPostHtml,
  isOAuthMobileStartProvider,
  safeOAuthCallbackUrl,
} from '@/lib/auth/oauth-mobile-start'
import { getSiteOrigin } from '@/lib/site-metadata'

export const dynamic = 'force-dynamic'

function authErrorRedirect(origin: string, code: string): Response {
  return Response.redirect(`${origin}/auth/error?error=${encodeURIComponent(code)}`)
}

// REGRESSION-FREEZE[oauth-mobile-get-start]: GET oauth-start → POST signin form — manifest
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ provider: string }> },
): Promise<Response> {
  const origin = getSiteOrigin()
  const { provider } = await ctx.params

  if (!isOAuthMobileStartProvider(provider)) {
    return authErrorRedirect(origin, 'Configuration')
  }
  if (!isSignInMethodEnabled(provider)) {
    return authErrorRedirect(origin, 'Configuration')
  }

  const callbackUrl = safeOAuthCallbackUrl(req.nextUrl.searchParams.get('callbackUrl'))

  const csrfRes = await fetch(`${origin}/api/auth/csrf`, { cache: 'no-store' })
  if (!csrfRes.ok) {
    return authErrorRedirect(origin, 'Configuration')
  }
  const csrfJson = (await csrfRes.json()) as { csrfToken?: string }
  const csrfToken = csrfJson.csrfToken?.trim() ?? ''
  if (!csrfToken) {
    return authErrorRedirect(origin, 'Configuration')
  }

  const html = buildOAuthAutoPostHtml({ provider, callbackUrl, csrfToken })
  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
