import { jsonWithLeakGuard } from "@/lib/public-response-guard";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { parseAllowanceLabel } from "@/lib/bongsim/mypage-esim-display";
import { fetchUsimsaTopupDailyUsage } from "@/lib/bongsim/supplier/usimsa/usage-api";
import { isUsimsaSuccess } from "@/lib/bongsim/supplier/usimsa/types";
import { UsimsaRequestError } from "@/lib/usimsa/client";
import { resolveSimplyurApiUser } from "@/lib/simplyur/auth/resolve-simplyur-api-user";

export const dynamic = "force-dynamic";

/**
 * GET /api/simplyur/mypage/usage?orderId=...
 * Usage for simplyur orders only — no Korean user-facing error copy.
 */
export async function GET(req: Request) {
  // REGRESSION-FREEZE[simplyur-inapp-auth]: Bearer or cookie — manifest
  const user = await resolveSimplyurApiUser(req);
  const email = user?.email ?? "";
  const userId = user?.userId ?? "";
  if (!email && !userId) {
    return jsonWithLeakGuard({ error: "unauthorized" }, "simplyur.mypage.usage", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const orderId = (searchParams.get("orderId") ?? "").trim();
  if (!orderId || !/^[0-9a-f-]{36}$/i.test(orderId)) {
    return jsonWithLeakGuard({ error: "invalid_order_id" }, "simplyur.mypage.usage", { status: 400 });
  }

  const pool = getPgPool();
  if (!pool) {
    return jsonWithLeakGuard({ error: "db_unconfigured" }, "simplyur.mypage.usage", { status: 503 });
  }

  try {
    const own = await pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM bongsim_order o
        WHERE o.order_id = $1::uuid
          AND o.checkout_channel LIKE 'simplyur_%'
          AND (
            ($2::text <> '' AND lower(trim(o.buyer_email)) = lower(trim($2)))
            OR ($3::text <> '' AND (o.consents->>'bongtour_user_id') = $3)
          )`,
      [orderId, email, userId],
    );
    if (Number.parseInt(own.rows[0]?.n ?? "0", 10) < 1) {
      return jsonWithLeakGuard({ error: "not_found" }, "simplyur.mypage.usage", { status: 404 });
    }

    const line = await pool.query<{ allowance_label: string | null }>(
      `SELECT snapshot->>'allowance_label' AS allowance_label
         FROM bongsim_order_line WHERE order_id = $1::uuid ORDER BY created_at ASC LIMIT 1`,
      [orderId],
    );
    const allowanceLabel = line.rows[0]?.allowance_label?.trim() ?? "";
    const allowance = parseAllowanceLabel(allowanceLabel);

    const top = await pool.query<{ topup_id: string }>(
      `SELECT topup_id FROM bongsim_fulfillment_topup
        WHERE order_id = $1::uuid AND supplier_id = 'usimsa'
          AND status NOT IN ('canceled', 'failed')
        ORDER BY created_at ASC
        LIMIT 1`,
      [orderId],
    );
    const topupId = top.rows[0]?.topup_id?.trim();
    if (!topupId) {
      return jsonWithLeakGuard(
        { error: "no_topup", unlimited: allowance.unlimited, cap_mb: allowance.capMb },
        "simplyur.mypage.usage",
        { status: 404 },
      );
    }

    const norm = await fetchUsimsaTopupDailyUsage(topupId);
    if (!isUsimsaSuccess(norm.code)) {
      return jsonWithLeakGuard({ error: "usage_unavailable" }, "simplyur.mypage.usage", { status: 502 });
    }

    const totalUsedMb = norm.history.reduce((s, h) => s + (Number.isFinite(h.usageMb) ? h.usageMb : 0), 0);

    return jsonWithLeakGuard(
      {
        order_id: orderId,
        unlimited: allowance.unlimited,
        cap_mb: allowance.capMb,
        total_used_mb: totalUsedMb,
        history: norm.history,
      },
      "simplyur.mypage.usage",
    );
  } catch (e) {
    if (e instanceof UsimsaRequestError) {
      return jsonWithLeakGuard({ error: "usage_unavailable" }, "simplyur.mypage.usage", { status: 502 });
    }
    console.error("[api/simplyur/mypage/usage]", e);
    return jsonWithLeakGuard({ error: "server_error" }, "simplyur.mypage.usage", { status: 500 });
  }
}
