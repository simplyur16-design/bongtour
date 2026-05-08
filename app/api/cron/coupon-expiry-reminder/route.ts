import { notifyCouponExpiry } from "@/lib/notifications/coupon-notifications";
import { getBongtourCronSecret, isAuthorizedCronRequest } from "@/lib/bongtour-cron-auth";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { jsonWithLeakGuard } from "@/lib/public-response-guard";

export const dynamic = "force-dynamic";

type ReminderRow = {
  user_coupon_id: string;
  user_id: string;
  user_email: string;
  source_coupon_id: string;
  expires_at: Date;
  coupon_label: string | null;
  amount: string | null;
  phone: string | null;
  name: string | null;
};

export async function POST(req: Request) {
  if (!getBongtourCronSecret()) {
    return jsonWithLeakGuard({ error: "cron_secret_unconfigured" }, "cron-coupon-expiry-reminder", { status: 401 });
  }
  if (!isAuthorizedCronRequest(req)) {
    return jsonWithLeakGuard({ error: "unauthorized" }, "cron-coupon-expiry-reminder", { status: 401 });
  }

  const pool = getPgPool();
  if (!pool) {
    return jsonWithLeakGuard({ error: "db_unconfigured" }, "cron-coupon-expiry-reminder", { status: 503 });
  }

  let rows: ReminderRow[];
  try {
    const r = await pool.query<ReminderRow>(
      `SELECT uc.user_coupon_id::text AS user_coupon_id,
              uc.user_id::text AS user_id,
              uc.user_email,
              uc.source_coupon_id::text AS source_coupon_id,
              uc.expires_at,
              (SELECT c.template_label FROM bongsim_coupon c WHERE c.coupon_id = uc.source_coupon_id) AS coupon_label,
              (SELECT c.discount_value::text FROM bongsim_coupon c WHERE c.coupon_id = uc.source_coupon_id) AS amount,
              u.phone AS phone,
              u.name AS name
         FROM bongsim_user_coupon uc
         LEFT JOIN "User" u ON u.id = uc.user_id
        WHERE uc.status = 'active'
          AND uc.expiry_reminder_sent_at IS NULL
          AND uc.expires_at IS NOT NULL
          AND uc.expires_at BETWEEN now() AND now() + interval '3 days'
        LIMIT 500`,
    );
    rows = r.rows;
  } catch (e) {
    console.error("[cron/coupon-expiry-reminder] query", e);
    return jsonWithLeakGuard({ error: "query_failed" }, "cron-coupon-expiry-reminder", { status: 500 });
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const processed = rows.length;

  for (const row of rows) {
    try {
      const dr = await notifyCouponExpiry(
        {
          id: row.user_id,
          email: row.user_email,
          name: row.name,
          phone: row.phone,
        },
        {
          amountKrw: row.amount ?? "0",
          expiresAt: row.expires_at,
          couponLabel: row.coupon_label,
        },
      );
      if (!dr.ok) failed += 1;
      else if (dr.dryRun) skipped += 1;
      else sent += 1;
    } catch {
      failed += 1;
    }

    try {
      await pool.query(`UPDATE bongsim_user_coupon SET expiry_reminder_sent_at = now() WHERE user_coupon_id = $1::uuid`, [
        row.user_coupon_id,
      ]);
    } catch (e) {
      console.error("[cron/coupon-expiry-reminder] stamp", row.user_coupon_id, e);
    }
  }

  return jsonWithLeakGuard(
    { ok: true, processed, sent, skipped, failed },
    "cron-coupon-expiry-reminder.response",
  );
}
