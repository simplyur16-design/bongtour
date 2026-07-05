import type { SimplyurLocale } from "@/lib/simplyur/constants";

export type SimplyurDisplayCurrency = "USD" | "JPY" | "CNY" | "TWD" | "VND";

export const SIMPLYUR_LOCALE_CURRENCY: Record<SimplyurLocale, SimplyurDisplayCurrency> = {
  en: "USD",
  ja: "JPY",
  zh: "CNY",
  "zh-TW": "TWD",
  vi: "VND",
};

/** KRW per 1 unit of display currency (admin/env override 가능) */
export type SimplyurFxRates = Record<SimplyurDisplayCurrency, number>;

const DEFAULT_FX: SimplyurFxRates = {
  USD: 1350,
  JPY: 9.2,
  CNY: 185,
  TWD: 42,
  VND: 0.055,
};

function parseFxEnv(key: string): number | null {
  const raw = process.env[key]?.trim();
  if (!raw) return null;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** 1 display currency unit = N KRW */
export function getSimplyurFxRates(): SimplyurFxRates {
  return {
    USD: parseFxEnv("SIMPLYUR_FX_USD") ?? DEFAULT_FX.USD,
    JPY: parseFxEnv("SIMPLYUR_FX_JPY") ?? DEFAULT_FX.JPY,
    CNY: parseFxEnv("SIMPLYUR_FX_CNY") ?? DEFAULT_FX.CNY,
    TWD: parseFxEnv("SIMPLYUR_FX_TWD") ?? DEFAULT_FX.TWD,
    VND: parseFxEnv("SIMPLYUR_FX_VND") ?? DEFAULT_FX.VND,
  };
}

export function krwToDisplayAmount(
  krw: number,
  currency: SimplyurDisplayCurrency,
  rates: SimplyurFxRates = getSimplyurFxRates(),
): number {
  const rate = rates[currency];
  if (!Number.isFinite(rate) || rate <= 0) return krw;
  const raw = krw / rate;
  if (currency === "JPY" || currency === "VND") return Math.ceil(raw);
  return Math.round(raw * 100) / 100;
}

export function formatSimplyurMoney(
  amount: number,
  currency: SimplyurDisplayCurrency,
  locale: SimplyurLocale,
): string {
  const intlLocale =
    locale === "zh-TW" ? "zh-TW" : locale === "zh" ? "zh-CN" : locale;
  return new Intl.NumberFormat(intlLocale, {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "JPY" || currency === "VND" ? 0 : 2,
  }).format(amount);
}

export function formatSimplyurPriceFromKrw(
  sellPriceKrw: number,
  locale: SimplyurLocale,
  rates?: SimplyurFxRates,
): { currency: SimplyurDisplayCurrency; amount: number; formatted: string; krw: number } {
  const currency = SIMPLYUR_LOCALE_CURRENCY[locale];
  const amount = krwToDisplayAmount(sellPriceKrw, currency, rates);
  return {
    currency,
    amount,
    formatted: formatSimplyurMoney(amount, currency, locale),
    krw: sellPriceKrw,
  };
}
