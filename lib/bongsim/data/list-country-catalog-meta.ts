import type { Pool, PoolClient } from "pg";
import { BONGSIM_CATALOG_ACTIVE_WHERE } from "@/lib/bongsim/catalog/active-product-sql";
import { planNameKrFromCountryCode } from "@/lib/bongsim/country-options";
import {
  doesPlanCoverAllSelected,
  getPlanCoveredCountries,
} from "@/lib/bongsim/plan-coverage-map";
import {
  isRegionPackCode,
  planNamesForRegionPackCode,
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

/** 메타 계산용 슬림 행 — price_block 없음 (카탈로그 목록 부하 금지) */
export type CountryCatalogMetaRow = {
  plan_name: string;
  network_family: string | null;
  plan_type: string | null;
  allowance_label: string | null;
  flags: Record<string, unknown> | null;
};

// REGRESSION-FREEZE[bongsim-catalog-list-perf]: countries meta 슬림 SELECT — manifest

function isSingleCountryForCode(p: Pick<CountryCatalogMetaRow, "plan_name">, code: string): boolean {
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
  products: CountryCatalogMetaRow[],
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

/** 이미 로드된 슬림 행에서 국가·권역 메타 계산 (추가 DB 왕복 없음) */
export function catalogMetaFromSlimRows(
  allProducts: CountryCatalogMetaRow[],
  codes: string[],
): Record<string, CountryCatalogMeta> {
  const normalized = [...new Set(codes.map((c) => c.trim().toLowerCase()).filter(Boolean))];
  if (normalized.length === 0) return {};

  const out: Record<string, CountryCatalogMeta> = {};

  for (const code of normalized) {
    if (isRegionPackCode(code)) {
      const planNames = new Set(planNamesForRegionPackCode(code).map((n) => n.trim()));
      const regional = allProducts.filter((p) => planNames.has(p.plan_name.trim()));
      out[code] = metaFromProducts(regional, code);
      continue;
    }

    const single = allProducts.filter((p) => isSingleCountryForCode(p, code));
    out[code] = metaFromProducts(single, code);
  }

  return out;
}

/**
 * 단독 국가·권역 패키지별 카탈로그 메타 (무제한·여행자 인증).
 * flags.kyc=O/X 분포로 나라별 정책을 SSOT 계산.
 * 여행자 인증 목적지 SSOT: 홍콩·마카오·대만 (중국 본토 단독 제외).
 * price_block 미조회 — 목록 API 타임아웃·DB 포화 방지.
 */
export async function listCountryCatalogMetaByCode(
  pool: Pool | PoolClient,
  codes: string[],
): Promise<Record<string, CountryCatalogMeta>> {
  const normalized = [...new Set(codes.map((c) => c.trim().toLowerCase()).filter(Boolean))];
  if (normalized.length === 0) return {};

  const { rows } = await pool.query<CountryCatalogMetaRow>(
    `SELECT TRIM(plan_name) AS plan_name,
            network_family,
            plan_type,
            allowance_label,
            jsonb_build_object('kyc', flags->'kyc') AS flags
     FROM bongsim_product_option
     WHERE ${BONGSIM_CATALOG_ACTIVE_WHERE}`,
  );

  return catalogMetaFromSlimRows(rows, normalized);
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
