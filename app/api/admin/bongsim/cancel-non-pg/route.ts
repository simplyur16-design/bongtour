import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { adminCancelNonPgEsimOrder } from "@/lib/bongsim/admin/admin-cancel-non-pg-esim-order";

export const dynamic = "force-dynamic";

type Body = { orderId?: unknown; reason?: unknown };

/** REGRESSION-FREEZE[bongsim-admin-non-pg-esim-cancel]: 무상·오프라인 eSIM 관리자 취소 API — manifest */
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
  const result = await adminCancelNonPgEsimOrder(
    orderId,
    reason || "관리자 무상·오프라인 eSIM 취소",
    String(adminId),
  );

  if (result.ok) {
    return NextResponse.json({ ok: true, canceled_topup_ids: result.canceled_topup_ids });
  }

  const status =
    result.reason === "order_not_found"
      ? 404
      : result.reason === "db_unconfigured"
        ? 503
        : result.reason === "supplier_cancel_failed"
          ? 502
          : 400;

  return NextResponse.json({ error: result.reason, message: result.message }, { status });
}
