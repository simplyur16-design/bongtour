import { NextResponse } from "next/server";
import {
  queryBongsimDiscountReportRows,
  summarizeBongsimDiscountReportRows,
} from "@/lib/bongsim/admin/bongsim-discount-report";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const pool = getPgPool();
  if (!pool) return NextResponse.json({ error: "db_unconfigured" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const now = new Date();
  const yRaw = searchParams.get("year");
  const mRaw = searchParams.get("month");
  const year = yRaw ? Number.parseInt(yRaw, 10) : now.getUTCFullYear();
  const month = mRaw ? Number.parseInt(mRaw, 10) : now.getUTCMonth() + 1;
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "invalid_year_month" }, { status: 400 });
  }

  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));

  try {
    const rows = await queryBongsimDiscountReportRows(pool, start, end);
    const summary = summarizeBongsimDiscountReportRows(rows);

    return NextResponse.json({
      year,
      month,
      rows: rows.map((x) => ({
        used_at: x.used_at.toISOString(),
        order_number: x.order_number,
        code: x.code,
        description: x.description,
        original_amount_krw: Number.parseInt(x.original_amount_krw, 10),
        discount_amount_krw: Number.parseInt(x.discount_amount_krw, 10),
        final_amount_krw: Number.parseInt(x.final_amount_krw, 10),
        source: x.source,
      })),
      summary,
    });
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "42P01") return NextResponse.json({ error: "tables_missing" }, { status: 503 });
    console.error("[admin/bongsim/coupon-report]", e);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }
}
