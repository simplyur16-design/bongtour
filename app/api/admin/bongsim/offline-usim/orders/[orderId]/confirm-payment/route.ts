import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import {
  adminConfirmOfflineUsimPayment,
  type OfflinePaymentChannel,
} from "@/lib/bongsim/admin/offline-usim-order";

export const dynamic = "force-dynamic";

type Body = { payment_channel?: unknown; note?: unknown };

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

  const channel = body.payment_channel;
  const payment_channel: OfflinePaymentChannel | null =
    channel === "cash" || channel === "card_terminal" || channel === "bank_transfer"
      ? channel
      : null;
  if (!payment_channel) {
    return NextResponse.json({ error: "invalid_payment_channel" }, { status: 400 });
  }

  const note = typeof body.note === "string" ? body.note : null;
  const adminId = (admin.user as { id?: string }).id?.trim() || admin.user.role || "admin";

  const result = await adminConfirmOfflineUsimPayment({
    order_id: id,
    payment_channel,
    admin_id: String(adminId),
    note,
  });

  if (!result.ok) {
    const status =
      result.reason === "order_not_found"
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
    order_id: result.order_id,
    order_number: result.order_number,
  });
}
