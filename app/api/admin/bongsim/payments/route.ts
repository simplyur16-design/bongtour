import { NextResponse } from "next/server";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const pool = getPgPool();
  if (!pool) return NextResponse.json({ error: "db_unconfigured" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const search = (searchParams.get("search") ?? "").trim();
  const offset = (page - 1) * PAGE_SIZE;

  const hasSearch = search.length > 0;
  const pat = hasSearch ? `%${search.replace(/%/g, "\\%").replace(/_/g, "\\_")}%` : null;

  try {
    const countR = await pool.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM bongsim_order
        WHERE ($1::text IS NULL OR order_number ILIKE $1 ESCAPE '\\' OR buyer_email ILIKE $1 ESCAPE '\\')`,
      [pat],
    );
    const total = Number.parseInt(countR.rows[0]?.c ?? "0", 10);

    const r = await pool.query(
      `SELECT order_id::text AS order_id,
              order_number,
              status,
              grand_total_krw::text AS grand_total_krw,
              buyer_email,
              created_at
         FROM bongsim_order
        WHERE ($1::text IS NULL OR order_number ILIKE $1 ESCAPE '\\' OR buyer_email ILIKE $1 ESCAPE '\\')
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3`,
      [pat, PAGE_SIZE, offset],
    );

    return NextResponse.json({
      orders: r.rows,
      page,
      page_size: PAGE_SIZE,
      total,
      total_pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    });
  } catch (e) {
    console.error("[admin/bongsim/payments GET]", e);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }
}
