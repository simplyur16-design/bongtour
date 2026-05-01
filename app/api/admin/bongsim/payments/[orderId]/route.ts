import { NextResponse } from "next/server";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ orderId: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { orderId } = await ctx.params;
  const id = (orderId ?? "").trim();
  if (!id) return NextResponse.json({ error: "missing_order_id" }, { status: 400 });

  const pool = getPgPool();
  if (!pool) return NextResponse.json({ error: "db_unconfigured" }, { status: 503 });

  try {
    const o = await pool.query(
      `SELECT order_id::text AS order_id, order_number, status, buyer_email, grand_total_krw::text AS grand_total_krw,
              subtotal_krw::text AS subtotal_krw, discount_krw::text AS discount_krw, currency,
              payment_reference, payment_provider, paid_at, created_at, updated_at, consents
         FROM bongsim_order WHERE order_id = $1::uuid LIMIT 1`,
      [id],
    );
    if (o.rows.length === 0) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const lines = await pool.query(
      `SELECT line_id::text AS line_id, option_api_id, quantity,
              charged_unit_price_krw::text AS charged_unit_price_krw,
              line_total_krw::text AS line_total_krw, charged_basis_key, snapshot, created_at
         FROM bongsim_order_line WHERE order_id = $1::uuid ORDER BY created_at ASC`,
      [id],
    );

    const attempts = await pool.query(
      `SELECT payment_attempt_id::text AS payment_attempt_id, status, provider, provider_session_id,
              amount_krw::text AS amount_krw, currency, created_at, updated_at
         FROM bongsim_payment_attempt WHERE order_id = $1::uuid ORDER BY created_at ASC`,
      [id],
    );

    return NextResponse.json({
      order: o.rows[0],
      lines: lines.rows,
      payment_attempts: attempts.rows,
    });
  } catch (e) {
    console.error("[admin/bongsim/payments/[orderId] GET]", e);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }
}
