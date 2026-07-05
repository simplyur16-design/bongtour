import type { CountryCatalogMeta } from "@/lib/bongsim/data/list-country-catalog-meta";
import { REGION_PACK_OPTIONS } from "@/lib/bongsim/region-packs";
import type { CountryOption } from "@/lib/bongsim/types";

/** region-packs 정적 무제한 — DB 메타 실패 시에도 다국가 배지 유지 */
const STATIC_UNLIMITED_CODES = new Set(
  REGION_PACK_OPTIONS.filter((c) => c.isUnlimited === true).map((c) => c.code.toLowerCase()),
);

/** API catalogMeta + 정적 isUnlimited(권역 패키지) 병합 */
export function applyCatalogMeta(country: CountryOption, meta?: CountryCatalogMeta): CountryOption {
  const code = country.code.trim().toLowerCase();
  const hasUnlimited =
    meta?.isUnlimited === true ||
    country.isUnlimited === true ||
    STATIC_UNLIMITED_CODES.has(code);

  return {
    ...country,
    ...(hasUnlimited ? { isUnlimited: true } : {}),
    ...(meta?.travelerVerification && meta.travelerVerification !== "none"
      ? { travelerVerification: meta.travelerVerification }
      : {}),
  };
}
