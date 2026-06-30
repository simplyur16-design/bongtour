import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { adminActivateUsimForPaidOrder } from "@/lib/bongsim/admin/admin-usim-activate-order";

export const dynamic = "force-dynamic";

type Body = { option_api_id?: unknown; iccid?: unknown };

export async function POST(req: Request, ctx: { params: Promise<{ orderId: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { orderId } = await ctx.params;
  const id = (orderId ?? "").trim();
  if (!id) return NextResponse.json({ error: "missing_order_id" }, { status: 400 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const option_api_id = typeof body.option_api_id === "string" ? body.option_api_id.trim() : "";
  const iccid = typeof body.iccid === "string" ? body.iccid.trim() : "";
  if (!option_api_id) {
    return NextResponse.json({ error: "missing_option_api_id" }, { status: 400 });
  }
  if (!iccid) {
    return NextResponse.json({ error: "missing_iccid" }, { status: 400 });
  }

  const adminId = (admin.user as { id?: string }).id?.trim() || admin.user.role || "admin";
  const result = await adminActivateUsimForPaidOrder({
    order_id: id,
    option_api_id,
    iccid_raw: iccid,
    admin_id: String(adminId),
  });

  if (!result.ok) {
    const status =
      result.reason === "order_not_found" || result.reason === "line_not_found"
        ? 404
        : result.reason === "invalid_status" ||
            result.reason === "product_not_usim_capable" ||
            result.reason === "invalid_iccid" ||
            result.reason === "quantity_exhausted" ||
            result.reason === "esim_already_issued" ||
            result.reason === "duplicate_iccid"
          ? 400
          : result.reason === "db_unconfigured"
            ? 503
            : 502;
    return NextResponse.json({ error: result.reason, message: result.message }, { status });
  }

  return NextResponse.json({
    ok: true,
    topup_id: result.topup_id,
    iccid: result.iccid,
    canceled_esim_topup_id: result.canceled_esim_topup_id ?? null,
  });
}
