import { getPgPool } from "@/lib/bongsim/db/pool";
import { jsonWithLeakGuard } from "@/lib/public-response-guard";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RouteCtx = { params: Promise<{ batchId: string }> };

export async function GET(_req: Request, ctx: RouteCtx) {
  const admin = await requireAdmin();
  if (!admin) return jsonWithLeakGuard({ error: "unauthorized" }, "admin.bongsim.coupons.bulk.detail", { status: 401 });

  const { batchId: raw } = await ctx.params;
  const batchId = (raw ?? "").trim();
  if (!UUID_RE.test(batchId)) {
    return jsonWithLeakGuard({ error: "invalid_batch_id" }, "admin.bongsim.coupons.bulk.detail", { status: 400 });
  }

  const pool = getPgPool();
  if (!pool) return jsonWithLeakGuard({ error: "db_unconfigured" }, "admin.bongsim.coupons.bulk.detail", { status: 503 });

  try {
    const head = await pool.query<{
      batch_id: string;
      trip_name: string;
      departure_date: string;
      adult_count: number;
      issued_by: string;
      memo: string | null;
      created_at: Date;
      issuer_name: string | null;
    }>(
      `SELECT b.batch_id::text AS batch_id, b.trip_name, b.departure_date::text AS departure_date, b.adult_count,
              b.issued_by, b.memo, b.created_at, u.name AS issuer_name
       FROM bongsim_coupon_batch b
       LEFT JOIN "User" u ON u.id = b.issued_by
       WHERE b.batch_id = $1::uuid
       LIMIT 1`,
      [batchId],
    );
    const batch = head.rows[0];
    if (!batch) {
      return jsonWithLeakGuard({ error: "not_found" }, "admin.bongsim.coupons.bulk.detail", { status: 404 });
    }

    const items = await pool.query<{
      item_id: string;
      recipient_email: string;
      recipient_name: string | null;
      code: string;
      used_count: string | number;
      usage_limit: string | number | null;
      email_sent_at: Date | null;
      email_error: string | null;
    }>(
      `SELECT i.item_id::text AS item_id, i.recipient_email, i.recipient_name, c.code,
              c.used_count, c.usage_limit, i.email_sent_at, i.email_error
       FROM bongsim_coupon_batch_item i
       JOIN bongsim_coupon c ON c.coupon_id = i.coupon_id
       WHERE i.batch_id = $1::uuid
       ORDER BY i.created_at ASC`,
      [batchId],
    );

    return jsonWithLeakGuard(
      {
        ok: true as const,
        batch: {
          batch_id: batch.batch_id,
          trip_name: batch.trip_name,
          departure_date: batch.departure_date,
          adult_count: batch.adult_count,
          issued_by: batch.issued_by,
          issuer_name: batch.issuer_name,
          memo: batch.memo,
          created_at: batch.created_at.toISOString(),
        },
        items: items.rows.map((row) => {
          const used =
            typeof row.used_count === "string" ? Number.parseInt(row.used_count, 10) : Math.trunc(Number(row.used_count));
          const lim =
            row.usage_limit == null || String(row.usage_limit).trim() === ""
              ? null
              : typeof row.usage_limit === "string"
                ? Number.parseInt(row.usage_limit, 10)
                : Math.trunc(Number(row.usage_limit));
          const usedUp = Number.isFinite(used) && used > 0;
          const exhausted =
            lim != null && Number.isFinite(lim) && lim > 0 && Number.isFinite(used) && used >= lim;
          return {
            item_id: row.item_id,
            email: row.recipient_email,
            name: row.recipient_name,
            code: row.code,
            used: usedUp,
            exhausted,
            email_sent: Boolean(row.email_sent_at),
            email_sent_at: row.email_sent_at ? row.email_sent_at.toISOString() : null,
            email_error: row.email_error,
          };
        }),
      },
      "admin.bongsim.coupons.bulk.detail.response",
    );
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "42P01") {
      return jsonWithLeakGuard({ error: "batch_tables_missing" }, "admin.bongsim.coupons.bulk.detail", { status: 503 });
    }
    console.error("[admin/bongsim/coupons/bulk/[batchId]]", e);
    return jsonWithLeakGuard({ error: "detail_failed" }, "admin.bongsim.coupons.bulk.detail", { status: 500 });
  }
}
