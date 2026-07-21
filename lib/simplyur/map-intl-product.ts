import {
  extractDaysFromDaysRaw,
  type ProductOption,
} from "@/lib/bongsim/recommend/product-option";
import {
  formatSimplyurPerDayFromTotal,
  formatSimplyurPriceFromKrw,
  type SimplyurFxRates,
} from "@/lib/simplyur/currency";
import type { SimplyurLocale } from "@/lib/simplyur/constants";
import { simplyurSellPriceKrw, SIMPLYUR_PRICE_BASIS_KEY } from "@/lib/simplyur/pricing";

export type SimplyurIntlProduct = ProductOption & {
  simplyur_sell_price_krw: number | null;
  simplyur_price_basis: string;
  simplyur_display: {
    currency: string;
    amount: number;
    formatted: string;
  } | null;
  simplyur_display_per_day: {
    currency: string;
    amount: number;
    formatted: string;
  } | null;
};

export function mapProductToSimplyurIntl(
  product: ProductOption,
  locale: SimplyurLocale,
  rates?: SimplyurFxRates,
): SimplyurIntlProduct {
  const sellKrw = simplyurSellPriceKrw(product.price_block);
  const display = sellKrw != null ? formatSimplyurPriceFromKrw(sellKrw, locale, rates) : null;
  const days = extractDaysFromDaysRaw(product.days_raw);
  const perDay =
    display != null && days != null
      ? formatSimplyurPerDayFromTotal(display.amount, days, display.currency, locale)
      : null;
  return {
    ...product,
    recommended_price: sellKrw ?? undefined,
    simplyur_sell_price_krw: sellKrw,
    simplyur_price_basis: SIMPLYUR_PRICE_BASIS_KEY,
    simplyur_display: display
      ? {
          currency: display.currency,
          amount: display.amount,
          formatted: display.formatted,
        }
      : null,
    simplyur_display_per_day:
      display != null && perDay != null
        ? {
            currency: display.currency,
            amount: perDay.amount,
            formatted: perDay.formatted,
          }
        : null,
  };
}
