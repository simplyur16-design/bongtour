import { prisma } from "@/lib/prisma";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { issueUserCoupon } from "@/lib/bongsim/data/user-coupon";
import { notifyCouponWelcome } from "@/lib/notifications/coupon-notifications";
import { getTemplateBySlot } from "@/lib/coupon/issuance-helpers";

export type NewUserCouponBootstrapResult = {
  welcomeIssued: boolean;
  reason: "ok" | "no-pg" | "no-email" | "no-marketing-consent" | "welcome-skip-existing" | "welcome-not-issued";
};

/**
 * 신규 User 생성 직후(이메일 가입 API 또는 OAuth 콜백).
 * welcome 쿠폰은 User.marketingConsent === true 일 때만 발급.
 * PG 미설정·스키마 미적용 시 조용히 스킵.
 */
export async function runNewUserCouponBootstrap(userId: string): Promise<NewUserCouponBootstrapResult> {
  const pool = getPgPool();
  if (!pool) {
    console.warn("[bongsim:new-user-coupon] skipped: no-pg");
    return { welcomeIssued: false, reason: "no-pg" };
  }
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, phone: true, marketingConsent: true },
  });
  if (!u?.email) {
    console.warn("[bongsim:new-user-coupon] skipped: no-email", { userId });
    return { welcomeIssued: false, reason: "no-email" };
  }
  if (!u.marketingConsent) {
    console.warn("[bongsim:new-user-coupon] welcome skipped: no-marketing-consent", { userId });
    return { welcomeIssued: false, reason: "no-marketing-consent" };
  }

  const client = await pool.connect();
  try {
    const welcome = await issueUserCoupon(client, {
      userId: u.id,
      userEmail: u.email,
      slot: "welcome",
    });
    if (!welcome.issued) {
      return { welcomeIssued: false, reason: "welcome-skip-existing" };
    }
    const tpl = await getTemplateBySlot(client, "welcome");
    const amt = tpl ? Math.trunc(Number(tpl.discount_value)) || 0 : 0;
    await notifyCouponWelcome(
      { id: u.id, email: u.email, name: u.name, phone: u.phone },
      { amountKrw: amt, expiresAt: welcome.expiresAt ?? new Date() },
    );
    return { welcomeIssued: true, reason: "ok" };
  } catch (e) {
    const er = e as { code?: string; message?: string };
    if (er.code === "42P01" || er.code === "42703") {
      console.warn("[bongsim:new-user-coupon] skipped (schema):", er.message);
      return { welcomeIssued: false, reason: "welcome-not-issued" };
    }
    console.warn("[bongsim:new-user-coupon]", e);
    return { welcomeIssued: false, reason: "welcome-not-issued" };
  } finally {
    client.release();
  }
}
