import { NextResponse } from "next/server";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { doesPlanCoverAllSelected, getPlanCoveredCountries } from "@/lib/bongsim/plan-coverage-map";
import {
  computeRecommendedPrice,
  extractDaysFromDaysRaw,
  isTrueUnlimited,
} from "@/lib/bongsim/recommend/product-option";
import type { ProductOption } from "@/lib/bongsim/recommend/product-option";

type Row = {
  option_api_id: string;
  plan_name: string;
  network_family: string;
  plan_type: string | null;
  days_raw: string;
  allowance_label: string;
  option_label: string;
  price_block: Record<string, unknown>;
  flags: Record<string, unknown>;
};

function enrich(row: Row) {
  const price_block = row.price_block as ProductOption["price_block"];
  const recommended_price = computeRecommendedPrice(price_block);
  const is_true_unlimited = isTrueUnlimited(row);
  return { ...row, price_block, recommended_price, is_true_unlimited };
}

function matchesFilters(row: Row, ctx: { country: string; days: number; allSelected: string[] }) {
  const d = extractDaysFromDaysRaw(row.days_raw);
  if (d !== ctx.days) return false;

  const covered = getPlanCoveredCountries(row.plan_name);
  const pt = (row.plan_type || "").trim().toLowerCase();

  if (pt !== "unlimited" && pt !== "daily") return false;

  const multiUnlimitedOk =
    ctx.allSelected.length >= 2 &&
    pt === "unlimited" &&
    isTrueUnlimited(row) &&
    covered.length >= 2 &&
    doesPlanCoverAllSelected(row.plan_name, ctx.allSelected);

  /** 저속 무제한(plan_type unlimited + allowance 500MB 등)도 플랜 선택·용량 버킷용으로 포함, `is_true_unlimited`로 구분 */
  const singleOk =
    covered.length === 1 &&
    covered[0] === ctx.country &&
    (pt === "daily" || pt === "unlimited");

  return multiUnlimitedOk || singleOk;
}

/**
 * GET /api/bongsim/products/plans?country=jp&network=roaming&days=4&codes=jp,vn
 *
 * - 단일국가 / 다국가 무제한 포함
 * - recommended_price = after.recommended_krw ?? before.recommended_krw (권장판매가)
 * - is_true_unlimited: allowance_label 이 정확히 무제한/완전 무제한/unlimited 인 경우만 true (저속 무제한은 false)
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const country = (searchParams.get("country") || "").trim().toLowerCase();
  const network = (searchParams.get("network") || "").trim().toLowerCase();
  const daysStr = (searchParams.get("days") || "").trim();
  const days = parseInt(daysStr, 10);
  const codesRaw = (searchParams.get("codes") || "").trim();

  if (!country) {
    return NextResponse.json({ error: "country required" }, { status: 400 });
  }
  if (network !== "roaming" && network !== "local") {
    return NextResponse.json({ error: "network must be roaming or local" }, { status: 400 });
  }
  if (!Number.isFinite(days) || days < 1) {
    return NextResponse.json({ error: "days must be a positive integer" }, { status: 400 });
  }

  const fromCodes = codesRaw
    ? codesRaw
        .split(",")
        .map((c) => c.trim().toLowerCase())
        .filter(Boolean)
    : [country];
  const allSelected = [...new Set(fromCodes)];

  const pool = getPgPool();
  if (!pool) {
    return NextResponse.json({ error: "DB not configured" }, { status: 500 });
  }

  try {
    const result = await pool.query(
      `
      SELECT
        option_api_id,
        plan_name,
        network_family,
        plan_type,
        days_raw,
        allowance_label,
        option_label,
        price_block,
        flags
      FROM bongsim_product_option
      WHERE network_family = $1
        AND plan_type IS NOT NULL
        AND lower(plan_type) IN ('unlimited', 'daily')
      ORDER BY plan_name, days_raw, COALESCE(
        (price_block->'after'->>'recommended_krw')::numeric,
        (price_block->'before'->>'recommended_krw')::numeric
      ) ASC NULLS LAST
      `,
      [network],
    );

    const ctx = { country, days, allSelected };
    const matched = (result.rows as Row[]).filter((row) => matchesFilters(row, ctx));

    const enriched = matched.map(enrich).sort((a, b) => {
      const pa = a.recommended_price;
      const pb = b.recommended_price;
      if (pa != null && pb != null) return pa - pb;
      if (pa != null) return -1;
      if (pb != null) return 1;
      return 0;
    });

    return NextResponse.json({ plans: enriched });
  } catch (e) {
    console.error("[plans]", e);
    return NextResponse.json({ error: "query failed" }, { status: 500 });
  }
}
