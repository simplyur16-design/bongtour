import { extractDaysFromDaysRaw, type ProductOption } from "@/lib/bongsim/recommend/product-option";
import type { SimplyurLocale } from "@/lib/simplyur/constants";
import { formatSimplyurPlanDisplay } from "@/lib/simplyur/plan-display";
import { mapProductToSimplyurIntl } from "@/lib/simplyur/map-intl-product";

/** Client-safe plan row — no Korean DB fields, no ISO codes. */
export type SimplyurPublicProduct = {
  option_api_id: string;
  network_family?: string;
  plan_type?: string | null;
  /** Numeric days from `days_raw` — used by duration-first plan picker. */
  days: number | null;
  days_label: string;
  data_label: string;
  plan_summary: string;
  simplyur_display: {
    currency: string;
    amount: number;
    formatted: string;
  } | null;
  /** KRW 청구 단가 — 첫구매 할인 프리뷰·결제 SSOT */
  simplyur_sell_price_krw: number | null;
};

export function toSimplyurPublicProduct(product: ProductOption, locale: SimplyurLocale): SimplyurPublicProduct {
  const labels = formatSimplyurPlanDisplay(product, locale);
  const intl = mapProductToSimplyurIntl(product, locale);
  return {
    option_api_id: product.option_api_id,
    network_family: product.network_family,
    plan_type: product.plan_type,
    days: extractDaysFromDaysRaw(product.days_raw),
    days_label: labels.daysLabel,
    data_label: labels.dataLabel,
    plan_summary: labels.summary,
    simplyur_display: intl.simplyur_display,
    simplyur_sell_price_krw: intl.simplyur_sell_price_krw,
  };
}
