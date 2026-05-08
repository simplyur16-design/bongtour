import { prisma } from "@/lib/prisma";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { issueUserCoupon } from "@/lib/bongsim/data/user-coupon";
import { assertNotSelfReferral, findReferralByCode, incrementInviteCount } from "@/lib/bongsim/data/referral";
import {
  notifyCouponReferralInvitee,
  notifyCouponWelcome,
} from "@/lib/notifications/coupon-notifications";
import { getTemplateBySlot } from "@/lib/coupon/issuance-helpers";

/**
 * 신규 User 생성 직후(이메일 가입 API 또는 NextAuth OAuth createUser).
 * PG 미설정·스키마 미적용 시 조용히 스킵.
 */
export async function runNewUserCouponBootstrap(userId: string): Promise<void> {
  const pool = getPgPool();
  if (!pool) return;
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, phone: true, referredByCode: true },
  });
  if (!u?.email) return;

  const client = await pool.connect();
  try {
    const welcome = await issueUserCoupon(client, {
      userId: u.id,
      userEmail: u.email,
      slot: "welcome",
    });
    if (welcome.issued) {
      const tpl = await getTemplateBySlot(client, "welcome");
      const amt = tpl ? Math.trunc(Number(tpl.discount_value)) || 0 : 0;
      await notifyCouponWelcome(
        { id: u.id, email: u.email, name: u.name, phone: u.phone },
        { amountKrw: amt, expiresAt: welcome.expiresAt ?? new Date() },
      );
    }

    const refCode = u.referredByCode?.trim();
    if (!refCode) return;

    const ref = await findReferralByCode(client, refCode);
    if (!ref) {
      await prisma.user.update({ where: { id: u.id }, data: { referredByCode: null, referredAt: null } });
      return;
    }
    try {
      assertNotSelfReferral(ref.inviter_user_id, u.id);
    } catch {
      await prisma.user.update({ where: { id: u.id }, data: { referredByCode: null, referredAt: null } });
      return;
    }

    await incrementInviteCount(client, ref.referral_id);

    const inv = await issueUserCoupon(client, {
      userId: u.id,
      userEmail: u.email,
      slot: "referral_invitee",
    });
    if (inv.issued) {
      const inviter = await prisma.user.findUnique({
        where: { id: ref.inviter_user_id },
        select: { name: true, email: true },
      });
      const tpl = await getTemplateBySlot(client, "referral_invitee");
      const amt = tpl ? Math.trunc(Number(tpl.discount_value)) || 0 : 0;
      await notifyCouponReferralInvitee(
        { id: u.id, email: u.email, name: u.name, phone: u.phone },
        { amountKrw: amt, expiresAt: inv.expiresAt ?? new Date() },
        { name: inviter?.name?.trim() || inviter?.email || "추천인" },
      );
    }
  } catch (e) {
    const er = e as { code?: string; message?: string };
    if (er.code === "42P01" || er.code === "42703") {
      console.warn("[bongsim:new-user-coupon] skipped (schema):", er.message);
      return;
    }
    console.warn("[bongsim:new-user-coupon]", e);
  } finally {
    client.release();
  }
}
