import { COUNTRY_OPTIONS } from "@/lib/bongsim/country-options";
import { BONGSIM_CATALOG_ACTIVE_WHERE } from "@/lib/bongsim/catalog/active-product-sql";
import { extractSingleCountryCode, resolveMultiCoverage } from "@/lib/bongsim/plan-coverage-map";
import { prisma } from "@/lib/prisma";
import type { Pool, PoolClient } from "pg";

export type BongsimStandaloneCountry = {
  code: string;
  nameKr: string;
};

const STANDALONE_PLAN_NAME_SQL = `SELECT DISTINCT TRIM(plan_name) AS plan_name
     FROM bongsim_product_option
     WHERE ${BONGSIM_CATALOG_ACTIVE_WHERE}
       AND plan_name IS NOT NULL AND TRIM(plan_name) <> ''`;

function standaloneCountriesFromPlanNames(planNames: string[]): BongsimStandaloneCountry[] {
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
  const countries: BongsimStandaloneCountry[] = [];

  for (const code of codes) {
    const opt = byCode.get(code);
    if (opt) {
      countries.push({ code: opt.code, nameKr: opt.nameKr });
    }
  }

  countries.sort((a, b) => a.nameKr.localeCompare(b.nameKr, "ko"));
  return countries;
}

/**
 * `bongsim_product_option`에 단독(단일 국가) 플랜이 있는 국가만 반환.
 * 다국가 플랜명만으로 커버되는 행은 제외.
 */
export async function listBongsimStandaloneCountries(
  pool: Pool | PoolClient,
): Promise<BongsimStandaloneCountry[]> {
  const { rows } = await pool.query<{ plan_name: string }>(STANDALONE_PLAN_NAME_SQL);
  return standaloneCountriesFromPlanNames(rows.map((r) => r.plan_name));
}

/**
 * Admin 국가 히어로 카탈로그 — Prisma 풀만 사용 (별도 bongsim pg 풀 경합·connect timeout 방지).
 */
// REGRESSION-FREEZE[admin-empty-json-response]: country-heroes catalog via Prisma — manifest
export async function listBongsimStandaloneCountriesViaPrisma(): Promise<BongsimStandaloneCountry[]> {
  const rows = await prisma.$queryRawUnsafe<{ plan_name: string }[]>(STANDALONE_PLAN_NAME_SQL);
  return standaloneCountriesFromPlanNames(rows.map((r) => r.plan_name));
}
