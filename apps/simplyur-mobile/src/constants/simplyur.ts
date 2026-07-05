import { SIMPLYUR_PALETTE } from './palette';

export const SIMPLYUR_LOCALES = ['en', 'ja', 'zh', 'zh-TW', 'vi'] as const;
export type SimplyurLocale = (typeof SIMPLYUR_LOCALES)[number];

export const DEFAULT_LOCALE: SimplyurLocale = 'en';
export const DEFAULT_COUNTRY = 'kr' as const;

/** OAuth + PG pending — show “checkout opening soon” in app. */
export const SIMPLYUR_CHECKOUT_ENABLED = false as const;

export const LOCALE_LABELS: Record<SimplyurLocale, string> = {
  en: 'English',
  ja: '日本語',
  zh: '简体中文',
  'zh-TW': '繁體中文',
  vi: 'Tiếng Việt',
};

export const BRAND = {
  name: 'simplyur',
  parent: 'Bong Tour (봉투어)',
  palette: SIMPLYUR_PALETTE,
} as const;

export function getApiBaseUrl(): string {
  return (
    process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/+$/, '') ||
    'http://localhost:3000'
  );
}
