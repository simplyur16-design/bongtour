import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { processRefund } from "@/lib/bongsim/refund/process-refund";
import { SIMPLYUR_EXIMBAY_PROVIDER_ID } from "@/lib/simplyur/payments/providers/eximbay-provider-id";
import { processSimplyurEximbayRefund } from "@/lib/simplyur/refund/process-simplyur-eximbay-refund";

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
  const requestedBy = { kind: "admin" as const, id: String(adminId) };

  // REGRESSION-FREEZE[simplyur-eximbay-refund]: admin routes Eximbay → processSimplyurEximbayRefund — manifest
  const pool = getPgPool();
  let provider = "";
  let channel = "";
  if (pool) {
    const r = await pool.query<{ payment_provider: string | null; checkout_channel: string | null }>(
      `SELECT payment_provider, checkout_channel FROM bongsim_order WHERE order_id = $1::uuid LIMIT 1`,
      [orderId],
    );
    provider = (r.rows[0]?.payment_provider ?? "").trim();
    channel = (r.rows[0]?.checkout_channel ?? "").trim();
  }

  const useEximbay =
    provider === SIMPLYUR_EXIMBAY_PROVIDER_ID && channel.startsWith("simplyur_");
  const result = useEximbay
    ? await processSimplyurEximbayRefund(orderId, reason || "Admin refund", requestedBy)
    : await processRefund(orderId, reason || "고객 요청 환불", requestedBy);

  if (result.ok) return NextResponse.json({ ok: true });

  const reasonCode = result.reason;
  const status =
    reasonCode === "order_not_found"
      ? 404
      : reasonCode === "invalid_status" ||
          reasonCode === "unsupported_provider" ||
          reasonCode === "missing_payment_reference" ||
          reasonCode === "esim_used_no_refund" ||
          reasonCode === "usage_check_failed" ||
          reasonCode === "already_refunded" ||
          reasonCode === "not_simplyur_order"
        ? 400
        : reasonCode === "welcomepay_env_incomplete" ||
            reasonCode === "eximbay_env_incomplete" ||
            reasonCode === "db_unconfigured"
          ? 503
          : reasonCode === "pg_cancel_failed" || reasonCode === "supplier_refund_failed"
            ? 502
            : 500;

  return NextResponse.json(
    { error: reasonCode, message: "message" in result ? result.message : undefined },
    { status },
  );
}
