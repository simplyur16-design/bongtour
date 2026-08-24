import type { Pool } from "pg";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { resolveBuyerPhoneForOrder } from "@/lib/bongsim/data/resolve-buyer-phone";
import { sendTravelEsimRefundDoneMail } from "@/lib/bongsim/email/travel-esim-refund-done-mail";
import { sendRefundDoneAlimTalk } from "@/lib/bongsim/notifications/refund-done-alimtalk";
import { sendSimplyurRefundDoneMail } from "@/lib/simplyur/email/simplyur-refund-done-mail";
import {
  buildSimplyurMyEsimAbsoluteUrl,
  simplyurLocaleFromConsents,
  simplyurNotifyRequiresKakaoPhone,
} from "@/lib/simplyur/notify/simplyur-qr-notify-policy";

const REFUND_COMPLETED_KIND = "refund_completed";

export function formatRefundAmountKrw(krw: number): string {
  if (!Number.isFinite(krw) || krw < 0) return "0";
  return new Intl.NumberFormat("ko-KR").format(Math.trunc(krw));
}

async function hasRefundCompletedEvent(db: Pool, orderId: string): Promise<boolean> {
  const r = await db.query<{ ok: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM bongsim_fulfillment_event
        WHERE order_id = $1::uuid AND kind = $2
     ) AS ok`,
    [orderId, REFUND_COMPLETED_KIND],
  );
  return Boolean(r.rows[0]?.ok);
}

async function resolveFulfillmentJobId(db: Pool, orderId: string): Promise<string | null> {
  const r = await db.query<{ job_id: string }>(
    `SELECT job_id::text AS job_id
       FROM bongsim_fulfillment_job
      WHERE order_id = $1::uuid
      ORDER BY created_at DESC NULLS LAST
      LIMIT 1`,
    [orderId],
  );
  return r.rows[0]?.job_id ?? null;
}

async function insertRefundCompletedEvent(
  db: Pool,
  orderId: string,
  jobId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await db.query(
    `INSERT INTO bongsim_fulfillment_event (order_id, job_id, kind, payload_json)
     VALUES ($1::uuid, $2::uuid, $3, $4::jsonb)`,
    [orderId, jobId, REFUND_COMPLETED_KIND, JSON.stringify(payload)],
  );
}

/**
 * PG 환불·`refunded` 전환 직후 고객 알림(알림톡·이메일).
 * 멱등: `refund_completed` fulfillment_event 가 있으면 skip.
 * 실패해도 throw 하지 않음(환불은 이미 완료).
 */
export async function notifyRefundCompletedBestEffort(orderId: string): Promise<void> {
  const id = orderId.trim();
  const pool = getPgPool();
  if (!pool) {
    console.error("[notifyRefundCompleted] db_unconfigured", { orderId: id });
    return;
  }

  try {
    if (await hasRefundCompletedEvent(pool, id)) {
      return;
    }

    const o = await pool.query<{
      order_number: string;
      buyer_email: string;
      paid_amount_krw: string | null;
      grand_total_krw: string;
      status: string;
      checkout_channel: string | null;
      consents: unknown;
    }>(
      `SELECT order_number, buyer_email, paid_amount_krw::text, grand_total_krw::text, status,
              checkout_channel, consents
         FROM bongsim_order WHERE order_id = $1::uuid LIMIT 1`,
      [id],
    );
    const row = o.rows[0];
    if (!row || row.status !== "refunded") {
      console.warn("[notifyRefundCompleted] skip_not_refunded", { orderId: id, status: row?.status });
      return;
    }

    const paid = row.paid_amount_krw != null ? Number.parseInt(row.paid_amount_krw, 10) : NaN;
    const grand = Number.parseInt(row.grand_total_krw, 10);
    const amountKrw = Number.isFinite(paid) && paid > 0 ? paid : grand;
    const refundAmount = formatRefundAmountKrw(amountKrw);
    const orderNumber = row.order_number.trim();

    const requireKakaoPhone = simplyurNotifyRequiresKakaoPhone(row.checkout_channel);
    const jobId = await resolveFulfillmentJobId(pool, id);
    if (!jobId) {
      if (requireKakaoPhone) {
        console.warn("[notifyRefundCompleted] no_fulfillment_job", { orderId: id });
        return;
      }
    } else {
      await insertRefundCompletedEvent(pool, id, jobId, {
        orderNumber,
        refundAmount,
        refund_amount_krw: Math.trunc(amountKrw),
      });
    }

    if (requireKakaoPhone) {
      const phone = await resolveBuyerPhoneForOrder(id);
      if (phone) {
        const alim = await sendRefundDoneAlimTalk(id, {
          customerPhone: phone,
          orderNumber,
          refundAmount,
        });
        if (!alim.ok) {
          console.warn("[notifyRefundCompleted] alimtalk_failed", { orderId: id, detail: alim.detail });
        }
      } else {
        console.warn("[notifyRefundCompleted] no_phone", { orderId: id });
      }

      const mail = await sendTravelEsimRefundDoneMail({
        to: row.buyer_email,
        orderNumber,
        refundAmount,
      });
      if (!mail.ok) {
        console.warn("[notifyRefundCompleted] email_failed", { orderId: id, error: mail.error });
      }
    } else {
      const locale = simplyurLocaleFromConsents(row.consents);
      const mail = await sendSimplyurRefundDoneMail({
        to: row.buyer_email,
        orderNumber,
        myEsimUrl: buildSimplyurMyEsimAbsoluteUrl(locale),
      });
      if (!mail.ok) {
        console.warn("[notifyRefundCompleted] simplyur_email_failed", { orderId: id, error: mail.error });
      }
    }
  } catch (e) {
    console.error("[notifyRefundCompleted]", {
      orderId: id,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
