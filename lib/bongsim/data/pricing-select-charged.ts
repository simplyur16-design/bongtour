import type { BongsimPriceBlockV1 } from "@/lib/bongsim/contracts/product-master.v1";

/**
 * Server-only charged unit selection (same priority family as storefront display: 소비자가 단일).
 */
export function selectChargedUnitPriceKrw(priceBlock: BongsimPriceBlockV1): { basis_key: string; unit_krw: number } {
  const candidates: Array<{ basis_key: string; value: number | null }> = [
    { basis_key: "after.consumer_krw", value: priceBlock.after.consumer_krw },
    { basis_key: "before.consumer_krw", value: priceBlock.before.consumer_krw },
  ];
  for (const c of candidates) {
    if (c.value != null && Number.isFinite(c.value) && c.value >= 0) {
      return { basis_key: c.basis_key, unit_krw: Math.trunc(c.value) };
    }
  }
  return { basis_key: "missing_all_price_cells", unit_krw: 0 };
}
