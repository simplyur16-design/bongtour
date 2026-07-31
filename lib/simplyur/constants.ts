/**
 * simplyur SSOT — 한국을 방문하는 외국인 전용 Korea eSIM (앱·웹).
 *
 * - 대상: 한국 입국·체류하는 해외 방문객 (en/ja/zh/vi UI)
 * - 비대상: 한국 거주자·내국인 → 봉심 `/travel/esim` · 봉투어 `/auth/signin` (카카오·네이버·이메일)
 * - 앱: `apps/simplyur-mobile` — Google·Apple·이메일 (외국인 전용)
 * - 웹: `/simplyur/*` — 보조(이메일 로그인; 소셜은 앱만)
 *
 * REGRESSION-FREEZE[simplyur-foreign-audience-ssot]: 외국인 전용 eSIM — manifest
 */
import { isSimplyurCheckoutEnabledClient } from "@/lib/simplyur/checkout/enabled";

export const SIMPLYUR_AUDIENCE = "foreign-visitors-korea-esim" as const;

/** 내국인·거주자용 eSIM (봉심) — simplyur 와 분리 */
export const SIMPLYUR_DOMESTIC_ESIM_HREF = "/travel/esim" as const;

/** 내국인·거주자 로그인 (카카오·네이버·이메일) */
export const SIMPLYUR_DOMESTIC_SIGNIN_HREF = "/auth/signin" as const;

export const SIMPLYUR_BRAND_NAME = "simplyur" as const;

/** PortOne checkout — set NEXT_PUBLIC_SIMPLYUR_CHECKOUT_ENABLED=1 when PG is live. */
export const SIMPLYUR_CHECKOUT_ENABLED = isSimplyurCheckoutEnabledClient();

export const SIMPLYUR_PARENT_LEGAL_NAME = "Bong Tour Co., Ltd." as const;

export const SIMPLYUR_BASE_PATH = "/simplyur" as const;

export const SIMPLYUR_LOCALES = ["en", "ja", "zh", "zh-TW", "vi"] as const;
export type SimplyurLocale = (typeof SIMPLYUR_LOCALES)[number];

export const SIMPLYUR_DEFAULT_LOCALE: SimplyurLocale = "en";

/** Phase 1 — Korea eSIM for visitors only. Additional countries require explicit product work. */
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

/** Compact header chip (phone) — full label stays in the dropdown. */
export const SIMPLYUR_LOCALE_SHORT_LABELS: Record<SimplyurLocale, string> = {
  en: "EN",
  ja: "JA",
  zh: "简",
  "zh-TW": "繁",
  vi: "VI",
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
