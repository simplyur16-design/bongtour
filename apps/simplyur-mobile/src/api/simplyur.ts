import { router } from 'expo-router';

import { getApiBaseUrl, type SimplyurLocale } from '@/src/constants/simplyur';

export type PlanProduct = {
  option_api_id: string;
  days?: number | null;
  days_label: string;
  data_label: string;
  plan_summary: string;
  network_family?: string;
  plan_type?: string | null;
  simplyur_display: { formatted: string; currency: string; amount: number } | null;
  simplyur_display_per_day?: { formatted: string; currency: string; amount: number } | null;
};

export type CountryPack = {
  roaming: {
    min_display: { formatted: string } | null;
    products: PlanProduct[];
  };
  local: {
    min_display: { formatted: string } | null;
    products: PlanProduct[];
  } | null;
};

export async function fetchKoreaPlans(locale: SimplyurLocale): Promise<CountryPack | null> {
  const url = `${getApiBaseUrl()}/api/simplyur/products/by-country?locale=${locale}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API ${res.status}`);
  const json = (await res.json()) as { pack?: CountryPack };
  return json.pack ?? null;
}

export async function fetchKoreaProduct(
  optionApiId: string,
  locale: SimplyurLocale,
): Promise<PlanProduct | null> {
  const url = `${getApiBaseUrl()}/api/simplyur/products/${encodeURIComponent(optionApiId)}?locale=${locale}`;
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API ${res.status}`);
  const json = (await res.json()) as { product?: PlanProduct };
  return json.product ?? null;
}

export function simplyurWebCheckoutUrl(
  locale: SimplyurLocale,
  optionApiId: string,
  buyerEmail?: string,
): string {
  const base = getApiBaseUrl().replace(/\/+$/, '');
  const q = new URLSearchParams({ optionApiId });
  const email = (buyerEmail ?? '').trim();
  if (email.includes('@')) q.set('buyerEmail', email.slice(0, 254));
  return `${base}/simplyur/${locale}/checkout?${q.toString()}`;
}

/**
 * Open native in-app checkout screen (form + PAYER_AUTH + server PAYMENT_PA).
 * REGRESSION-FREEZE[simplyur-mobile-inapp-eximbay-checkout]: router → /checkout — manifest
 */
export function openSimplyurInAppCheckout(optionApiId: string): void {
  const id = optionApiId.trim();
  if (!id) return;
  router.push({ pathname: '/checkout', params: { optionApiId: id } });
}

/** @deprecated use openSimplyurInAppCheckout */
export async function openSimplyurWebCheckout(
  _locale: SimplyurLocale,
  optionApiId: string,
): Promise<void> {
  openSimplyurInAppCheckout(optionApiId);
}
