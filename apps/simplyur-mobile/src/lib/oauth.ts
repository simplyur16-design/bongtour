import * as Linking from 'expo-linking';

import { getApiBaseUrl, type SimplyurLocale } from '@/src/constants/simplyur';

export type OAuthMobileProvider = 'google' | 'apple';

/** openAuthSessionAsync — 앱 복귀 redirectUri (simplyur://oauth-complete) */
export function mobileOAuthRedirectUri(): string {
  return Linking.createURL('oauth-complete');
}

/** GET /api/auth/oauth-start — locale·returnTo=app SSOT */
export function buildOAuthStartUrl(provider: OAuthMobileProvider, locale: SimplyurLocale): string {
  const base = getApiBaseUrl();
  const params = new URLSearchParams({
    locale,
    returnTo: 'app',
  });
  return `${base}/api/auth/oauth-start/${provider}?${params.toString()}`;
}

/** 이메일 로그인 — 웹 simplyur sign-in → oauth-complete → 앱 딥링크 */
export function buildEmailSignInWebUrl(locale: SimplyurLocale): string {
  const base = getApiBaseUrl();
  const callbackPath = `/simplyur/${locale}/oauth-complete`;
  const params = new URLSearchParams({
    callbackUrl: callbackPath,
  });
  return `${base}/simplyur/${locale}/sign-in?${params.toString()}`;
}

/** RN fetch는 bongtour.com 세션 쿠키를 공유하지 않음 — 웹 My eSIM 브라우저 URL */
export function buildWebMyEsimUrl(locale: SimplyurLocale): string {
  return `${getApiBaseUrl()}/simplyur/${locale}/my-esim`;
}
