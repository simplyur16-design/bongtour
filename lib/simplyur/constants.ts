/** simplyur — foreign visitors to Korea (en/ja/zh/vi UI). bongsim stays Korean-first for domestic users. */
export const SIMPLYUR_BRAND_NAME = "simplyur" as const;

/** OAuth + PG pending — catalog/guide only; checkout UI shows “coming soon”. */
export const SIMPLYUR_CHECKOUT_ENABLED = false as const;

export const SIMPLYUR_PARENT_LEGAL_NAME = "Bong Tour Co., Ltd." as const;

export const SIMPLYUR_BASE_PATH = "/simplyur" as const;

export const SIMPLYUR_LOCALES = ["en", "ja", "zh", "zh-TW", "vi"] as const;
export type SimplyurLocale = (typeof SIMPLYUR_LOCALES)[number];

export const SIMPLYUR_DEFAULT_LOCALE: SimplyurLocale = "en";

/** Phase 1 — Korea eSIM only. Additional countries require explicit product work. */
export const SIMPLYUR_COUNTRY_CODES = ["kr"] as const;
export type SimplyurCountryCode = (typeof SIMPLYUR_COUNTRY_CODES)[number];

/** Primary market country code (alias for the single Phase 1 entry). */
export const SIMPLYUR_MARKET_COUNTRY: SimplyurCountryCode = "kr";

export const SIMPLYUR_DEFAULT_COUNTRY: SimplyurCountryCode = "kr";

export const SIMPLYUR_LOCALE_LABELS: Record<SimplyurLocale, string> = {
  en: "English",
  ja: "日本語",
  zh: "简体中文",
  "zh-TW": "繁體中文",
  vi: "Tiếng Việt",
};

export function isSimplyurLocale(v: string): v is SimplyurLocale {
  return (SIMPLYUR_LOCALES as readonly string[]).includes(v);
}

export function isSimplyurCountryCode(v: string): v is SimplyurCountryCode {
  return (SIMPLYUR_COUNTRY_CODES as readonly string[]).includes(v.toLowerCase());
}

export function simplyurPath(locale: SimplyurLocale, sub = ""): string {
  const base = `${SIMPLYUR_BASE_PATH}/${locale}`;
  if (!sub) return base;
  const normalized = sub.startsWith("/") ? sub : `/${sub}`;
  return `${base}${normalized}`;
}
