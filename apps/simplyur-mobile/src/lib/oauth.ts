import { getApiBaseUrl, type SimplyurLocale } from '@/src/constants/simplyur';

/**
 * Legacy web URL helpers (unused by app login/checkout).
 * App auth uses native-oauth + mobile-session; checkout uses in-app WebView.
 */

/** 웹 My eSIM URL (디버그/지원용). 앱 My eSIM은 Bearer API. */
export function buildWebMyEsimUrl(locale: SimplyurLocale): string {
  return `${getApiBaseUrl()}/simplyur/${locale}/my-esim`;
}
