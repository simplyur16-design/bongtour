import { cookies } from 'next/headers'
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
import {
  isSafeSimplyurOAuthReturnPath,
  simplyurOAuthReturnCookieSetOptions,
} from '@/lib/auth/simplyur-oauth-return-cookie'
import { getSiteOrigin } from '@/lib/site-metadata'

export const dynamic = 'force-dynamic'

function authErrorRedirect(origin: string, code: string): Response {
  return Response.redirect(`${origin}/auth/error?error=${encodeURIComponent(code)}`)
}

// REGRESSION-FREEZE[oauth-mobile-get-start]: GET oauth-start → signIn redirectTo — manifest
// REGRESSION-FREEZE[simplyur-oauth-home-bridge]: set return cookie before signIn — manifest
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

  /** Safety net if Auth.js drops callbackUrl → lands on `/` (bongtour home). */
  if (isSafeSimplyurOAuthReturnPath(callbackUrl)) {
    const jar = await cookies()
    const set = simplyurOAuthReturnCookieSetOptions(callbackUrl)
    jar.set(set.name, set.value, {
      httpOnly: set.httpOnly,
      path: set.path,
      maxAge: set.maxAge,
      sameSite: set.sameSite,
      secure: set.secure,
      ...(set.domain ? { domain: set.domain } : {}),
    })
  }

  /** 서버 signIn — CSRF·PKCE 쿠키를 브라우저에 직접 설정 (HTML auto-POST 대비 안정) */
  return signIn(provider, { redirectTo: callbackUrl })
}
