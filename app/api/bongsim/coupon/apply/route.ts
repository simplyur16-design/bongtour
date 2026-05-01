import { NextResponse } from "next/server";
import { applyBongsimCouponUsageTransaction } from "@/lib/bongsim/data/bongsim-coupon";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

type Body = {
  coupon_id?: unknown;
  order_id?: unknown;
  original_amount_krw?: unknown;
  discount_amount_krw?: unknown;
  final_amount_krw?: unknown;
  user_id?: unknown;
};

/** 관리자 수동 보정용. 결제 캡처 시에는 `recordBongsimCouponUsageAfterCapture`가 자동 기록한다. */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "관리자 로그인이 필요합니다." }, { status: 401 });
  }

  const pool = getPgPool();
  if (!pool) {
    return NextResponse.json({ ok: false, error: "데이터베이스가 설정되지 않았습니다." }, { status: 503 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "요청 본문이 올바르지 않습니다." }, { status: 400 });
  }

  const coupon_id = typeof body.coupon_id === "string" ? body.coupon_id.trim() : "";
  const order_id = typeof body.order_id === "string" ? body.order_id.trim() : "";
  const original_amount_krw =
    typeof body.original_amount_krw === "number"
      ? body.original_amount_krw
      : typeof body.original_amount_krw === "string"
        ? Number.parseInt(body.original_amount_krw, 10)
        : Number.NaN;
  const discount_amount_krw =
    typeof body.discount_amount_krw === "number"
      ? body.discount_amount_krw
      : typeof body.discount_amount_krw === "string"
        ? Number.parseInt(body.discount_amount_krw, 10)
        : Number.NaN;
  const final_amount_krw =
    typeof body.final_amount_krw === "number"
      ? body.final_amount_krw
      : typeof body.final_amount_krw === "string"
        ? Number.parseInt(body.final_amount_krw, 10)
        : Number.NaN;
  const user_id = typeof body.user_id === "string" ? body.user_id.trim() : undefined;

  const r = await applyBongsimCouponUsageTransaction(pool, {
    coupon_id,
    order_id,
    original_amount_krw,
    discount_amount_krw,
    final_amount_krw,
    user_id: user_id || null,
  });

  if (!r.ok) {
    return NextResponse.json({ ok: false, error: r.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
