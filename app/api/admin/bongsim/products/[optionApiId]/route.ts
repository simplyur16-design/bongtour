import { NextResponse } from "next/server";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

type PatchBody = {
  is_active?: boolean;
};

export async function PATCH(req: Request, ctx: { params: Promise<{ optionApiId: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { optionApiId } = await ctx.params;
  const id = (optionApiId ?? "").trim();
  if (!id) return NextResponse.json({ error: "missing_option_api_id" }, { status: 400 });

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
    const r = await pool.query(
      `UPDATE bongsim_product_option SET is_active = $2, updated_at = now() WHERE option_api_id = $1 RETURNING option_api_id, is_active`,
      [id, body.is_active],
    );
    if (r.rowCount === 0) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, option_api_id: r.rows[0].option_api_id, is_active: r.rows[0].is_active });
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "42703") {
      return NextResponse.json(
        { error: "is_active_column_missing", hint: "Apply db/bongsim-migrations/0006_product_option_is_active.sql" },
        { status: 503 },
      );
    }
    console.error("[admin/bongsim/products PATCH]", e);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
}
