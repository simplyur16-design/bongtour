import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { summarizeUsimsaOrderDataUsage } from "@/lib/bongsim/refund/usimsa-refund-usage";

export const dynamic = "force-dynamic";

// REGRESSION-FREEZE[bongsim-admin-esim-usage-check]: GET usage summary — manifest

export async function GET(_req: Request, ctx: { params: Promise<{ orderId: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { orderId } = await ctx.params;
  const id = (orderId ?? "").trim();
  if (!id) return NextResponse.json({ error: "missing_order_id" }, { status: 400 });

  const pool = getPgPool();
  if (!pool) return NextResponse.json({ error: "db_unconfigured" }, { status: 503 });

  try {
    const exists = await pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM bongsim_order WHERE order_id = $1::uuid`,
      [id],
    );
    if (Number.parseInt(exists.rows[0]?.n ?? "0", 10) < 1) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const summary = await summarizeUsimsaOrderDataUsage(id);
    if (!summary.ok) {
      return NextResponse.json(
        { ok: false, error: summary.reason, message: summary.message },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      order_id: id,
      unused: summary.unused,
      activated: summary.activated,
      total_used_mb: summary.totalUsedMb,
      topup_count: summary.topupCount,
      label: summary.label,
    });
  } catch (e) {
    console.error("[admin/bongsim/payments/[orderId]/usage GET]", e);
    return NextResponse.json(
      { error: "query_failed", message: "사용량 조회에 실패했습니다." },
      { status: 500 },
    );
  }
}
