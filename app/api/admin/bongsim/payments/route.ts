import { NextResponse } from "next/server";
import { resolveAdminListPaging } from "@/lib/bongsim/admin/clamp-admin-list-page";
import { getPgPool } from "@/lib/bongsim/db/pool";
import {
  bongsimAdminQueryFailurePayload,
  withBongsimAdminPgRetry,
} from "@/lib/bongsim/db/admin-query";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

// REGRESSION-FREEZE[bongsim-admin-payments-query]: list probe·retry·buyer_tel/iccid 검색 — manifest
// REGRESSION-FREEZE[bongsim-admin-payments-pagination]: count 후 page/offset clamp — manifest

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!getPgPool()) return NextResponse.json({ error: "db_unconfigured" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const requestedPage = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const search = (searchParams.get("search") ?? "").trim();

  const hasSearch = search.length > 0;
  const pat = hasSearch ? `%${search.replace(/%/g, "\\%").replace(/_/g, "\\_")}%` : null;
  const digits = search.replace(/\D/g, "");
  const digitsPat = hasSearch && digits.length >= 8 ? `%${digits}%` : null;

  // No-search: avoid EXISTS on every row (slow list → pagination looks stuck).
  const whereSql = hasSearch
    ? `($1::text IS NULL
        OR order_number ILIKE $1 ESCAPE '\\'
        OR buyer_email ILIKE $1 ESCAPE '\\'
        OR COALESCE(buyer_tel, '') ILIKE $1 ESCAPE '\\'
        OR ($2::text IS NOT NULL AND COALESCE(buyer_tel, '') LIKE $2)
        OR EXISTS (
              SELECT 1 FROM bongsim_fulfillment_topup t
               WHERE t.order_id = bongsim_order.order_id
                 AND COALESCE(t.iccid, '') ILIKE $1 ESCAPE '\\'
            ))`
    : `TRUE`;

  try {
    const { total, page, totalPages, rows } = await withBongsimAdminPgRetry(async (pool) => {
      const countR = await pool.query<{ c: string }>(
        hasSearch
          ? `SELECT COUNT(*)::text AS c FROM bongsim_order WHERE ${whereSql}`
          : `SELECT COUNT(*)::text AS c FROM bongsim_order`,
        hasSearch ? [pat, digitsPat] : [],
      );
      const totalCount = Number.parseInt(countR.rows[0]?.c ?? "0", 10);
      const paging = resolveAdminListPaging({
        page: requestedPage,
        pageSize: PAGE_SIZE,
        totalCount,
      });
      const r = await pool.query(
        hasSearch
          ? `SELECT order_id::text AS order_id,
                order_number,
                status,
                checkout_channel,
                grand_total_krw::text AS grand_total_krw,
                buyer_email,
                buyer_tel,
                created_at
           FROM bongsim_order
          WHERE ${whereSql}
          ORDER BY created_at DESC
          LIMIT $3::int OFFSET $4::int`
          : `SELECT order_id::text AS order_id,
                order_number,
                status,
                checkout_channel,
                grand_total_krw::text AS grand_total_krw,
                buyer_email,
                buyer_tel,
                created_at
           FROM bongsim_order
          ORDER BY created_at DESC
          LIMIT $1::int OFFSET $2::int`,
        hasSearch
          ? [pat, digitsPat, PAGE_SIZE, paging.offset]
          : [PAGE_SIZE, paging.offset],
      );
      return {
        total: totalCount,
        page: paging.page,
        totalPages: paging.totalPages,
        rows: r.rows,
      };
    });

    return NextResponse.json({
      orders: rows,
      page,
      page_size: PAGE_SIZE,
      total,
      total_pages: totalPages,
    });
  } catch (e) {
    console.error("[admin/bongsim/payments GET]", e);
    const { status, body } = bongsimAdminQueryFailurePayload(e);
    return NextResponse.json(body, { status });
  }
}
