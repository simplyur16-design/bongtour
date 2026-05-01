import { NextResponse } from "next/server";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { validateBongsimCouponForDisplay } from "@/lib/bongsim/data/bongsim-coupon";

export const dynamic = "force-dynamic";

type Body = {
  code?: unknown;
  option_api_id?: unknown;
  quantity?: unknown;
};

export async function POST(req: Request) {
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

  const code = typeof body.code === "string" ? body.code : "";
  const option_api_id = typeof body.option_api_id === "string" ? body.option_api_id.trim() : "";
  const qRaw = body.quantity;
  const quantity =
    typeof qRaw === "number" ? qRaw : typeof qRaw === "string" ? Number.parseInt(qRaw, 10) : Number.NaN;

  if (!option_api_id) {
    return NextResponse.json({ ok: false, error: "상품 정보가 필요합니다." }, { status: 400 });
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    return NextResponse.json({ ok: false, error: "수량이 올바르지 않습니다." }, { status: 400 });
  }

  const c = await pool.connect();
  try {
    const v = await validateBongsimCouponForDisplay(c, { code, option_api_id, quantity });
    if (!v.ok) {
      return NextResponse.json({ ok: false, error: v.error }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      discount_krw: v.discount_krw,
      coupon_id: v.coupon_id,
      description: v.description,
      subtotal_krw: v.subtotal_krw,
    });
  } finally {
    c.release();
  }
}
