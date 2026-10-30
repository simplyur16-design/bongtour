import { COUNTRY_OPTIONS } from "@/lib/bongsim/country-options";
import { REGION_PACK_OPTIONS } from "@/lib/bongsim/region-packs";
import { filterProductsByCountry } from "@/lib/bongsim/data/load-products-by-country";
import { loadProductsByCountryCached } from "@/lib/bongsim/data/load-products-by-country-cached";
import { loadAllActiveProductsCached } from "@/lib/bongsim/data/load-all-active-products-cached";
import { getProductDetailByOptionApiIdCached } from "@/lib/bongsim/data/load-product-detail-cached";
import {
  isWellFormedOptionApiId,
  normalizeEsimDestinationCode,
  packHasSellablePlans,
} from "@/lib/bongsim/catalog/esim-sellable-visibility";
import type { ProductOption } from "@/lib/bongsim/recommend/product-option";

// REGRESSION-FREEZE[bongsim-esim-hide-unavailable]: 판매 가능 판정은 ACTIVE_WHERE 로더 재사용(읽기 전용) — manifest

/** 판정 결과 — unknown(DB 장애)은 숨기지 않음(fail-open) */
export type SellableCheck = { ok: true; sellable: boolean } | { ok: false; reason: string };

/** 후보 목적지(국가 ISO2 + 권역 rg-*) 전체 */
export function allEsimDestinationCandidateCodes(): string[] {
  const set = new Set<string>();
  for (const c of COUNTRY_OPTIONS) set.add(c.code.trim().toLowerCase());
  for (const r of REGION_PACK_OPTIONS) set.add(r.code.trim().toLowerCase());
  return [...set];
}

/** 순수 — 활성 카탈로그에서 판매 플랜이 1개 이상인 목적지 코드 */
export function computeSellableDestinationCodes(
  products: ProductOption[],
  candidates: readonly string[],
): string[] {
  const out: string[] = [];
  for (const raw of candidates) {
    const code = normalizeEsimDestinationCode(raw);
    if (!code) continue;
    const res = filterProductsByCountry(products, [code]);
    if (res.ok && packHasSellablePlans(res.individual[code])) out.push(code);
  }
  return out.sort();
}

export async function loadSellableDestinationCodes(): Promise<
  { ok: true; codes: string[] } | { ok: false; reason: string }
> {
  const catalog = await loadAllActiveProductsCached();
  if (!catalog.ok) return { ok: false, reason: catalog.reason };
  return {
    ok: true,
    codes: computeSellableDestinationCodes(catalog.products, allEsimDestinationCandidateCodes()),
  };
}

export async function checkDestinationSellable(rawCode: string): Promise<SellableCheck> {
  const code = normalizeEsimDestinationCode(rawCode);
  if (!code) return { ok: true, sellable: false };
  const res = await loadProductsByCountryCached([code]);
  if (!res.ok) return { ok: false, reason: res.reason };
  return { ok: true, sellable: packHasSellablePlans(res.individual[code]) };
}

export async function checkOptionSellable(rawId: string): Promise<SellableCheck> {
  const id = rawId.trim();
  if (!id || !isWellFormedOptionApiId(id)) return { ok: true, sellable: false };
  const res = await getProductDetailByOptionApiIdCached(id);
  if (res.ok) return { ok: true, sellable: true };
  if (res.reason === "not_found") return { ok: true, sellable: false };
  return { ok: false, reason: res.reason };
}
