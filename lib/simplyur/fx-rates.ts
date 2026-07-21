import { unstable_cache } from "next/cache";
import {
  getSimplyurFxRates,
  type SimplyurDisplayCurrency,
  type SimplyurFxRates,
} from "@/lib/simplyur/currency";

// REGRESSION-FREEZE[simplyur-fx-daily-price]: ExchangeRate-API → KRW/unit + 12h cache — manifest

export const SIMPLYUR_FX_REVALIDATE_SEC = 12 * 60 * 60;

const DISPLAY_CURRENCIES: readonly SimplyurDisplayCurrency[] = [
  "USD",
  "JPY",
  "CNY",
  "TWD",
  "VND",
] as const;

/** Sanity bands — reject absurd mid-market spikes before caching. */
const FX_BANDS: Record<SimplyurDisplayCurrency, { min: number; max: number }> = {
  USD: { min: 900, max: 2000 },
  JPY: { min: 5, max: 20 },
  CNY: { min: 100, max: 300 },
  TWD: { min: 20, max: 80 },
  VND: { min: 0.03, max: 0.1 },
};

let lastGoodRates: SimplyurFxRates | null = null;

export type ExchangeRateApiUsdLatest = {
  result?: string;
  base_code?: string;
  conversion_rates?: Record<string, number>;
};

function readApiKey(): string | null {
  const key =
    (process.env.SIMPLYUR_EXCHANGE_RATE_API_KEY ?? "").trim() ||
    (process.env.EXCHANGE_RATE_API_KEY ?? "").trim();
  return key || null;
}

export function isSimplyurFxRateInBand(currency: SimplyurDisplayCurrency, rate: number): boolean {
  if (!Number.isFinite(rate) || rate <= 0) return false;
  const band = FX_BANDS[currency];
  return rate >= band.min && rate <= band.max;
}

/**
 * ExchangeRate-API `latest/USD` → Simplyur rates (1 display unit = N KRW).
 * USD KRW = conversion_rates.KRW; other = KRW / conversion_rates[CCY].
 */
export function parseExchangeRateApiUsdBaseToKrwPerUnit(
  payload: ExchangeRateApiUsdLatest,
): SimplyurFxRates | null {
  if (payload.result !== "success") return null;
  if (payload.base_code && payload.base_code !== "USD") return null;
  const rates = payload.conversion_rates;
  if (!rates || typeof rates !== "object") return null;

  const krwPerUsd = rates.KRW;
  if (!Number.isFinite(krwPerUsd) || krwPerUsd <= 0) return null;

  const out = {} as SimplyurFxRates;
  for (const ccy of DISPLAY_CURRENCIES) {
    if (ccy === "USD") {
      out.USD = krwPerUsd;
      continue;
    }
    const perUsd = rates[ccy];
    if (!Number.isFinite(perUsd) || perUsd <= 0) return null;
    out[ccy] = krwPerUsd / perUsd;
  }

  for (const ccy of DISPLAY_CURRENCIES) {
    if (!isSimplyurFxRateInBand(ccy, out[ccy])) return null;
  }
  return out;
}

export async function fetchSimplyurFxRatesFromApi(
  fetchImpl: typeof fetch = fetch,
): Promise<SimplyurFxRates | null> {
  const key = readApiKey();
  if (!key) return null;

  const url = `https://v6.exchangerate-api.com/v6/${encodeURIComponent(key)}/latest/USD`;
  const res = await fetchImpl(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as ExchangeRateApiUsdLatest;
  return parseExchangeRateApiUsdBaseToKrwPerUnit(json);
}

async function loadFreshSimplyurFxRates(): Promise<SimplyurFxRates> {
  const fromApi = await fetchSimplyurFxRatesFromApi();
  if (!fromApi) {
    throw new Error("simplyur_fx_fetch_unavailable");
  }
  lastGoodRates = fromApi;
  return fromApi;
}

/**
 * Server FX SSOT — 12h `unstable_cache`. API miss → last-good → env/default fallback.
 * Does not cache soft failures (throws inside cache loader).
 */
export async function resolveSimplyurFxRates(): Promise<SimplyurFxRates> {
  try {
    return await unstable_cache(loadFreshSimplyurFxRates, ["simplyur-fx-rates-v1"], {
      revalidate: SIMPLYUR_FX_REVALIDATE_SEC,
      tags: ["simplyur-fx-rates"],
    })();
  } catch {
    return lastGoodRates ?? getSimplyurFxRates();
  }
}

/** Test / diagnostics — last successful API snapshot in this process. */
export function getSimplyurFxLastGoodRatesForTests(): SimplyurFxRates | null {
  return lastGoodRates;
}

export function setSimplyurFxLastGoodRatesForTests(rates: SimplyurFxRates | null): void {
  lastGoodRates = rates;
}
