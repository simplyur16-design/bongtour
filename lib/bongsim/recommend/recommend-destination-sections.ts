/**
 * REGRESSION-FREEZE[bongsim-price-effective-from]: hide region packs without sellable SKU — manifest
 */
import type { CountryCatalogMeta } from "@/lib/bongsim/data/list-country-catalog-meta";
import { REGION_PACK_OPTIONS } from "@/lib/bongsim/region-packs";
import { applyCatalogMeta } from "@/lib/bongsim/recommend/apply-catalog-meta";
import { RECOMMEND_POPULAR_CODES } from "@/lib/bongsim/home-data";
import {
  regionPackGridLabel,
  USIMSA_MULTI_TAB_ORDER,
} from "@/lib/bongsim/recommend/region-pack-plan";
import type { CountryOption } from "@/lib/bongsim/types";
import type { UsimsaPickerItem } from "@/lib/bongsim/recommend/usimsa-picker-item";

export function buildRecommendPopularCountries(
  countryChoices: CountryOption[],
  catalogMeta: Record<string, CountryCatalogMeta> = {},
): CountryOption[] {
  return RECOMMEND_POPULAR_CODES.map((code) => {
    const found = countryChoices.find((c) => c.code === code);
    if (!found) return null;
    return applyCatalogMeta(found, catalogMeta[code]);
  }).filter(Boolean) as CountryOption[];
}

/** usimsa 다국가 탭 — plan_name 라벨 + catalogMeta */
export function buildAllMultiCountryTiles(
  catalogMeta: Record<string, CountryCatalogMeta>,
): UsimsaPickerItem[] {
  const byCode = new Map(REGION_PACK_OPTIONS.map((c) => [c.code, c]));

  return USIMSA_MULTI_TAB_ORDER.map((code) => {
    const base = byCode.get(code);
    if (!base) return null;
    const meta = catalogMeta[code];
    // REGRESSION-FREEZE[bongsim-caucasus-transit-pack]: 판매 SKU 없는 권역(9/1 전 신규팩) 타일 숨김 — manifest
    if (meta?.hasSellableSku !== true) return null;
    const merged = applyCatalogMeta(base, meta);
    return {
      ...merged,
      displayNameKr: regionPackGridLabel(code, merged),
    };
  }).filter(Boolean) as UsimsaPickerItem[];
}

export function filterRecommendMultiPacks(
  query: string,
  catalogMeta: Record<string, CountryCatalogMeta>,
): UsimsaPickerItem[] {
  const packs = buildAllMultiCountryTiles(catalogMeta);
  const q = query.trim().toLowerCase();
  if (!q) return packs;
  return packs.filter(
    (c) =>
      c.displayNameKr?.toLowerCase().includes(q) ||
      c.nameKr.toLowerCase().includes(q) ||
      c.subtitleKr?.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      (c.searchTerms?.some((s) => s.toLowerCase().includes(q)) ?? false),
  );
}

export { USIMSA_MULTI_TAB_ORDER as RECOMMEND_CATALOG_META_REGION_CODES } from "@/lib/bongsim/recommend/region-pack-plan";
