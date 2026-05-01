import { NextResponse } from "next/server";
import { planNameKrFromCountryCode } from "@/lib/bongsim/country-options";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { MULTI_COUNTRY_PLAN_COVERAGE } from "@/lib/bongsim/plan-coverage-map";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

function planNamesCoveringCountryIso(iso: string): string[] {
  const c = iso.trim().toLowerCase();
  return Object.entries(MULTI_COUNTRY_PLAN_COVERAGE)
    .filter(([, countries]) => countries.some((x) => x.toLowerCase() === c))
    .map(([planName]) => planName);
}

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const pool = getPgPool();
  if (!pool) return NextResponse.json({ error: "db_unconfigured" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const countryRaw = (searchParams.get("country") ?? "").trim();
  const offset = (page - 1) * PAGE_SIZE;

  const countryLc = countryRaw.length === 2 ? countryRaw.toLowerCase() : "";
  const nameKr = countryLc ? planNameKrFromCountryCode(countryLc) : null;
  const multiNames = countryLc ? planNamesCoveringCountryIso(countryLc) : [];

  if (countryRaw && (!countryLc || !nameKr)) {
    return NextResponse.json(
      { error: "invalid_country", products: [], page, page_size: PAGE_SIZE, total: 0, total_pages: 1 },
      { status: 400 },
    );
  }

  const useCountry = Boolean(countryLc && nameKr);
  const whereSql = useCountry ? `(plan_name = $1 OR plan_name = ANY($2::text[]))` : `TRUE`;
  const baseParams: unknown[] = useCountry ? [nameKr, multiNames.length ? multiNames : []] : [];

  try {
    const countR = await pool.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM bongsim_product_option WHERE ${whereSql}`,
      baseParams,
    );
    const total = Number.parseInt(countR.rows[0]?.c ?? "0", 10);

    const limitIdx = baseParams.length + 1;
    const offsetIdx = baseParams.length + 2;
    const r = await pool.query(
      `SELECT
         option_api_id,
         plan_name,
         days_raw,
         allowance_label,
         network_family AS network_type,
         qos_raw,
         COALESCE(
           (price_block->'after'->>'recommended_krw')::numeric,
           (price_block->'before'->>'recommended_krw')::numeric
         )::text AS recommended_krw,
         COALESCE(
           (price_block->'after'->>'supply_krw')::numeric,
           (price_block->'before'->>'supply_krw')::numeric
         )::text AS supply_krw,
         COALESCE(is_active, true) AS is_active
       FROM bongsim_product_option
      WHERE ${whereSql}
      ORDER BY plan_name ASC, days_raw ASC, option_api_id ASC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      [...baseParams, PAGE_SIZE, offset],
    );

    return NextResponse.json({
      products: r.rows,
      page,
      page_size: PAGE_SIZE,
      total,
      total_pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    });
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (err.code === "42703") {
      return NextResponse.json(
        { error: "is_active_column_missing", hint: "Apply db/bongsim-migrations/0006_product_option_is_active.sql" },
        { status: 503 },
      );
    }
    console.error("[admin/bongsim/products GET]", e);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }
}
