import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { processRefund } from "@/lib/bongsim/refund/process-refund";

export const dynamic = "force-dynamic";

type Body = { orderId?: unknown; reason?: unknown };

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!orderId) return NextResponse.json({ error: "missing_order_id" }, { status: 400 });

  const adminId = (admin.user as { id?: string }).id?.trim() || admin.user.role || "admin";
  const result = await processRefund(orderId, reason || "고객 요청 환불", String(adminId));

  if (result.ok) return NextResponse.json({ ok: true });

  const status =
    result.reason === "order_not_found"
      ? 404
      : result.reason === "invalid_status" ||
          result.reason === "unsupported_provider" ||
          result.reason === "missing_payment_reference" ||
          result.reason === "esim_activated_no_refund" ||
          result.reason === "already_refunded"
        ? 400
        : result.reason === "welcomepay_env_incomplete" || result.reason === "db_unconfigured"
          ? 503
          : result.reason === "pg_cancel_failed"
            ? 502
            : 500;

  return NextResponse.json({ error: result.reason, message: result.message }, { status });
}
