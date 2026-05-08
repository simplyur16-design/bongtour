import { auth } from "@/auth";
import { jsonWithLeakGuard } from "@/lib/public-response-guard";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { validateBongsimCouponForDisplay, bongsimCheckoutSubtotalKrw } from "@/lib/bongsim/data/bongsim-coupon";
import { validateUserCoupon } from "@/lib/bongsim/data/user-coupon";
import { isReservedTemplateCode } from "@/lib/coupon/reserved-template-code";

export const dynamic = "force-dynamic";

type Body = {
  code?: unknown;
  user_coupon_id?: unknown;
  option_api_id?: unknown;
  quantity?: unknown;
};

export async function POST(req: Request) {
  const pool = getPgPool();
  if (!pool) {
    return jsonWithLeakGuard({ ok: false, error: "데이터베이스가 설정되지 않았습니다." }, "bongsim.coupon.validate", {
      status: 503,
    });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return jsonWithLeakGuard({ ok: false, error: "요청 본문이 올바르지 않습니다." }, "bongsim.coupon.validate", {
      status: 400,
    });
  }

  if (Array.isArray(body.code) || Array.isArray(body.user_coupon_id)) {
    return jsonWithLeakGuard({ ok: false, error: "쿠폰은 하나만 적용할 수 있습니다." }, "bongsim.coupon.validate", {
      status: 400,
    });
  }

  const option_api_id = typeof body.option_api_id === "string" ? body.option_api_id.trim() : "";
  const qRaw = body.quantity;
  const quantity =
    typeof qRaw === "number" ? qRaw : typeof qRaw === "string" ? Number.parseInt(qRaw, 10) : Number.NaN;

  if (!option_api_id) {
    return jsonWithLeakGuard({ ok: false, error: "상품 정보가 필요합니다." }, "bongsim.coupon.validate", { status: 400 });
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    return jsonWithLeakGuard({ ok: false, error: "수량이 올바르지 않습니다." }, "bongsim.coupon.validate", { status: 400 });
  }

  const userCouponId = typeof body.user_coupon_id === "string" ? body.user_coupon_id.trim() : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";

  if (!userCouponId && !code) {
    return jsonWithLeakGuard({ ok: false, error: "쿠폰 코드 또는 내 쿠폰을 선택해 주세요." }, "bongsim.coupon.validate", {
      status: 400,
    });
  }

  if (userCouponId && code) {
    return jsonWithLeakGuard(
      { ok: false, error: "쿠폰 코드와 내 쿠폰은 함께 보낼 수 없습니다." },
      "bongsim.coupon.validate",
      { status: 400 },
    );
  }

  const c = await pool.connect();
  try {
    if (userCouponId) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userCouponId)) {
        return jsonWithLeakGuard({ ok: false, error: "쿠폰 정보가 올바르지 않습니다." }, "bongsim.coupon.validate", {
          status: 400,
        });
      }
      const session = await auth();
      const userId = ((session?.user as { id?: string } | undefined)?.id ?? "").trim();
      if (!userId) {
        return jsonWithLeakGuard({ ok: false, error: "로그인이 필요합니다." }, "bongsim.coupon.validate", { status: 401 });
      }
      const st = await bongsimCheckoutSubtotalKrw(c, option_api_id, quantity);
      if (!st.ok) {
        return jsonWithLeakGuard({ ok: false, error: st.error }, "bongsim.coupon.validate", { status: 400 });
      }
      const v = await validateUserCoupon(c, userCouponId, userId, st.subtotal_krw);
      if (!v.ok) {
        return jsonWithLeakGuard({ ok: false, error: v.error }, "bongsim.coupon.validate", { status: 400 });
      }
      return jsonWithLeakGuard(
        {
          ok: true,
          discount_krw: v.discount_krw,
          user_coupon_id: v.user_coupon_id,
          description: v.description,
          subtotal_krw: v.subtotal_krw,
        },
        "bongsim.coupon.validate",
      );
    }

    if (isReservedTemplateCode(code)) {
      return jsonWithLeakGuard({ ok: false, error: "해당 코드는 사용할 수 없습니다." }, "bongsim.coupon.validate", {
        status: 400,
      });
    }
    const v = await validateBongsimCouponForDisplay(c, { code, option_api_id, quantity });
    if (!v.ok) {
      return jsonWithLeakGuard({ ok: false, error: v.error }, "bongsim.coupon.validate", { status: 400 });
    }
    return jsonWithLeakGuard(
      {
        ok: true,
        discount_krw: v.discount_krw,
        coupon_id: v.coupon_id,
        description: v.description,
        subtotal_krw: v.subtotal_krw,
      },
      "bongsim.coupon.validate",
    );
  } finally {
    c.release();
  }
}
