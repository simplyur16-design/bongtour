import { type NextRequest } from 'next/server'
import { signIn } from '@/auth'
import { isSignInMethodEnabled } from '@/lib/auth/sign-in-method-catalog'
import {
  isOAuthMobileStartProvider,
  safeOAuthCallbackUrl,
} from '@/lib/auth/oauth-mobile-start'
import { getSiteOrigin } from '@/lib/site-metadata'

export const dynamic = 'force-dynamic'

function authErrorRedirect(origin: string, code: string): Response {
  return Response.redirect(`${origin}/auth/error?error=${encodeURIComponent(code)}`)
}

// REGRESSION-FREEZE[oauth-mobile-get-start]: GET oauth-start — 앱 WebBrowser, POST signin 대체 — manifest
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
  return signIn(provider, { redirectTo: callbackUrl })
}
