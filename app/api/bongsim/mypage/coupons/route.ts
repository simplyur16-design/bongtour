import { jsonWithLeakGuard } from "@/lib/public-response-guard";
import { auth } from "@/auth";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { listUserCoupons } from "@/lib/bongsim/data/user-coupon";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  const userId = ((session?.user as { id?: string } | undefined)?.id ?? "").trim();
  if (!userId) {
    return jsonWithLeakGuard({ error: "unauthorized" }, "bongsim.mypage.coupons.list", { status: 401 });
  }

  const pool = getPgPool();
  if (!pool) {
    return jsonWithLeakGuard({ error: "db_unconfigured" }, "bongsim.mypage.coupons.list", { status: 503 });
  }

  const c = await pool.connect();
  try {
    const { active, used, expired } = await listUserCoupons(c, userId);
    const mapRow = (r: (typeof active)[0]) => ({
      user_coupon_id: r.user_coupon_id,
      template_label: r.template_label ?? "쿠폰",
      discount_type: r.discount_type,
      discount_value: r.discount_value,
      max_discount_krw: r.max_discount_krw,
      min_order_krw: r.min_order_krw,
      expires_at: r.expires_at ? new Date(r.expires_at).toISOString() : null,
      status: r.status,
      used_at: r.used_at ? new Date(r.used_at).toISOString() : null,
    });
    return jsonWithLeakGuard(
      {
        active: active.map(mapRow),
        used: used.map(mapRow),
        expired: expired.map(mapRow),
      },
      "bongsim.mypage.coupons.list",
    );
  } catch (e) {
    console.error("[bongsim/mypage/coupons]", e);
    return jsonWithLeakGuard({ error: "db_error" }, "bongsim.mypage.coupons.list", { status: 500 });
  } finally {
    c.release();
  }
}
