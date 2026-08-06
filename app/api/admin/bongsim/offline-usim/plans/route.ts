import { NextResponse } from "next/server";
import { BONGSIM_CATALOG_OFFLINE_USIM_WHERE } from "@/lib/bongsim/catalog/active-product-sql";
import { getPgPool } from "@/lib/bongsim/db/pool";
import {
  bongsimAdminQueryFailurePayload,
  withBongsimAdminPgRetry,
} from "@/lib/bongsim/db/admin-query";
import { queryPlanCatalog } from "@/lib/bongsim/recommend/query-plan-catalog";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/bongsim/offline-usim/plans?country=jp&days=7&codes=jp,th
 * 매장 오프라인 USIM 피커 — USIM 겸용 active 상품만 (공개 plans API와 동일 분류·필터).
 * REGRESSION-FREEZE[bongsim-admin-plans-pg-retry]: admin plans heal·retry — manifest
 */
export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const country = (searchParams.get("country") || "").trim().toLowerCase();
  const daysStr = (searchParams.get("days") || "").trim();
  const days = parseInt(daysStr, 10);
  const codesRaw = (searchParams.get("codes") || "").trim();

  if (!country) {
    return NextResponse.json({ error: "country required" }, { status: 400 });
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

  if (!getPgPool()) return NextResponse.json({ error: "db_unconfigured" }, { status: 503 });

  try {
    const payload = await withBongsimAdminPgRetry((pool) =>
      queryPlanCatalog({
        pool,
        country,
        days,
        allSelected,
        catalogWhere: BONGSIM_CATALOG_OFFLINE_USIM_WHERE,
        includeSupplyKrw: true,
      }),
    );
    return NextResponse.json(payload);
  } catch (e) {
    console.error("[admin/offline-usim/plans]", e);
    const { status, body } = bongsimAdminQueryFailurePayload(e);
    return NextResponse.json(
      {
        ...body,
        message: body.message.replace("주문·발급 내역", "플랜 목록"),
      },
      { status },
    );
  }
}
