import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

function genCode(): string {
  return `BS${randomBytes(4).toString("hex").toUpperCase()}`;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const pool = getPgPool();
  if (!pool) return NextResponse.json({ error: "db_unconfigured" }, { status: 503 });

  try {
    const r = await pool.query(
      `SELECT coupon_id, code, description, discount_type, discount_value::text AS discount_value,
              max_discount_krw::text AS max_discount_krw, min_order_krw::text AS min_order_krw,
              usage_limit, used_count, valid_from, valid_until, is_active
       FROM bongsim_coupon
       ORDER BY lower(code)`,
    );
    return NextResponse.json({ coupons: r.rows });
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (err.code === "42P01") return NextResponse.json({ error: "coupon_table_missing" }, { status: 503 });
    console.error("[admin/bongsim/coupons GET]", e);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }
}

type PostBody = {
  code?: string;
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
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const pool = getPgPool();
  if (!pool) return NextResponse.json({ error: "db_unconfigured" }, { status: 503 });

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const code = (typeof body.code === "string" && body.code.trim() ? body.code.trim() : genCode()).slice(0, 64);
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 500) : "";
  const discount_type = (body.discount_type === "percent" ? "percent" : "fixed") as "fixed" | "percent";
  const dv = typeof body.discount_value === "number" && Number.isFinite(body.discount_value) ? body.discount_value : Number.NaN;
  if (!Number.isFinite(dv) || dv < 0) {
    return NextResponse.json({ error: "invalid_discount_value" }, { status: 400 });
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
    return NextResponse.json({ error: "invalid_dates" }, { status: 400 });
  }
  const is_active = body.is_active !== false;

  try {
    const ins = await pool.query<{ coupon_id: string }>(
      `INSERT INTO bongsim_coupon (
         code, description, discount_type, discount_value, max_discount_krw, min_order_krw,
         usage_limit, used_count, valid_from, valid_until, is_active
       ) VALUES ($1, $2, $3, $4::numeric, $5, $6, $7, 0, $8, $9, $10)
       RETURNING coupon_id`,
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
      ],
    );
    const row = ins.rows[0];
    if (!row) return NextResponse.json({ error: "insert_failed" }, { status: 500 });
    return NextResponse.json({ coupon_id: row.coupon_id, code });
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (err.code === "23505") return NextResponse.json({ error: "duplicate_code" }, { status: 409 });
    if (err.code === "42P01") return NextResponse.json({ error: "coupon_table_missing" }, { status: 503 });
    console.error("[admin/bongsim/coupons POST]", e);
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }
}
