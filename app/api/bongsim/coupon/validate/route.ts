import { auth } from "@/auth";
import { jsonWithLeakGuard } from "@/lib/public-response-guard";
import { getPgPool } from "@/lib/bongsim/db/pool";
import {
  validateBongsimCouponForDisplay,
  bongsimCheckoutSubtotalKrw,
  type BongsimCheckoutSubtotalLine,
} from "@/lib/bongsim/data/bongsim-coupon";
import { validateUserCoupon } from "@/lib/bongsim/data/user-coupon";
import { isReservedTemplateCode } from "@/lib/coupon/reserved-template-code";

export const dynamic = "force-dynamic";

type Body = {
  code?: unknown;
  user_coupon_id?: unknown;
  option_api_id?: unknown;
  quantity?: unknown;
  lines?: unknown;
};

function normalizeValidateLines(
  body: Body,
  details: Record<string, string>,
): BongsimCheckoutSubtotalLine[] | null {
  const rawLines = body.lines;
  if (rawLines != null) {
    if (!Array.isArray(rawLines)) {
      details.lines = "must_be_array";
      return null;
    }
    if (rawLines.length === 0) {
      details.lines = "must_not_be_empty";
      return null;
    }
    const out: BongsimCheckoutSubtotalLine[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < rawLines.length; i++) {
      const row = rawLines[i];
      if (!row || typeof row !== "object") {
        details[`lines[${i}]`] = "invalid_line";
        return null;
      }
      const o = row as Record<string, unknown>;
      const id =
        (typeof o.option_api_id === "string" ? o.option_api_id : typeof o.optionApiId === "string" ? o.optionApiId : "")
          .trim();
      const qRaw = o.quantity;
      const q =
        typeof qRaw === "number" ? qRaw : typeof qRaw === "string" ? Number.parseInt(qRaw, 10) : Number.NaN;
      if (!id) {
        details[`lines[${i}].option_api_id`] = "required";
        return null;
      }
      if (!Number.isInteger(q) || q < 1 || q > 99) {
        details[`lines[${i}].quantity`] = "must_be_integer_gte_1";
        return null;
      }
      if (seen.has(id)) {
        details.lines = "duplicate_option_api_id";
        return null;
      }
      seen.add(id);
      out.push({ option_api_id: id, quantity: q });
    }
    return out;
  }

  const option_api_id = typeof body.option_api_id === "string" ? body.option_api_id.trim() : "";
  const qRaw = body.quantity;
  const quantity =
    typeof qRaw === "number" ? qRaw : typeof qRaw === "string" ? Number.parseInt(qRaw, 10) : Number.NaN;
  if (!option_api_id) {
    details.lines = "required";
    return null;
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    details.quantity = "must_be_integer_gte_1";
    return null;
  }
  return [{ option_api_id, quantity }];
}

export async function POST(req: Request) {
  try {
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

    const details: Record<string, string> = {};
    const lines = normalizeValidateLines(body, details);
    if (!lines) {
      const msg =
        details.lines === "required"
          ? "상품 정보가 필요합니다."
          : details.quantity
            ? "수량이 올바르지 않습니다."
            : "주문 상품 정보가 올바르지 않습니다.";
      return jsonWithLeakGuard({ ok: false, error: msg }, "bongsim.coupon.validate", { status: 400 });
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
        const st = await bongsimCheckoutSubtotalKrw(c, lines);
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
      const v = await validateBongsimCouponForDisplay(c, { code, lines });
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
  } catch (err) {
    console.error("[bongsim/coupon/validate]", err);
    return jsonWithLeakGuard({ ok: false, error: "처리 중 오류가 발생했습니다." }, "bongsim.coupon.validate", {
      status: 500,
    });
  }
}
