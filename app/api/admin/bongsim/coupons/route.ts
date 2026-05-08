import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { jsonWithLeakGuard } from "@/lib/public-response-guard";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

function genCode(): string {
  return `BS${randomBytes(4).toString("hex").toUpperCase()}`;
}

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return jsonWithLeakGuard({ error: "unauthorized" }, "admin.bongsim.coupons.list", { status: 401 });

  const pool = getPgPool();
  if (!pool) return jsonWithLeakGuard({ error: "db_unconfigured" }, "admin.bongsim.coupons.list", { status: 503 });

  const url = new URL(req.url);
  const kind = (url.searchParams.get("kind") ?? "all").trim();

  let where = "";
  if (kind === "public_code") where = `WHERE coupon_kind = 'public_code'`;
  else if (kind === "issuance_template") where = `WHERE coupon_kind = 'issuance_template'`;

  try {
    const r = await pool.query(
      `SELECT coupon_id::text AS coupon_id, code, description, discount_type, discount_value::text AS discount_value,
              max_discount_krw::text AS max_discount_krw, min_order_krw::text AS min_order_krw,
              usage_limit, used_count, valid_from, valid_until, is_active,
              coupon_kind, template_label, template_validity_days
       FROM bongsim_coupon
       ${where}
       ORDER BY lower(code)`,
    );
    return jsonWithLeakGuard({ coupons: r.rows }, "admin.bongsim.coupons.list.response");
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "42P01") return jsonWithLeakGuard({ error: "coupon_table_missing" }, "admin.bongsim.coupons.list", { status: 503 });
    console.error("[admin/bongsim/coupons GET]", e);
    return jsonWithLeakGuard({ error: "query_failed" }, "admin.bongsim.coupons.list", { status: 500 });
  }
}

type PostBody = {
  code?: string;
  coupon_kind?: string;
  template_label?: string | null;
  template_validity_days?: number | null;
  description?: string;
  discount_type?: string;
  discount_value?: number;
  max_discount_krw?: number | null;
  min_order_krw?: number | null;
  usage_limit?: number | null;
  valid_from?: string;
  valid_until?: string;
  is_active?: boolean;
};

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return jsonWithLeakGuard({ error: "unauthorized" }, "admin.bongsim.coupons.create", { status: 401 });

  const pool = getPgPool();
  if (!pool) return jsonWithLeakGuard({ error: "db_unconfigured" }, "admin.bongsim.coupons.create", { status: 503 });

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return jsonWithLeakGuard({ error: "invalid_json" }, "admin.bongsim.coupons.create", { status: 400 });
  }

  const coupon_kind = body.coupon_kind === "issuance_template" ? "issuance_template" : "public_code";

  let code =
    typeof body.code === "string" && body.code.trim()
      ? body.code.trim().slice(0, 64)
      : coupon_kind === "issuance_template"
        ? `TPL${randomBytes(5).toString("hex").toUpperCase()}`
        : genCode();

  if (code.startsWith("__TPL_")) {
    return jsonWithLeakGuard({ error: "reserved_system_template_prefix" }, "admin.bongsim.coupons.create", { status: 403 });
  }

  const template_label =
    coupon_kind === "issuance_template"
      ? typeof body.template_label === "string" && body.template_label.trim()
        ? body.template_label.trim().slice(0, 200)
        : null
      : null;

  if (coupon_kind === "issuance_template" && !template_label) {
    return jsonWithLeakGuard({ error: "template_label_required" }, "admin.bongsim.coupons.create", { status: 400 });
  }

  const tvdRaw = body.template_validity_days;
  const template_validity_days =
    coupon_kind === "issuance_template" && tvdRaw != null && Number.isFinite(Number(tvdRaw))
      ? Math.max(1, Math.trunc(Number(tvdRaw)))
      : coupon_kind === "issuance_template"
        ? null
        : null;

  const description = typeof body.description === "string" ? body.description.trim().slice(0, 500) : "";
  const discount_type = (body.discount_type === "percent" ? "percent" : "fixed") as "fixed" | "percent";
  const dv = typeof body.discount_value === "number" && Number.isFinite(body.discount_value) ? body.discount_value : Number.NaN;
  if (!Number.isFinite(dv) || dv < 0) {
    return jsonWithLeakGuard({ error: "invalid_discount_value" }, "admin.bongsim.coupons.create", { status: 400 });
  }
  const max_disc =
    body.max_discount_krw == null || (typeof body.max_discount_krw === "string" && body.max_discount_krw === "")
      ? null
      : Math.trunc(Number(body.max_discount_krw));
  const min_order =
    body.min_order_krw == null || (typeof body.min_order_krw === "string" && body.min_order_krw === "")
      ? 0
      : Math.max(0, Math.trunc(Number(body.min_order_krw)));
  const usage_limit =
    body.usage_limit == null || (typeof body.usage_limit === "string" && body.usage_limit === "")
      ? null
      : Math.max(1, Math.trunc(Number(body.usage_limit)));
  const valid_from = typeof body.valid_from === "string" && body.valid_from.trim() ? new Date(body.valid_from) : new Date();
  const valid_until =
    typeof body.valid_until === "string" && body.valid_until.trim()
      ? new Date(body.valid_until)
      : new Date(valid_from.getTime() + 365 * 24 * 60 * 60 * 1000);
  if (Number.isNaN(valid_from.getTime()) || Number.isNaN(valid_until.getTime()) || valid_until <= valid_from) {
    return jsonWithLeakGuard({ error: "invalid_dates" }, "admin.bongsim.coupons.create", { status: 400 });
  }
  const is_active = body.is_active !== false;

  try {
    const ins = await pool.query<{ coupon_id: string }>(
      `INSERT INTO bongsim_coupon (
         code, description, discount_type, discount_value, max_discount_krw, min_order_krw,
         usage_limit, used_count, valid_from, valid_until, is_active,
         coupon_kind, template_label, template_validity_days
       ) VALUES ($1, $2, $3, $4::numeric, $5, $6, $7, 0, $8, $9, $10, $11, $12, $13)
       RETURNING coupon_id::text`,
      [
        code,
        description || null,
        discount_type,
        String(dv),
        max_disc != null && Number.isFinite(max_disc) ? max_disc : null,
        min_order,
        usage_limit,
        valid_from.toISOString(),
        valid_until.toISOString(),
        is_active,
        coupon_kind,
        template_label,
        template_validity_days,
      ],
    );
    const row = ins.rows[0];
    if (!row) return jsonWithLeakGuard({ error: "insert_failed" }, "admin.bongsim.coupons.create", { status: 500 });
    return jsonWithLeakGuard({ coupon_id: row.coupon_id, code }, "admin.bongsim.coupons.create.response");
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "23505") return jsonWithLeakGuard({ error: "duplicate_code" }, "admin.bongsim.coupons.create", { status: 409 });
    if (err.code === "42P01") return jsonWithLeakGuard({ error: "coupon_table_missing" }, "admin.bongsim.coupons.create", { status: 503 });
    console.error("[admin/bongsim/coupons POST]", e);
    return jsonWithLeakGuard({ error: "insert_failed" }, "admin.bongsim.coupons.create", { status: 500 });
  }
}
