import type { Pool, PoolClient } from "pg";
import { BONGSIM_CATALOG_ACTIVE_WHERE } from "@/lib/bongsim/catalog/active-product-sql";
import { planNameKrFromCountryCode } from "@/lib/bongsim/country-options";
import {
  doesPlanCoverAllSelected,
  getPlanCoveredCountries,
} from "@/lib/bongsim/plan-coverage-map";
import {
  isRegionPackCode,
  planNameForRegionPackCode,
} from "@/lib/bongsim/recommend/region-pack-plan";
import { getKycLabelDistribution, type KycLabelDistribution } from "@/lib/bongsim/esim/kyc-required";
import { countryCatalogAllowsTravelerVerificationPolicy } from "@/lib/bongsim/esim/traveler-verification-policy";
import { isTrueUnlimited, type ProductOption } from "@/lib/bongsim/recommend/product-option";

/** 국가(권역) 카탈로그 — 여행자 인증 정책 */
export type TravelerVerificationCountryPolicy = "none" | "mixed" | "required";

export type CountryCatalogMeta = {
  /** 로밍망 완전 무제한 SKU 존재 */
  isUnlimited: boolean;
  travelerVerification: TravelerVerificationCountryPolicy;
};

function isSingleCountryForCode(p: ProductOption, code: string): boolean {
  const covered = getPlanCoveredCountries(p.plan_name);
  if (covered.length === 1 && covered[0] === code) return true;
  const nameKr = planNameKrFromCountryCode(code);
  return Boolean(nameKr && p.plan_name.trim() === nameKr);
}

function kycDistributionToPolicy(dist: KycLabelDistribution): TravelerVerificationCountryPolicy {
  if (dist === "required_only") return "required";
  if (dist === "binary") return "mixed";
  return "none";
}

function metaFromProducts(
  products: ProductOption[],
  catalogCode?: string,
): CountryCatalogMeta {
  const roaming = products.filter((p) => (p.network_family || "").toLowerCase() === "roaming");
  const isUnlimited = roaming.some((p) => isTrueUnlimited(p));
  let travelerVerification = kycDistributionToPolicy(getKycLabelDistribution(products));
  // REGRESSION-FREEZE[bongsim-traveler-verification-hk-mo-tw]: 중국 등 비대상 코드는 카탈로그 none — manifest
  if (catalogCode && !countryCatalogAllowsTravelerVerificationPolicy(catalogCode)) {
    travelerVerification = "none";
  }
  return { isUnlimited, travelerVerification };
}

/**
 * 단독 국가·권역 패키지별 카탈로그 메타 (무제한·여행자 인증).
 * flags.kyc=O/X 분포로 나라별 정책을 SSOT 계산.
 * 여행자 인증 목적지 SSOT: 홍콩·마카오·대만 (중국 본토 단독 제외).
 */
export async function listCountryCatalogMetaByCode(
  pool: Pool | PoolClient,
  codes: string[],
): Promise<Record<string, CountryCatalogMeta>> {
  const normalized = [...new Set(codes.map((c) => c.trim().toLowerCase()).filter(Boolean))];
  if (normalized.length === 0) return {};

  const { rows } = await pool.query<ProductOption>(
    `SELECT option_api_id, plan_name, network_family, plan_type, days_raw,
            allowance_label, option_label, price_block, flags
     FROM bongsim_product_option
     WHERE ${BONGSIM_CATALOG_ACTIVE_WHERE}`,
  );

  const allProducts = rows as ProductOption[];
  const out: Record<string, CountryCatalogMeta> = {};

  for (const code of normalized) {
    if (isRegionPackCode(code)) {
      const planName = planNameForRegionPackCode(code);
      const regional =
        planName != null ? allProducts.filter((p) => p.plan_name.trim() === planName) : [];
      out[code] = metaFromProducts(regional, code);
      continue;
    }

    const single = allProducts.filter((p) => isSingleCountryForCode(p, code));
    out[code] = metaFromProducts(single, code);
  }

  return out;
}

/** 다국가 플랜 — 선택 국가 전체 커버 시 메타 */
export function catalogMetaForMultiSelection(
  products: ProductOption[],
  selectedCodes: string[],
): CountryCatalogMeta {
  const multi = products.filter((p) => {
    const covered = getPlanCoveredCountries(p.plan_name);
    return covered.length >= 2 && doesPlanCoverAllSelected(p.plan_name, selectedCodes);
  });
  // 다국가 선택은 커버 국가에 HK/MO/TW가 있을 때만 인증 정책 노출
  const allows = selectedCodes.some((c) => countryCatalogAllowsTravelerVerificationPolicy(c));
  const meta = metaFromProducts(multi, allows ? "hk" : "cn");
  return meta;
}
