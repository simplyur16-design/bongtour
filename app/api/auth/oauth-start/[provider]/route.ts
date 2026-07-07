import { type NextRequest } from 'next/server'
import { signIn } from '@/auth'
import { isSignInMethodEnabled } from '@/lib/auth/sign-in-method-catalog'
import {
  isOAuthMobileStartProvider,
} from '@/lib/auth/oauth-mobile-start'
import {
  parseOAuthStartReturnTo,
  parseSimplyurOAuthLocale,
  resolveOAuthStartCallbackPath,
} from '@/lib/auth/simplyur-oauth-callback'
import { getSiteOrigin } from '@/lib/site-metadata'

export const dynamic = 'force-dynamic'

function authErrorRedirect(origin: string, code: string): Response {
  return Response.redirect(`${origin}/auth/error?error=${encodeURIComponent(code)}`)
}

// REGRESSION-FREEZE[oauth-mobile-get-start]: GET oauth-start → signIn redirectTo — manifest
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

  const locale = parseSimplyurOAuthLocale(req.nextUrl.searchParams.get('locale'))
  const returnTo = parseOAuthStartReturnTo(req.nextUrl.searchParams.get('returnTo'))
  const callbackUrl = resolveOAuthStartCallbackPath({
    returnTo,
    locale,
    callbackUrlRaw: req.nextUrl.searchParams.get('callbackUrl'),
  })

  /** 서버 signIn — CSRF·PKCE 쿠키를 브라우저에 직접 설정 (HTML auto-POST 대비 안정) */
  return signIn(provider, { redirectTo: callbackUrl })
}
