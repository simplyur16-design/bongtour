import { NextResponse } from "next/server";
import { COUNTRY_OPTIONS } from "@/lib/bongsim/country-options";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { extractSingleCountryCode, resolveMultiCoverage } from "@/lib/bongsim/plan-coverage-map";

export type BongsimCountryListItem = {
  code: string;
  nameKr: string;
};

/**
 * GET /api/bongsim/countries
 *
 * `bongsim_product_option`에 **단독(단일 국가) 플랜**이 있는 국가만 반환.
 * 다국가 플랜명(`MULTI_COUNTRY_PLAN_COVERAGE` 키)만으로 커버되는 행은 제외.
 */
export async function GET() {
  const pool = getPgPool();
  if (!pool) {
    return NextResponse.json({ error: "DB not configured" }, { status: 500 });
  }

  try {
    const { rows } = await pool.query<{ plan_name: string }>(
      `SELECT DISTINCT TRIM(plan_name) AS plan_name
       FROM bongsim_product_option
       WHERE plan_name IS NOT NULL AND TRIM(plan_name) <> ''`,
    );

    const codes = new Set<string>();
    for (const row of rows) {
      const pn = row.plan_name?.trim();
      if (!pn) continue;
      const multi = resolveMultiCoverage(pn);
      const singleCode = extractSingleCountryCode(pn);
      if (multi !== undefined && singleCode === null) continue;
      if (singleCode) codes.add(singleCode.trim().toLowerCase());
    }

    const byCode = new Map(COUNTRY_OPTIONS.map((c) => [c.code.toLowerCase(), c]));
    const countries: BongsimCountryListItem[] = [];

    for (const code of codes) {
      if (code === "kr") continue;
      const opt = byCode.get(code);
      if (opt) {
        countries.push({ code: opt.code, nameKr: opt.nameKr });
      }
    }

    countries.sort((a, b) => a.nameKr.localeCompare(b.nameKr, "ko"));

    return NextResponse.json(
      { countries },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "query failed";
    console.error("[api/bongsim/countries]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
