import { prisma } from "@/lib/prisma";
import { parseCouponMetaFromOrderConsents } from "@/lib/bongsim/data/bongsim-coupon";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { issueUserCoupon, markUserCouponUsed } from "@/lib/bongsim/data/user-coupon";
import { assertNotSelfReferral, findReferralByCode, incrementRewardedCount } from "@/lib/bongsim/data/referral";
import { getTemplateBySlot } from "@/lib/coupon/issuance-helpers";
import { notifyCouponReferralInviter } from "@/lib/notifications/coupon-notifications";

/**
 * 결제 메인 트랜잭션 커밋 이후 best-effort 후처리(사용자 쿠폰 사용 처리·추천인 지연 보상).
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

    try {
      await maybeRewardReferrerOnFirstPaidOrder(client, {
        orderId,
        buyerEmail: row.buyer_email,
        orderNumber: row.order_number,
        consents: row.consents,
      });
    } catch (e) {
      console.warn("[bongsim:paid-side-effects] inviter_reward", e);
    }
  } finally {
    client.release();
  }
}

async function maybeRewardReferrerOnFirstPaidOrder(
  client: import("pg").PoolClient,
  input: { orderId: string; buyerEmail: string; orderNumber: string; consents: unknown },
): Promise<void> {
  const email = input.buyerEmail.trim().toLowerCase();
  if (!email) return;

  const consentsObj = input.consents && typeof input.consents === "object" ? (input.consents as Record<string, unknown>) : {};
  const sessionUid = typeof consentsObj.bongtour_user_id === "string" ? consentsObj.bongtour_user_id.trim() : "";

  const buyer =
    (sessionUid
      ? await prisma.user.findFirst({
          where: { id: sessionUid },
          select: { id: true, email: true, name: true, phone: true, referredByCode: true, inviterRewardedAt: true },
        })
      : null) ??
    (await prisma.user.findFirst({
      where: { email },
      select: { id: true, email: true, name: true, phone: true, referredByCode: true, inviterRewardedAt: true },
    }));

  if (!buyer?.referredByCode?.trim()) return;
  if (buyer.inviterRewardedAt != null) return;

  const ref = await findReferralByCode(client, buyer.referredByCode);
  if (!ref) {
    await prisma.user.update({ where: { id: buyer.id }, data: { referredByCode: null, referredAt: null } });
    return;
  }

  try {
    assertNotSelfReferral(ref.inviter_user_id, buyer.id);
  } catch {
    await prisma.user.update({ where: { id: buyer.id }, data: { referredByCode: null, referredAt: null } });
    return;
  }

  const inviter = await prisma.user.findUnique({
    where: { id: ref.inviter_user_id },
    select: { id: true, email: true, name: true, phone: true },
  });
  if (!inviter?.email) return;

  const issued = await issueUserCoupon(client, {
    userId: inviter.id,
    userEmail: inviter.email,
    slot: "referral_inviter",
    notes: `초대한 ${input.buyerEmail} 첫 결제 ${input.orderNumber}`,
  });
  if (!issued.issued || !issued.userCouponId) return;

  await incrementRewardedCount(client, ref.referral_id);
  await prisma.user.update({ where: { id: buyer.id }, data: { inviterRewardedAt: new Date() } });

  const tpl = await getTemplateBySlot(client, "referral_inviter");
  const amt = tpl ? Math.trunc(Number(tpl.discount_value)) || 0 : 0;
  const inviterGrant = {
    amountKrw: amt,
    expiresAt: issued.expiresAt ?? new Date(),
  };
  await notifyCouponReferralInviter(
    { id: inviter.id, email: inviter.email, name: inviter.name, phone: inviter.phone },
    inviterGrant,
    { name: buyer.name?.trim() || buyer.email || "친구" },
  );
}
