import { auth } from "@/auth";
import { getPgPool } from "@/lib/bongsim/db/pool";
import {
  bongsimBuyerSessionIdentity,
  isBongsimOrderOwnedBySession,
} from "@/lib/bongsim/mypage/order-owned-by-session";
import { getRefundEligibility } from "@/lib/bongsim/refund/refund-eligibility";
import { processRefund } from "@/lib/bongsim/refund/process-refund";
import { jsonWithLeakGuard } from "@/lib/public-response-guard";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ orderId: string }> };

/** 고객 주문 취소(웰컴페이 전액 환불) — 마이페이지와 동일 소유권(이메일·회원 ID) */
export async function POST(req: Request, ctx: Ctx) {
  if (!getPgPool()) {
    return jsonWithLeakGuard({ error: "db_unconfigured" }, "bongsim.orders.refund", { status: 503 });
  }

  const session = await auth();
  const buyer = bongsimBuyerSessionIdentity(session);
  if (!buyer.email && !buyer.userId) {
    return jsonWithLeakGuard({ error: "login_required" }, "bongsim.orders.refund", { status: 401 });
  }

  const { orderId } = await ctx.params;
  const id = orderId.trim();

  const pool = getPgPool()!;
  const owned = await isBongsimOrderOwnedBySession(pool, id, buyer);
  if (!owned) {
    return jsonWithLeakGuard({ error: "not_found" }, "bongsim.orders.refund", { status: 404 });
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
      : result.reason === "esim_used_no_refund" ||
          result.reason === "already_refunded" ||
          result.reason === "invalid_status" ||
          result.reason === "usage_check_failed"
        ? 400
        : result.reason === "pg_cancel_failed" || result.reason === "supplier_refund_failed"
          ? 502
          : 500;

  return jsonWithLeakGuard(
    { error: result.reason, message: result.message },
    "bongsim.orders.refund",
    { status },
  );
}
