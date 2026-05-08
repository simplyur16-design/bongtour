import { getPgPool } from "@/lib/bongsim/db/pool";
import { jsonWithLeakGuard } from "@/lib/public-response-guard";
import { requireAdmin } from "@/lib/require-admin";
import { sendTravelEsimGratitudeCouponMail } from "@/lib/bongsim/email/travel-esim-gratitude-coupon-mail";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RouteCtx = { params: Promise<{ batchId: string }> };

export async function POST(req: Request, ctx: RouteCtx) {
  const admin = await requireAdmin();
  if (!admin) return jsonWithLeakGuard({ error: "unauthorized" }, "admin.bongsim.coupons.bulk.resend", { status: 401 });

  const { batchId: raw } = await ctx.params;
  const batchId = (raw ?? "").trim();
  if (!UUID_RE.test(batchId)) {
    return jsonWithLeakGuard({ error: "invalid_batch_id" }, "admin.bongsim.coupons.bulk.resend", { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonWithLeakGuard({ error: "invalid_json" }, "admin.bongsim.coupons.bulk.resend", { status: 400 });
  }
  const itemId = typeof (body as { item_id?: unknown }).item_id === "string" ? (body as { item_id: string }).item_id.trim() : "";
  if (!UUID_RE.test(itemId)) {
    return jsonWithLeakGuard({ error: "invalid_item_id" }, "admin.bongsim.coupons.bulk.resend", { status: 400 });
  }

  const pool = getPgPool();
  if (!pool) return jsonWithLeakGuard({ error: "db_unconfigured" }, "admin.bongsim.coupons.bulk.resend", { status: 503 });

  try {
    const r = await pool.query<{
      recipient_email: string;
      recipient_name: string | null;
      trip_name: string;
      departure_date: string;
      code: string;
    }>(
      `SELECT i.recipient_email, i.recipient_name, b.trip_name, b.departure_date::text AS departure_date, c.code
       FROM bongsim_coupon_batch_item i
       JOIN bongsim_coupon_batch b ON b.batch_id = i.batch_id
       JOIN bongsim_coupon c ON c.coupon_id = i.coupon_id
       WHERE i.item_id = $1::uuid AND i.batch_id = $2::uuid
       LIMIT 1`,
      [itemId, batchId],
    );
    const row = r.rows[0];
    if (!row) {
      return jsonWithLeakGuard({ error: "not_found" }, "admin.bongsim.coupons.bulk.resend", { status: 404 });
    }

    const send = await sendTravelEsimGratitudeCouponMail({
      to: row.recipient_email,
      recipientName: row.recipient_name,
      tripName: row.trip_name,
      departureDateYmd: row.departure_date,
      couponCode: row.code,
    });

    if (send.ok) {
      await pool.query(
        `UPDATE bongsim_coupon_batch_item SET email_sent_at = now(), email_error = NULL WHERE item_id = $1::uuid`,
        [itemId],
      );
      return jsonWithLeakGuard(
        { ok: true as const, email_sent: true },
        "admin.bongsim.coupons.bulk.resend.response",
      );
    }

    await pool.query(`UPDATE bongsim_coupon_batch_item SET email_error = $2 WHERE item_id = $1::uuid`, [
      itemId,
      send.error,
    ]);
    return jsonWithLeakGuard(
      { ok: true as const, email_sent: false, error: send.error },
      "admin.bongsim.coupons.bulk.resend.response",
    );
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "42P01") {
      return jsonWithLeakGuard({ error: "batch_tables_missing" }, "admin.bongsim.coupons.bulk.resend", { status: 503 });
    }
    console.error("[admin/bongsim/coupons/bulk/resend-email]", e);
    return jsonWithLeakGuard({ error: "resend_failed" }, "admin.bongsim.coupons.bulk.resend", { status: 500 });
  }
}
