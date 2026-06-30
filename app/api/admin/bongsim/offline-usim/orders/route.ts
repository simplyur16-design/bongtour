import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { adminCreateOfflineUsimOrder } from "@/lib/bongsim/admin/offline-usim-order";

export const dynamic = "force-dynamic";

type Body = {
  option_api_id?: unknown;
  quantity?: unknown;
  buyer_email?: unknown;
  buyer_phone?: unknown;
  note?: unknown;
};

export async function POST(req: Request) {
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
  const buyer_email = typeof body.buyer_email === "string" ? body.buyer_email : "";
  const buyer_phone = typeof body.buyer_phone === "string" ? body.buyer_phone : "";
  const note = typeof body.note === "string" ? body.note : null;
  const adminId = (admin.user as { id?: string }).id?.trim() || admin.user.role || "admin";

  const result = await adminCreateOfflineUsimOrder({
    option_api_id,
    quantity,
    buyer_email,
    buyer_phone,
    admin_id: String(adminId),
    note,
  });

  if (!result.ok) {
    const status =
      result.reason === "product_not_found"
        ? 404
        : result.reason === "db_unconfigured"
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
    grand_total_krw: result.order.totals.grand_total_krw,
  });
}
