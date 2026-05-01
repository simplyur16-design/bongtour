import { NextResponse } from "next/server";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

type PatchBody = {
  is_active?: boolean;
};

export async function PATCH(req: Request, ctx: { params: Promise<{ couponId: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { couponId } = await ctx.params;
  const id = (couponId ?? "").trim();
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (typeof body.is_active !== "boolean") {
    return NextResponse.json({ error: "is_active_required" }, { status: 400 });
  }

  const pool = getPgPool();
  if (!pool) return NextResponse.json({ error: "db_unconfigured" }, { status: 503 });

  try {
    const r = await pool.query(`UPDATE bongsim_coupon SET is_active = $2 WHERE coupon_id = $1::uuid RETURNING coupon_id`, [
      id,
      body.is_active,
    ]);
    if (!r.rows[0]) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ ok: true, coupon_id: r.rows[0].coupon_id, is_active: body.is_active });
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "42P01") return NextResponse.json({ error: "coupon_table_missing" }, { status: 503 });
    console.error("[admin/bongsim/coupons PATCH]", e);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
}
