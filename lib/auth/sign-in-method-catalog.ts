/**
 * 로그인 수단 SSOT — 5종(이메일 + 소셜 4).
 * env 미설정 시 해당 버튼만 숨김(Apple Developer Active 전에도 코드 배포 가능).
 *
 * REGRESSION-FREEZE[sign-in-audience-split]: 국내 웹=카카오·네이버·이메일 / simplyur 웹=이메일 / simplyur 외국인 전용 앱=Google·Apple·이메일 — manifest
 *
 * 클라이언트 컴포넌트(SignInSocialPanel 등)에서 import — OAuth provider 모듈·node:crypto 체인 금지.
 */
import { SIMPLYUR_DEFAULT_LOCALE, type SimplyurLocale } from '@/lib/simplyur/constants'
import {
  isApplePrivateKeyPemPlausible,
  normalizeApplePrivateKeyPem,
} from '@/lib/auth/apple-private-key-pem'

/**
 * - domestic: 봉투어 웹 `/auth/signin` (한국 거주자·내국인)
 * - globalWeb: simplyur 웹 `/simplyur/.../sign-in` (외국인 방문객, 이메일만)
 * - globalApp: simplyur 모바일 앱 (외국인 전용 eSIM, Google·Apple·이메일)
 */
export type SignInAudience = 'domestic' | 'globalWeb' | 'globalApp'

/** 이메일 제외 — 전체 소셜 4종 */
export const SIGN_IN_SOCIAL_METHODS = ['kakao', 'naver', 'apple', 'google'] as const

/** 국내 웹 — 카카오·네이버 */
export const SIGN_IN_SOCIAL_METHODS_DOMESTIC = ['kakao', 'naver'] as const

/** 해외 앱 — Google·Apple */
export const SIGN_IN_SOCIAL_METHODS_GLOBAL_APP = ['google', 'apple'] as const

/** @deprecated globalWeb에는 소셜 없음 — 앱 전용 */
export const SIGN_IN_SOCIAL_METHODS_GLOBAL = SIGN_IN_SOCIAL_METHODS_GLOBAL_APP

export type SignInSocialMethod = (typeof SIGN_IN_SOCIAL_METHODS)[number]

export const SIGN_IN_METHODS = [...SIGN_IN_SOCIAL_METHODS, 'email'] as const
export type SignInMethod = (typeof SIGN_IN_METHODS)[number]

export type SignInMethodKind = 'oauth_redirect' | 'nextauth_form'

export type SignInMethodDefinition = {
  id: SignInMethod
  kind: SignInMethodKind
  label: string
  /** 메인 화면 CTA 문구 */
  ctaLabel: string
  section: 'domestic' | 'global' | 'email'
  /** NextAuth provider id — apple·google (앱·서버 OAuth) */
  nextAuthProvider?: 'apple' | 'google'
}

export const SIGN_IN_METHOD_DEFINITIONS: Record<SignInMethod, SignInMethodDefinition> = {
  kakao: {
    id: 'kakao',
    kind: 'oauth_redirect',
    label: '카카오',
    ctaLabel: '카카오로 계속하기',
    section: 'domestic',
  },
  naver: {
    id: 'naver',
    kind: 'oauth_redirect',
    label: '네이버',
    ctaLabel: '네이버로 계속하기',
    section: 'domestic',
  },
  apple: {
    id: 'apple',
    kind: 'nextauth_form',
    label: 'Apple',
    ctaLabel: 'Apple로 계속하기',
    section: 'global',
    nextAuthProvider: 'apple',
  },
  google: {
    id: 'google',
    kind: 'nextauth_form',
    label: 'Google',
    ctaLabel: 'Google로 계속하기',
    section: 'global',
    nextAuthProvider: 'google',
  },
  email: {
    id: 'email',
    kind: 'oauth_redirect',
    label: '이메일',
    ctaLabel: '이메일로 로그인',
    section: 'email',
  },
}

/** simplyur 모바일 앱 딥링크 — 외국인 전용 eSIM, Google·Apple 로그인 UI */
export const SIMPLYUR_MOBILE_APP_SCHEME = 'simplyur://sign-in'

export function isSignInMethod(v: string | undefined | null): v is SignInMethod {
  return (SIGN_IN_METHODS as readonly string[]).includes(v ?? '')
}

export function isSignInDetailMethod(v: string | undefined | null): v is 'email' | 'apple' | 'google' {
  return v === 'email' || v === 'apple' || v === 'google'
}

export function signInMethodsForAudience(audience: SignInAudience): SignInMethod[] {
  switch (audience) {
    case 'domestic':
      return ['kakao', 'naver', 'email']
    case 'globalWeb':
      return ['email']
    case 'globalApp':
      return ['email', 'google', 'apple']
    default:
      return ['email']
  }
}

export function signInSocialMethodsForAudience(audience: SignInAudience): readonly SignInSocialMethod[] {
  if (audience === 'domestic') return SIGN_IN_SOCIAL_METHODS_DOMESTIC
  if (audience === 'globalApp') return SIGN_IN_SOCIAL_METHODS_GLOBAL_APP
  return []
}

export function isSignInMethodAllowedForAudience(id: SignInMethod, audience: SignInAudience): boolean {
  return signInMethodsForAudience(audience).includes(id)
}

/** 상세 화면(?method=) — 국내·해외 웹은 이메일만 */
export function isSignInDetailMethodForAudience(
  v: string | undefined | null,
  audience: SignInAudience,
): v is 'email' | 'apple' | 'google' {
  if (!isSignInDetailMethod(v)) return false
  if (audience === 'globalApp') return v === 'email' || v === 'apple' || v === 'google'
  return v === 'email'
}

function kakaoOAuthConfigured(): boolean {
  return Boolean(process.env.KAKAO_CLIENT_ID?.trim() && process.env.KAKAO_CLIENT_SECRET?.trim())
}

function naverOAuthConfigured(): boolean {
  return Boolean(process.env.NAVER_CLIENT_ID?.trim() && process.env.NAVER_CLIENT_SECRET?.trim())
}

/** OAuth env gate — isGoogleOAuthConfigured와 동일 env; 클라이언트 번들에서 provider import 회피 */
function googleOAuthConfigured(): boolean {
  const clientId =
    process.env.AUTH_GOOGLE_ID?.trim() || process.env.GOOGLE_CLIENT_ID?.trim() || ''
  const clientSecret =
    process.env.AUTH_GOOGLE_SECRET?.trim() || process.env.GOOGLE_CLIENT_SECRET?.trim() || ''
  return Boolean(clientId && clientSecret)
}

/** OAuth env gate — isAppleOAuthConfigured와 동일; JWT(.p8) 생성 모듈 import 금지 */
function appleOAuthConfigured(): boolean {
  const clientId = process.env.AUTH_APPLE_ID?.trim() || process.env.APPLE_ID?.trim() || ''
  const staticSecret = process.env.AUTH_APPLE_SECRET?.trim() || ''
  const teamId = process.env.AUTH_APPLE_TEAM_ID?.trim() || process.env.APPLE_TEAM_ID?.trim() || ''
  const keyId = process.env.AUTH_APPLE_KEY_ID?.trim() || process.env.APPLE_KEY_ID?.trim() || ''
  const privateKeyRaw =
    process.env.AUTH_APPLE_PRIVATE_KEY?.trim() || process.env.APPLE_PRIVATE_KEY?.trim() || ''
  if (!clientId) return false
  if (staticSecret) return true
  if (!teamId || !keyId || !privateKeyRaw) return false
  return isApplePrivateKeyPemPlausible(normalizeApplePrivateKeyPem(privateKeyRaw))
}

export function isSignInMethodEnabled(id: SignInMethod): boolean {
  switch (id) {
    case 'kakao':
      return kakaoOAuthConfigured()
    case 'naver':
      return naverOAuthConfigured()
    case 'google':
      return googleOAuthConfigured()
    case 'apple':
      return appleOAuthConfigured()
    case 'email':
      return true
    default:
      return false
  }
}

export type BuildSignInMethodHrefOptions = {
  audience?: SignInAudience
  simplyurLocale?: SimplyurLocale
}

export function buildSignInMethodHref(
  id: SignInMethod,
  callbackUrl: string,
  options?: BuildSignInMethodHrefOptions,
): string {
  const audience = options?.audience ?? 'domestic'
  const q = encodeURIComponent(callbackUrl)

  if (audience === 'globalWeb') {
    const locale = options?.simplyurLocale ?? SIMPLYUR_DEFAULT_LOCALE
    const base = `/simplyur/${locale}/sign-in`
    if (id === 'email') return `${base}?method=email&callbackUrl=${q}`
    return base
  }

  if (audience === 'globalApp') {
    if (id === 'google' || id === 'apple') {
      return `${SIMPLYUR_MOBILE_APP_SCHEME}?method=${id}&callbackUrl=${q}`
    }
    if (id === 'email') {
      return `${SIMPLYUR_MOBILE_APP_SCHEME}?method=email&callbackUrl=${q}`
    }
    return SIMPLYUR_MOBILE_APP_SCHEME
  }

  switch (id) {
    case 'kakao':
      return `/api/auth/kakao?callbackUrl=${q}`
    case 'naver':
      return `/api/auth/naver?callbackUrl=${q}`
    case 'email':
      return `/auth/signin?callbackUrl=${q}`
    case 'google':
    case 'apple':
      return SIMPLYUR_MOBILE_APP_SCHEME
    default:
      return `/auth/signin?callbackUrl=${q}`
  }
}

export function resolveEnabledSignInMethods(): SignInMethod[] {
  return SIGN_IN_METHODS.filter(isSignInMethodEnabled)
}

export function resolveEnabledSocialSignInMethods(): SignInSocialMethod[] {
  return SIGN_IN_SOCIAL_METHODS.filter((id) => isSignInMethodEnabled(id))
}

export function signInMethodTitle(method: SignInMethod): string {
  if (method === 'email') return '이메일로 로그인'
  return `${SIGN_IN_METHOD_DEFINITIONS[method].label}로 로그인`
}
