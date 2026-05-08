import { getPgPool } from "@/lib/bongsim/db/pool";
import { jsonWithLeakGuard } from "@/lib/public-response-guard";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

type CouponRow = {
  coupon_id: string;
  code: string;
  used_count: string | number;
};

type PatchBody = {
  is_active?: boolean;
  description?: string | null;
  discount_value?: number;
  max_discount_krw?: number | null;
  min_order_krw?: number | null;
  valid_until?: string;
};

function usedCountNum(row: CouponRow): number {
  const u = row.used_count;
  return typeof u === "string" ? Number.parseInt(u, 10) || 0 : Math.trunc(Number(u)) || 0;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ couponId: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return jsonWithLeakGuard({ error: "unauthorized" }, "admin.bongsim.coupons.patch", { status: 401 });

  const { couponId } = await ctx.params;
  const id = (couponId ?? "").trim();
  if (!id) return jsonWithLeakGuard({ error: "missing_id" }, "admin.bongsim.coupons.patch", { status: 400 });

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return jsonWithLeakGuard({ error: "invalid_json" }, "admin.bongsim.coupons.patch", { status: 400 });
  }

  const pool = getPgPool();
  if (!pool) return jsonWithLeakGuard({ error: "db_unconfigured" }, "admin.bongsim.coupons.patch", { status: 503 });

  try {
    const cur = await pool.query<CouponRow>(
      `SELECT coupon_id::text AS coupon_id, code, used_count FROM bongsim_coupon WHERE coupon_id = $1::uuid LIMIT 1`,
      [id],
    );
    const row = cur.rows[0];
    if (!row) return jsonWithLeakGuard({ error: "not_found" }, "admin.bongsim.coupons.patch", { status: 404 });

    const systemTpl = row.code.startsWith("__TPL_");
    if (systemTpl) {
      if (typeof body.is_active !== "boolean") {
        return jsonWithLeakGuard({ error: "system_template_is_active_only" }, "admin.bongsim.coupons.patch", { status: 400 });
      }
      const r = await pool.query(`UPDATE bongsim_coupon SET is_active = $2 WHERE coupon_id = $1::uuid RETURNING coupon_id::text`, [
        id,
        body.is_active,
      ]);
      return jsonWithLeakGuard({ ok: true, coupon_id: r.rows[0]?.coupon_id, is_active: body.is_active }, "admin.bongsim.coupons.patch.response");
    }

    const uc = usedCountNum(row);
    const sets: string[] = [];
    const args: unknown[] = [];
    let idx = 1;

    if (typeof body.is_active === "boolean") {
      sets.push(`is_active = $${idx}`);
      args.push(body.is_active);
      idx += 1;
    }
    if (body.description !== undefined) {
      const d = typeof body.description === "string" ? body.description.trim().slice(0, 500) : "";
      sets.push(`description = $${idx}`);
      args.push(d || null);
      idx += 1;
    }
    if (body.discount_value !== undefined) {
      if (uc > 0) {
        return jsonWithLeakGuard({ error: "discount_locked_after_use" }, "admin.bongsim.coupons.patch", { status: 409 });
      }
      const dv = typeof body.discount_value === "number" && Number.isFinite(body.discount_value) ? body.discount_value : Number.NaN;
      if (!Number.isFinite(dv) || dv < 0) {
        return jsonWithLeakGuard({ error: "invalid_discount_value" }, "admin.bongsim.coupons.patch", { status: 400 });
      }
      sets.push(`discount_value = $${idx}::numeric`);
      args.push(String(dv));
      idx += 1;
    }
    if (body.max_discount_krw !== undefined) {
      if (uc > 0) {
        return jsonWithLeakGuard({ error: "max_discount_locked_after_use" }, "admin.bongsim.coupons.patch", { status: 409 });
      }
      const mx =
        body.max_discount_krw == null || (typeof body.max_discount_krw === "string" && body.max_discount_krw === "")
          ? null
          : Math.trunc(Number(body.max_discount_krw));
      sets.push(`max_discount_krw = $${idx}`);
      args.push(mx != null && Number.isFinite(mx) ? mx : null);
      idx += 1;
    }
    if (body.min_order_krw !== undefined) {
      const mo =
        body.min_order_krw == null || (typeof body.min_order_krw === "string" && body.min_order_krw === "")
          ? 0
          : Math.max(0, Math.trunc(Number(body.min_order_krw)));
      sets.push(`min_order_krw = $${idx}`);
      args.push(mo);
      idx += 1;
    }
    if (body.valid_until !== undefined) {
      const vu = typeof body.valid_until === "string" && body.valid_until.trim() ? new Date(body.valid_until) : null;
      if (!vu || Number.isNaN(vu.getTime())) {
        return jsonWithLeakGuard({ error: "invalid_valid_until" }, "admin.bongsim.coupons.patch", { status: 400 });
      }
      sets.push(`valid_until = $${idx}`);
      args.push(vu.toISOString());
      idx += 1;
    }

    if (sets.length === 0) {
      return jsonWithLeakGuard({ error: "no_updates" }, "admin.bongsim.coupons.patch", { status: 400 });
    }

    args.push(id);
    const r = await pool.query(
      `UPDATE bongsim_coupon SET ${sets.join(", ")} WHERE coupon_id = $${idx}::uuid RETURNING coupon_id::text`,
      args,
    );
    return jsonWithLeakGuard({ ok: true, coupon_id: r.rows[0]?.coupon_id }, "admin.bongsim.coupons.patch.response");
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "42P01") return jsonWithLeakGuard({ error: "coupon_table_missing" }, "admin.bongsim.coupons.patch", { status: 503 });
    console.error("[admin/bongsim/coupons PATCH]", e);
    return jsonWithLeakGuard({ error: "update_failed" }, "admin.bongsim.coupons.patch", { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ couponId: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return jsonWithLeakGuard({ error: "unauthorized" }, "admin.bongsim.coupons.delete", { status: 401 });

  const { couponId } = await ctx.params;
  const id = (couponId ?? "").trim();
  if (!id) return jsonWithLeakGuard({ error: "missing_id" }, "admin.bongsim.coupons.delete", { status: 400 });

  const pool = getPgPool();
  if (!pool) return jsonWithLeakGuard({ error: "db_unconfigured" }, "admin.bongsim.coupons.delete", { status: 503 });

  try {
    const cur = await pool.query<{ code: string }>(`SELECT code FROM bongsim_coupon WHERE coupon_id = $1::uuid`, [id]);
    const row = cur.rows[0];
    if (!row) return jsonWithLeakGuard({ error: "not_found" }, "admin.bongsim.coupons.delete", { status: 404 });
    if (row.code.startsWith("__TPL_")) {
      return jsonWithLeakGuard({ error: "system_template_no_delete" }, "admin.bongsim.coupons.delete", { status: 403 });
    }

    const del = await pool.query(`DELETE FROM bongsim_coupon WHERE coupon_id = $1::uuid RETURNING coupon_id::text`, [id]);
    if (!del.rows[0]) return jsonWithLeakGuard({ error: "not_found" }, "admin.bongsim.coupons.delete", { status: 404 });
    return jsonWithLeakGuard({ ok: true, coupon_id: del.rows[0].coupon_id }, "admin.bongsim.coupons.delete.response");
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "23503") return jsonWithLeakGuard({ error: "referenced_by_user_coupon" }, "admin.bongsim.coupons.delete", { status: 409 });
    if (err.code === "42P01") return jsonWithLeakGuard({ error: "coupon_table_missing" }, "admin.bongsim.coupons.delete", { status: 503 });
    console.error("[admin/bongsim/coupons DELETE]", e);
    return jsonWithLeakGuard({ error: "delete_failed" }, "admin.bongsim.coupons.delete", { status: 500 });
  }
}
