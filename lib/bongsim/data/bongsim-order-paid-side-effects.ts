import { parseCouponMetaFromOrderConsents } from "@/lib/bongsim/data/bongsim-coupon";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { markUserCouponUsed } from "@/lib/bongsim/data/user-coupon";

/**
 * 결제 메인 트랜잭션 커밋 이후 best-effort 후처리(사용자 쿠폰 사용 처리).
 * 실패해도 결제 성공 상태는 유지한다.
 */
export async function runBongsimOrderPaidSideEffects(orderId: string): Promise<void> {
  const pool = getPgPool();
  if (!pool) return;
  const client = await pool.connect();
  try {
    const o = await client.query<{
      consents: unknown;
      buyer_email: string;
      order_number: string;
      discount_krw: string;
    }>(
      `SELECT consents, buyer_email, order_number, discount_krw::text AS discount_krw
       FROM bongsim_order WHERE order_id = $1::uuid LIMIT 1`,
      [orderId],
    );
    const row = o.rows[0];
    if (!row) return;

    const meta = parseCouponMetaFromOrderConsents(row.consents);
    if (meta.user_coupon_id && meta.coupon_discount_krw > 0) {
      try {
        await markUserCouponUsed(client, meta.user_coupon_id, orderId, meta.coupon_discount_krw);
      } catch (e) {
        console.warn("[bongsim:paid-side-effects] markUserCouponUsed", e);
      }
    }
  } finally {
    client.release();
  }
}
