import { auth } from "@/auth";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { getRefundEligibility } from "@/lib/bongsim/refund/refund-eligibility";
import { processRefund } from "@/lib/bongsim/refund/process-refund";
import { jsonWithLeakGuard } from "@/lib/public-response-guard";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ orderId: string }> };

function normEmail(s: string): string {
  return s.trim().toLowerCase();
}

/** 고객 주문 취소(웰컴페이 전액 환불) — 로그인 이메일 = 주문 이메일 일치 시 */
export async function POST(req: Request, ctx: Ctx) {
  if (!getPgPool()) {
    return jsonWithLeakGuard({ error: "db_unconfigured" }, "bongsim.orders.refund", { status: 503 });
  }

  const session = await auth();
  const sessionEmail = normEmail(session?.user?.email ?? "");
  if (!sessionEmail) {
    return jsonWithLeakGuard({ error: "login_required" }, "bongsim.orders.refund", { status: 401 });
  }

  const { orderId } = await ctx.params;
  const id = orderId.trim();

  const pool = getPgPool()!;
  const o = await pool.query<{ buyer_email: string }>(
    `SELECT buyer_email FROM bongsim_order WHERE order_id = $1::uuid LIMIT 1`,
    [id],
  );
  const order = o.rows[0];
  if (!order) {
    return jsonWithLeakGuard({ error: "not_found" }, "bongsim.orders.refund", { status: 404 });
  }
  if (normEmail(order.buyer_email) !== sessionEmail) {
    return jsonWithLeakGuard({ error: "forbidden" }, "bongsim.orders.refund", { status: 403 });
  }

  let body: { reason?: unknown } = {};
  try {
    body = (await req.json()) as { reason?: unknown };
  } catch {
    body = {};
  }
  const reason = typeof body.reason === "string" ? body.reason.trim() : "고객 주문 취소";

  const elig = await getRefundEligibility(id);
  if (!elig.eligible) {
    return jsonWithLeakGuard(
      { error: elig.code, message: elig.message },
      "bongsim.orders.refund",
      { status: 400 },
    );
  }

  const result = await processRefund(id, reason || "고객 주문 취소", { kind: "customer" });
  if (result.ok) {
    return jsonWithLeakGuard({ ok: true }, "bongsim.orders.refund");
  }

  const status =
    result.reason === "order_not_found"
      ? 404
      : result.reason === "esim_activated_no_refund" ||
          result.reason === "already_refunded" ||
          result.reason === "invalid_status"
        ? 400
        : result.reason === "pg_cancel_failed"
          ? 502
          : 500;

  return jsonWithLeakGuard(
    { error: result.reason, message: result.message },
    "bongsim.orders.refund",
    { status },
  );
}
