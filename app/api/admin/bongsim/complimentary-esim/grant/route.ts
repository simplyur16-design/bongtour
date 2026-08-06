import { NextResponse } from "next/server";
import { adminGrantComplimentaryEsim } from "@/lib/bongsim/admin/complimentary-esim-order";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

type Body = {
  option_api_id?: unknown;
  quantity?: unknown;
  buyer_phone?: unknown;
  buyer_email?: unknown;
  reason_category?: unknown;
  reason_memo?: unknown;
};

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    let body: Body;
    try {
      body = (await req.json()) as Body;
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }

    const option_api_id = typeof body.option_api_id === "string" ? body.option_api_id.trim() : "";
    const quantity =
      typeof body.quantity === "number"
        ? body.quantity
        : typeof body.quantity === "string"
          ? Number.parseInt(body.quantity, 10)
          : Number.NaN;
    const buyer_phone = typeof body.buyer_phone === "string" ? body.buyer_phone : "";
    const buyer_email = typeof body.buyer_email === "string" ? body.buyer_email : null;
    const reason_category = typeof body.reason_category === "string" ? body.reason_category : "";
    const reason_memo = typeof body.reason_memo === "string" ? body.reason_memo : "";
    const adminId = (admin.user as { id?: string }).id?.trim() || admin.user.role || "admin";

    const result = await adminGrantComplimentaryEsim({
      option_api_id,
      quantity,
      buyer_phone,
      buyer_email,
      reason_category,
      reason_memo,
      admin_id: String(adminId),
    });

    if (!result.ok) {
      const status =
        result.reason === "product_not_found"
          ? 404
          : result.reason === "db_unconfigured" || result.reason === "connection_timeout"
            ? 503
            : result.reason === "db_error"
              ? 500
              : 400;
      return NextResponse.json({ error: result.reason, message: result.message }, { status });
    }

    return NextResponse.json({
      ok: true,
      order_id: result.order.order_id,
      order_number: result.order.order_number,
      status: result.order.status,
      fulfillment_started: result.fulfillment_started,
    });
  } catch (e) {
    console.error("[api/admin/bongsim/complimentary-esim/grant]", e);
    return NextResponse.json(
      {
        error: "db_error",
        message: "무상 eSIM 발급 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
      },
      { status: 500 },
    );
  }
}
