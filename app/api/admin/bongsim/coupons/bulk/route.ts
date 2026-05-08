import { randomBytes } from "node:crypto";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { jsonWithLeakGuard } from "@/lib/public-response-guard";
import { requireAdmin } from "@/lib/require-admin";
import { sendTravelEsimGratitudeCouponMail } from "@/lib/bongsim/email/travel-esim-gratitude-coupon-mail";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

type RecipientIn = { email?: unknown; name?: unknown };

type BulkTravelBody = {
  trip_name?: unknown;
  departure_date?: unknown;
  adult_count?: unknown;
  recipients?: unknown;
  memo?: unknown;
};

function seoulYmd(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

function genTravelCouponCode(): string {
  const pick = () => CODE_CHARSET[randomBytes(1)[0]! % CODE_CHARSET.length];
  const seg = (n: number) => Array.from({ length: n }, pick).join("");
  return `BT-${seg(4)}-${seg(4)}`;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return jsonWithLeakGuard({ error: "unauthorized" }, "admin.bongsim.coupons.bulk.list", { status: 401 });

  const pool = getPgPool();
  if (!pool) return jsonWithLeakGuard({ error: "db_unconfigured" }, "admin.bongsim.coupons.bulk.list", { status: 503 });

  try {
    const r = await pool.query<{
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
       ORDER BY b.created_at DESC
       LIMIT 200`,
    );
    return jsonWithLeakGuard(
      {
        ok: true as const,
        batches: r.rows.map((row) => ({
          batch_id: row.batch_id,
          trip_name: row.trip_name,
          departure_date: row.departure_date,
          adult_count: row.adult_count,
          issued_by: row.issued_by,
          issuer_name: row.issuer_name,
          memo: row.memo,
          created_at: row.created_at.toISOString(),
        })),
      },
      "admin.bongsim.coupons.bulk.list.response",
    );
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "42P01") {
      return jsonWithLeakGuard({ error: "batch_tables_missing" }, "admin.bongsim.coupons.bulk.list", { status: 503 });
    }
    console.error("[admin/bongsim/coupons/bulk GET]", e);
    return jsonWithLeakGuard({ error: "list_failed" }, "admin.bongsim.coupons.bulk.list", { status: 500 });
  }
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return jsonWithLeakGuard({ error: "unauthorized" }, "admin.bongsim.coupons.bulk.issue", { status: 401 });

  const issuerId = (admin.user?.id ?? "").trim() || "unknown";

  let body: BulkTravelBody;
  try {
    body = (await req.json()) as BulkTravelBody;
  } catch {
    return jsonWithLeakGuard({ error: "invalid_json" }, "admin.bongsim.coupons.bulk.issue", { status: 400 });
  }

  const tripName = typeof body.trip_name === "string" ? body.trip_name.trim() : "";
  const departureRaw = typeof body.departure_date === "string" ? body.departure_date.trim() : "";
  const memo = typeof body.memo === "string" ? body.memo.trim().slice(0, 2000) : "";
  const adultCount =
    typeof body.adult_count === "number" && Number.isFinite(body.adult_count) ? Math.trunc(body.adult_count) : Number.NaN;

  if (!tripName || tripName.length > 500) {
    return jsonWithLeakGuard({ error: "invalid_trip_name" }, "admin.bongsim.coupons.bulk.issue", { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(departureRaw)) {
    return jsonWithLeakGuard({ error: "invalid_departure_date" }, "admin.bongsim.coupons.bulk.issue", { status: 400 });
  }
  const todaySeoul = seoulYmd(new Date());
  if (departureRaw <= todaySeoul) {
    return jsonWithLeakGuard({ error: "departure_must_be_after_today" }, "admin.bongsim.coupons.bulk.issue", { status: 400 });
  }
  if (!Number.isFinite(adultCount) || adultCount < 1 || adultCount > 500) {
    return jsonWithLeakGuard({ error: "invalid_adult_count" }, "admin.bongsim.coupons.bulk.issue", { status: 400 });
  }

  if (!Array.isArray(body.recipients)) {
    return jsonWithLeakGuard({ error: "invalid_recipients" }, "admin.bongsim.coupons.bulk.issue", { status: 400 });
  }
  if (body.recipients.length !== adultCount) {
    return jsonWithLeakGuard({ error: "recipients_count_mismatch" }, "admin.bongsim.coupons.bulk.issue", { status: 400 });
  }

  const recipients: { email: string; name: string | null }[] = [];
  for (const raw of body.recipients as RecipientIn[]) {
    const email = typeof raw.email === "string" ? raw.email.trim().toLowerCase() : "";
    const name = typeof raw.name === "string" ? raw.name.trim().slice(0, 80) : "";
    if (!email || !EMAIL_RE.test(email)) {
      return jsonWithLeakGuard({ error: "invalid_recipient_email" }, "admin.bongsim.coupons.bulk.issue", { status: 400 });
    }
    recipients.push({ email, name: name || null });
  }

  const validFrom = new Date();
  const validUntil = new Date(`${departureRaw}T23:59:59+09:00`);
  if (Number.isNaN(validUntil.getTime())) {
    return jsonWithLeakGuard({ error: "invalid_departure_date" }, "admin.bongsim.coupons.bulk.issue", { status: 400 });
  }

  const couponDescription = `[eSIM 여행감사] ${tripName.slice(0, 200)} · 출발 ${departureRaw}`.slice(0, 500);
  const pool = getPgPool();
  if (!pool) return jsonWithLeakGuard({ error: "db_unconfigured" }, "admin.bongsim.coupons.bulk.issue", { status: 503 });

  type IssuedRow = { item_id: string; email: string; name: string | null; code: string };
  const issued: IssuedRow[] = [];

  const client = await pool.connect();
  let batchId: string;
  try {
    await client.query("BEGIN");
    const br = await client.query<{ batch_id: string }>(
      `INSERT INTO bongsim_coupon_batch (trip_name, departure_date, adult_count, issued_by, memo)
       VALUES ($1, $2::date, $3, $4, $5)
       RETURNING batch_id::text AS batch_id`,
      [tripName, departureRaw, adultCount, issuerId, memo || null],
    );
    const b = br.rows[0];
    if (!b) throw new Error("batch_insert_failed");
    batchId = b.batch_id;

    for (const rec of recipients) {
      let inserted = false;
      let couponId = "";
      let code = "";
      for (let attempt = 0; attempt < 12 && !inserted; attempt++) {
        code = genTravelCouponCode();
        try {
          const cr = await client.query<{ coupon_id: string }>(
            `INSERT INTO bongsim_coupon (
               code, description, discount_type, discount_value, max_discount_krw, min_order_krw,
               usage_limit, used_count, valid_from, valid_until, is_active, coupon_kind,
               template_label, template_validity_days
             ) VALUES ($1, $2, 'percentage', $3::numeric, NULL, 0, 1, 0, $4, $5, true, 'public_code', NULL, NULL)
             RETURNING coupon_id::text AS coupon_id`,
            [code.slice(0, 64), couponDescription, "100", validFrom.toISOString(), validUntil.toISOString()],
          );
          const crow = cr.rows[0];
          if (!crow) throw new Error("coupon_insert_empty");
          couponId = crow.coupon_id;
          inserted = true;
        } catch (e) {
          const err = e as { code?: string };
          if (err.code === "23505") continue;
          throw e;
        }
      }
      if (!inserted) {
        await client.query("ROLLBACK");
        return jsonWithLeakGuard({ error: "unique_collision_exhausted" }, "admin.bongsim.coupons.bulk.issue", {
          status: 409,
        });
      }

      const ir = await client.query<{ item_id: string }>(
        `INSERT INTO bongsim_coupon_batch_item (batch_id, recipient_email, recipient_name, coupon_id)
         VALUES ($1::uuid, $2, $3, $4::uuid)
         RETURNING item_id::text AS item_id`,
        [batchId, rec.email, rec.name, couponId],
      );
      const irow = ir.rows[0];
      if (!irow) throw new Error("batch_item_insert_failed");
      issued.push({ item_id: irow.item_id, email: rec.email, name: rec.name, code });
    }

    await client.query("COMMIT");
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* noop */
    }
    const err = e as { code?: string };
    if (err.code === "42P01") {
      return jsonWithLeakGuard({ error: "batch_tables_missing" }, "admin.bongsim.coupons.bulk.issue", { status: 503 });
    }
    console.error("[admin/bongsim/coupons/bulk POST]", e);
    return jsonWithLeakGuard({ error: "issue_failed" }, "admin.bongsim.coupons.bulk.issue", { status: 500 });
  } finally {
    client.release();
  }

  const results: Array<{
    item_id: string;
    email: string;
    code: string;
    email_sent: boolean;
    error?: string;
  }> = [];

  for (const row of issued) {
    const send = await sendTravelEsimGratitudeCouponMail({
      to: row.email,
      recipientName: row.name,
      tripName,
      departureDateYmd: departureRaw,
      couponCode: row.code,
    });
    if (send.ok) {
      results.push({ item_id: row.item_id, email: row.email, code: row.code, email_sent: true });
      try {
        await pool.query(
          `UPDATE bongsim_coupon_batch_item SET email_sent_at = now(), email_error = NULL WHERE item_id = $1::uuid`,
          [row.item_id],
        );
      } catch (updErr) {
        console.warn("[admin/bongsim/coupons/bulk] email_sent_at update failed", updErr);
      }
    } else {
      results.push({
        item_id: row.item_id,
        email: row.email,
        code: row.code,
        email_sent: false,
        error: send.error,
      });
      try {
        await pool.query(`UPDATE bongsim_coupon_batch_item SET email_error = $2 WHERE item_id = $1::uuid`, [
          row.item_id,
          send.error,
        ]);
      } catch (updErr) {
        console.warn("[admin/bongsim/coupons/bulk] email_error update failed", updErr);
      }
    }
  }

  return jsonWithLeakGuard(
    {
      ok: true as const,
      batch_id: batchId,
      issued_count: results.length,
      results,
    },
    "admin.bongsim.coupons.bulk.issue.response",
  );
}
