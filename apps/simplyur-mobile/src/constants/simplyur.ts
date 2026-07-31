import { SIMPLYUR_PALETTE } from './palette';

/** Sync with BONGTOUR/lib/simplyur/constants.ts — foreign visitors to Korea only */
export const SIMPLYUR_AUDIENCE = 'foreign-visitors-korea-esim' as const;

export const SIMPLYUR_LOCALES = ['en', 'ja', 'zh', 'zh-TW', 'vi'] as const;
export type SimplyurLocale = (typeof SIMPLYUR_LOCALES)[number];

export const DEFAULT_LOCALE: SimplyurLocale = 'en';
export const DEFAULT_COUNTRY = 'kr' as const;

/**
 * Buy → web Eximbay checkout (mobile UI).
 * Override: EXPO_PUBLIC_SIMPLYUR_CHECKOUT_ENABLED=0 to disable.
 */
export function isSimplyurCheckoutEnabled(): boolean {
  const raw = (process.env.EXPO_PUBLIC_SIMPLYUR_CHECKOUT_ENABLED ?? '1').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

/** @deprecated use isSimplyurCheckoutEnabled() */
export const SIMPLYUR_CHECKOUT_ENABLED = true;

export const LOCALE_LABELS: Record<SimplyurLocale, string> = {
  en: 'English',
  ja: '日本語',
  zh: '简体中文',
  'zh-TW': '繁體中文',
  vi: 'Tiếng Việt',
};

export const BRAND = {
  name: 'simplyur',
  audience: SIMPLYUR_AUDIENCE,
  parent: 'Bong Tour Co., Ltd.',
  palette: SIMPLYUR_PALETTE,
  /** Store listing / App Store Connect */
  privacyPolicyPath: '/simplyur/en/legal/privacy',
  supportEmail: 'bongtour24@naver.com',
} as const;

export function getApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/+$/, '');
  if (fromEnv) return fromEnv;
  // Release builds hit production; local Expo Go / __DEV__ defaults to localhost.
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    return 'http://localhost:3000';
  }
  return 'https://bongtong.com';
}

export function simplyurWebLegalUrl(
  locale: SimplyurLocale,
  doc: 'terms' | 'privacy' | 'refund',
): string {
  return `${getApiBaseUrl()}/simplyur/${locale}/legal/${doc}`;
}
