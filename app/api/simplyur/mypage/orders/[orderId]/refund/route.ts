import { jsonWithLeakGuard } from "@/lib/public-response-guard";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { resolveSimplyurApiUser } from "@/lib/simplyur/auth/resolve-simplyur-api-user";
import { getSimplyurRefundEligibility } from "@/lib/simplyur/refund/simplyur-refund-eligibility";
import { processSimplyurEximbayRefund } from "@/lib/simplyur/refund/process-simplyur-eximbay-refund";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ orderId: string }> };

/**
 * POST /api/simplyur/mypage/orders/[orderId]/refund
 * Customer cancel — unused eSIM + Eximbay full refund.
 * REGRESSION-FREEZE[simplyur-eximbay-refund]: customer refund API — manifest
 */
export async function POST(req: Request, ctx: Ctx) {
  if (!getPgPool()) {
    return jsonWithLeakGuard({ error: "db_unconfigured" }, "simplyur.mypage.refund", { status: 503 });
  }

  const user = await resolveSimplyurApiUser(req);
  const email = user?.email ?? "";
  const userId = user?.userId ?? "";
  if (!email && !userId) {
    return jsonWithLeakGuard({ error: "login_required" }, "simplyur.mypage.refund", { status: 401 });
  }

  const { orderId } = await ctx.params;
  const id = orderId.trim();
  if (!id) {
    return jsonWithLeakGuard({ error: "invalid_order_id" }, "simplyur.mypage.refund", { status: 400 });
  }

  const pool = getPgPool()!;
  const owned = await pool.query<{ ok: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM bongsim_order o
        WHERE o.order_id = $1::uuid
          AND o.checkout_channel LIKE 'simplyur_%'
          AND (
            ($2::text <> '' AND lower(trim(o.buyer_email)) = lower(trim($2)))
            OR ($3::text <> '' AND (o.consents->>'bongtour_user_id') = $3)
          )
     ) AS ok`,
    [id, email, userId],
  );
  if (!owned.rows[0]?.ok) {
    return jsonWithLeakGuard({ error: "not_found" }, "simplyur.mypage.refund", { status: 404 });
  }

  let body: { reason?: unknown } = {};
  try {
    body = (await req.json()) as { reason?: unknown };
  } catch {
    body = {};
  }
  const reason =
    typeof body.reason === "string" && body.reason.trim()
      ? body.reason.trim()
      : "Customer unused eSIM cancel";

  const elig = await getSimplyurRefundEligibility(id);
  if (!elig.eligible) {
    return jsonWithLeakGuard(
      { error: elig.code, message: elig.message },
      "simplyur.mypage.refund",
      { status: 400 },
    );
  }

  const result = await processSimplyurEximbayRefund(id, reason, { kind: "customer" });
  if (result.ok) {
    return jsonWithLeakGuard({ ok: true }, "simplyur.mypage.refund");
  }

  const status =
    result.reason === "order_not_found"
      ? 404
      : result.reason === "esim_used_no_refund" ||
          result.reason === "already_refunded" ||
          result.reason === "invalid_status" ||
          result.reason === "usage_check_failed" ||
          result.reason === "unsupported_provider" ||
          result.reason === "not_simplyur_order" ||
          result.reason === "missing_payment_reference"
        ? 400
        : result.reason === "pg_cancel_failed" || result.reason === "supplier_refund_failed"
          ? 502
          : result.reason === "eximbay_env_incomplete" || result.reason === "db_unconfigured"
            ? 503
            : 500;

  return jsonWithLeakGuard(
    { error: result.reason, message: result.message },
    "simplyur.mypage.refund",
    { status },
  );
}
