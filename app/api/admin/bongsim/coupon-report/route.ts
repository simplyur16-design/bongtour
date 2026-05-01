import { NextResponse } from "next/server";
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
    const r = await pool.query<{
      used_at: Date;
      order_number: string;
      code: string;
      original_amount_krw: string;
      discount_amount_krw: string;
      final_amount_krw: string;
    }>(
      `SELECT u.used_at, o.order_number, c.code,
              u.original_amount_krw::text AS original_amount_krw,
              u.discount_amount_krw::text AS discount_amount_krw,
              u.final_amount_krw::text AS final_amount_krw
       FROM bongsim_coupon_usage u
       JOIN bongsim_order o ON o.order_id = u.order_id
       JOIN bongsim_coupon c ON c.coupon_id = u.coupon_id
       WHERE u.used_at >= $1 AND u.used_at < $2
       ORDER BY u.used_at ASC`,
      [start.toISOString(), end.toISOString()],
    );

    let sumDisc = 0;
    let sumFinal = 0;
    for (const row of r.rows) {
      sumDisc += Number.parseInt(row.discount_amount_krw, 10) || 0;
      sumFinal += Number.parseInt(row.final_amount_krw, 10) || 0;
    }

    return NextResponse.json({
      year,
      month,
      rows: r.rows.map((x) => ({
        used_at: x.used_at.toISOString(),
        order_number: x.order_number,
        code: x.code,
        original_amount_krw: Number.parseInt(x.original_amount_krw, 10),
        discount_amount_krw: Number.parseInt(x.discount_amount_krw, 10),
        final_amount_krw: Number.parseInt(x.final_amount_krw, 10),
      })),
      summary: {
        count: r.rows.length,
        total_discount_krw: sumDisc,
        total_final_krw: sumFinal,
      },
    });
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "42P01") return NextResponse.json({ error: "tables_missing" }, { status: 503 });
    console.error("[admin/bongsim/coupon-report]", e);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }
}
