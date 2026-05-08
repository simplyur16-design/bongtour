import { adminGetReviewById } from "@/lib/reviews-db";
import { prisma } from "@/lib/prisma";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { findReviewRewardForReviewId, issueUserCoupon } from "@/lib/bongsim/data/user-coupon";
import { getTemplateBySlot } from "@/lib/coupon/issuance-helpers";
import { notifyCouponReviewReward } from "@/lib/notifications/coupon-notifications";

/** 관리자 게시 승인 직후 — 리뷰 작성자에게 보상 쿠폰(멱등). */
export async function maybeIssueTravelReviewPublishedCoupon(reviewId: string): Promise<void> {
  const row = await adminGetReviewById(reviewId);
  if (!row || row.status !== "published") return;
  if (row.source_type !== "customer_submitted") return;

  const userId = row.user_id?.trim();
  if (!userId) return;

  const pool = getPgPool();
  if (!pool) return;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, phone: true },
  });
  if (!user?.email) return;

  const client = await pool.connect();
  try {
    const exists = await findReviewRewardForReviewId(client, user.id, reviewId);
    if (exists) return;

    const issued = await issueUserCoupon(client, {
      userId: user.id,
      userEmail: user.email,
      slot: "review",
      notes: `review_id:${reviewId}`,
    });
    if (!issued.issued) return;

    const tpl = await getTemplateBySlot(client, "review");
    const amt = tpl ? Math.trunc(Number(tpl.discount_value)) || 0 : 0;
    await notifyCouponReviewReward(
      { id: user.id, email: user.email, name: user.name, phone: user.phone },
      { amountKrw: amt, expiresAt: issued.expiresAt ?? new Date() },
    );
  } catch (e) {
    const er = e as { code?: string; message?: string };
    if (er.code === "42P01" || er.code === "42703") {
      console.warn("[bongsim:review-coupon] skipped (schema):", er.message);
      return;
    }
    console.warn("[bongsim:review-coupon]", e);
  } finally {
    client.release();
  }
}
