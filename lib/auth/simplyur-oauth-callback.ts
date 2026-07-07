/**
 * simplyur OAuth callback·앱 딥링크 SSOT — mobile oauth-start / oauth-complete / sign-in catalog 공유.
 * REGRESSION-FREEZE[simplyur-oauth-callback-ssot]: callback path·locale·returnTo — manifest
 */
import {
  SIMPLYUR_DEFAULT_LOCALE,
  isSimplyurLocale,
  simplyurPath,
  type SimplyurLocale,
} from '@/lib/simplyur/constants'

export const SIMPLYUR_MOBILE_SCHEME = 'simplyur' as const

/** 웹→앱 로그인 CTA (sign-in-method-catalog) */
export const SIMPLYUR_MOBILE_SIGN_IN_DEEP_LINK = `${SIMPLYUR_MOBILE_SCHEME}://sign-in` as const

/** OAuth 완료 후 앱 복귀 (openAuthSessionAsync redirectUri) */
export const SIMPLYUR_MOBILE_OAUTH_COMPLETE_DEEP_LINK = `${SIMPLYUR_MOBILE_SCHEME}://oauth-complete` as const

export type OAuthStartReturnTo = 'app' | 'web'

/** 오픈 리다이렉트 방지 — same-origin 상대 경로만 */
export function safeSimplyurOAuthCallbackPath(
  raw: string | null | undefined,
  fallback: string,
): string {
  const v = (raw ?? '').trim()
  if (v.startsWith('/') && !v.startsWith('//')) return v
  return fallback
}

export function parseSimplyurOAuthLocale(raw: string | null | undefined): SimplyurLocale {
  const v = (raw ?? '').trim()
  if (isSimplyurLocale(v)) return v
  return SIMPLYUR_DEFAULT_LOCALE
}

export function parseOAuthStartReturnTo(raw: string | null | undefined): OAuthStartReturnTo {
  return raw === 'app' ? 'app' : 'web'
}

export function simplyurMyEsimPath(locale: SimplyurLocale): string {
  return simplyurPath(locale, '/my-esim')
}

export function simplyurOAuthCompleteWebPath(locale: SimplyurLocale): string {
  return simplyurPath(locale, '/oauth-complete')
}

export function simplyurMobileDeepLink(pathAndQuery: string): string {
  const tail = pathAndQuery.startsWith('/') ? pathAndQuery.slice(1) : pathAndQuery
  return `${SIMPLYUR_MOBILE_SCHEME}://${tail}`
}

/** GET /api/auth/oauth-start — 최종 Auth.js redirectTo */
export function resolveOAuthStartCallbackPath(args: {
  returnTo: OAuthStartReturnTo
  locale: SimplyurLocale
  callbackUrlRaw: string | null | undefined
}): string {
  const fallback = simplyurMyEsimPath(args.locale)
  if (args.returnTo === 'app') {
    return simplyurOAuthCompleteWebPath(args.locale)
  }
  return safeSimplyurOAuthCallbackPath(args.callbackUrlRaw, fallback)
}
