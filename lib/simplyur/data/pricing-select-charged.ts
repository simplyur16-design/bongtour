import type { BongsimPriceBlockV1 } from "@/lib/bongsim/contracts/product-master.v1";
import { simplyurSellPriceKrw, SIMPLYUR_PRICE_BASIS_KEY } from "@/lib/simplyur/pricing";

/** simplyur checkout charged unit — after.consumer_krw × 1.05 */
export function selectSimplyurChargedUnitPriceKrw(priceBlock: BongsimPriceBlockV1): {
  basis_key: string;
  unit_krw: number;
} {
  const krw = simplyurSellPriceKrw(priceBlock);
  if (krw == null || krw <= 0) {
    return { basis_key: "missing_simplyur_consumer_price", unit_krw: 0 };
  }
  return { basis_key: SIMPLYUR_PRICE_BASIS_KEY, unit_krw: krw };
}
