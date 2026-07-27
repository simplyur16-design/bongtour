import { prisma } from "@/lib/prisma";
import {
  catalogMetaFromSlimRows,
  type CountryCatalogMeta,
  type CountryCatalogMetaRow,
} from "@/lib/bongsim/data/list-country-catalog-meta";
import { COUNTRY_OPTIONS } from "@/lib/bongsim/country-options";
import { BONGSIM_CATALOG_ACTIVE_WHERE } from "@/lib/bongsim/catalog/active-product-sql";
import { extractSingleCountryCode, resolveMultiCoverage } from "@/lib/bongsim/plan-coverage-map";
import { getPgPool, withBongsimStatementTimeout, classifyBongsimPgError, resetBongsimPgPoolAfterConnectTimeout } from "@/lib/bongsim/db/pool";
import { RECOMMEND_CATALOG_META_REGION_CODES } from "@/lib/bongsim/recommend/recommend-destination-sections";
import { RECOMMEND_POPULAR_CODES } from "@/lib/bongsim/home-data";

const ENTITY_TYPE = "bongsim_esim_country";
const IMAGE_ROLE = "recommend_hero";

export type BongsimCountryListItem = {
  code: string;
  nameKr: string;
  isUnlimited?: boolean;
  travelerVerification?: "none" | "mixed" | "required";
};

export type BongsimRecommendBootstrap = {
  countries: BongsimCountryListItem[];
  catalogMeta: Record<string, CountryCatalogMeta>;
  heroMap: Record<string, string>;
};

export type BongsimRecommendBootstrapResult =
  | { ok: true; data: BongsimRecommendBootstrap }
  | { ok: false; reason: "db_unconfigured" | "db_error" | "connection_timeout" };

// REGRESSION-FREEZE[bongsim-recommend-server-bootstrap-p3]: recommend 서버 프리로드 — manifest
// REGRESSION-FREEZE[bongsim-catalog-list-perf]: countries 1-pass slim (no price_block) — manifest

export async function loadBongsimCountryHeroMap(): Promise<Record<string, string>> {
  const rows = await prisma.imageAsset.findMany({
    where: {
      entityType: ENTITY_TYPE,
      imageRole: IMAGE_ROLE,
      isPrimary: true,
    },
    select: {
      entityId: true,
      publicUrl: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  const heroes: Record<string, string> = {};
  for (const r of rows) {
    const code = r.entityId.trim().toLowerCase();
    const url = r.publicUrl.trim();
    if (!code || !url) continue;
    if (heroes[code] !== undefined) continue;
    heroes[code] = url;
  }
  return heroes;
}

function standaloneCountriesFromPlanNames(planNames: string[]): BongsimCountryListItem[] {
  const codes = new Set<string>();
  for (const raw of planNames) {
    const pn = raw?.trim();
    if (!pn) continue;
    const multi = resolveMultiCoverage(pn);
    const singleCode = extractSingleCountryCode(pn);
    if (multi !== undefined && singleCode === null) continue;
    if (singleCode) codes.add(singleCode.trim().toLowerCase());
  }

  const byCode = new Map(COUNTRY_OPTIONS.map((c) => [c.code.toLowerCase(), c]));
  const countries: BongsimCountryListItem[] = [];
  for (const code of codes) {
    const opt = byCode.get(code);
    if (opt) countries.push({ code: opt.code, nameKr: opt.nameKr });
  }
  countries.sort((a, b) => a.nameKr.localeCompare(b.nameKr, "ko"));
  return countries;
}

export async function loadBongsimCountriesPayload(): Promise<
  | { ok: true; countries: BongsimCountryListItem[]; catalogMeta: Record<string, CountryCatalogMeta> }
  | { ok: false; reason: "db_unconfigured" | "db_error" | "connection_timeout" }
> {
  const pool = getPgPool();
  if (!pool) return { ok: false, reason: "db_unconfigured" };

  try {
    return await withBongsimStatementTimeout(async (client) => {
      // 한 번만: DISTINCT plan_name + 전체 price_block 이중 스캔 금지
      const { rows } = await client.query<CountryCatalogMetaRow>(
        `SELECT TRIM(plan_name) AS plan_name,
                network_family,
                plan_type,
                allowance_label,
                jsonb_build_object('kyc', flags->'kyc') AS flags
         FROM bongsim_product_option
         WHERE ${BONGSIM_CATALOG_ACTIVE_WHERE}`,
      );

      const countries = standaloneCountriesFromPlanNames(rows.map((r) => r.plan_name));
      const metaCodes = [
        ...countries.map((c) => c.code),
        ...RECOMMEND_POPULAR_CODES,
        ...RECOMMEND_CATALOG_META_REGION_CODES,
      ];
      const metaByCode = catalogMetaFromSlimRows(rows, metaCodes);

      const enriched: BongsimCountryListItem[] = countries.map((c) => {
        const meta = metaByCode[c.code.toLowerCase()];
        return {
          code: c.code,
          nameKr: c.nameKr,
          ...(meta?.isUnlimited ? { isUnlimited: true } : {}),
          ...(meta?.travelerVerification && meta.travelerVerification !== "none"
            ? { travelerVerification: meta.travelerVerification }
            : {}),
        };
      });

      return { ok: true as const, countries: enriched, catalogMeta: metaByCode };
    });
  } catch (e) {
    console.error("[loadBongsimCountriesPayload]", e);
    resetBongsimPgPoolAfterConnectTimeout(e);
    return { ok: false, reason: classifyBongsimPgError(e) };
  }
}

export async function loadBongsimRecommendBootstrap(): Promise<BongsimRecommendBootstrapResult> {
  const countriesRes = await loadBongsimCountriesPayload();
  if (!countriesRes.ok) return countriesRes;

  try {
    const heroMap = await loadBongsimCountryHeroMap();
    return {
      ok: true,
      data: {
        countries: countriesRes.countries,
        catalogMeta: countriesRes.catalogMeta,
        heroMap,
      },
    };
  } catch (e) {
    console.error("[loadBongsimRecommendBootstrap]", e);
    return { ok: false, reason: "db_error" };
  }
}
