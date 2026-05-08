import { getBongtourCronSecret, isAuthorizedCronRequest } from "@/lib/bongtour-cron-auth";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { jsonWithLeakGuard } from "@/lib/public-response-guard";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!getBongtourCronSecret()) {
    return jsonWithLeakGuard({ error: "cron_secret_unconfigured" }, "cron-coupon-expire", { status: 401 });
  }
  if (!isAuthorizedCronRequest(req)) {
    return jsonWithLeakGuard({ error: "unauthorized" }, "cron-coupon-expire", { status: 401 });
  }

  const pool = getPgPool();
  if (!pool) {
    return jsonWithLeakGuard({ error: "db_unconfigured" }, "cron-coupon-expire", { status: 503 });
  }

  try {
    const r = await pool.query<{ user_coupon_id: string }>(
      `UPDATE bongsim_user_coupon
          SET status = 'expired', updated_at = now()
        WHERE status = 'active'
          AND expires_at IS NOT NULL
          AND expires_at < now()
      RETURNING user_coupon_id::text AS user_coupon_id`,
    );
    return jsonWithLeakGuard({ ok: true, expired: r.rowCount ?? r.rows.length }, "cron-coupon-expire.response");
  } catch (e) {
    console.error("[cron/coupon-expire]", e);
    return jsonWithLeakGuard({ error: "update_failed" }, "cron-coupon-expire", { status: 500 });
  }
}
