import { jsonWithLeakGuard } from "@/lib/public-response-guard";
import { auth } from "@/auth";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { parseAllowanceLabel } from "@/lib/bongsim/mypage-esim-display";
import { resolveSimplyurUsageScope } from "@/lib/simplyur/usage-scope";
import { fetchUsimsaTopupDailyUsage } from "@/lib/bongsim/supplier/usimsa/usage-api";
import { isUsimsaSuccess } from "@/lib/bongsim/supplier/usimsa/types";
import { UsimsaRequestError } from "@/lib/usimsa/client";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase() ?? "";
  const userId = ((session?.user as { id?: string } | undefined)?.id ?? "").trim();
  if (!email && !userId) {
    return jsonWithLeakGuard({ error: "unauthorized" }, "bongsim.mypage.usage.detail", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const orderId = (searchParams.get("orderId") ?? "").trim();
  if (!orderId || !/^[0-9a-f-]{36}$/i.test(orderId)) {
    return jsonWithLeakGuard({ error: "invalid_order_id" }, "bongsim.mypage.usage.detail", { status: 400 });
  }

  const pool = getPgPool();
  if (!pool) {
    return jsonWithLeakGuard({ error: "db_unconfigured" }, "bongsim.mypage.usage.detail", { status: 503 });
  }

  try {
    const own = await pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM bongsim_order o
        WHERE o.order_id = $1::uuid
          AND (
            ($2::text <> '' AND lower(trim(o.buyer_email)) = lower(trim($2)))
            OR ($3::text <> '' AND (o.consents->>'bongtour_user_id') = $3)
          )`,
      [orderId, email, userId],
    );
    if (Number.parseInt(own.rows[0]?.n ?? "0", 10) < 1) {
      return jsonWithLeakGuard({ error: "not_found" }, "bongsim.mypage.usage.detail", { status: 404 });
    }

    const line = await pool.query<{
      allowance_label: string | null;
      plan_type: string | null;
      network_family: string | null;
      option_label: string | null;
      plan_line_excel: string | null;
    }>(
      `SELECT snapshot->>'allowance_label' AS allowance_label,
              snapshot->>'plan_type' AS plan_type,
              snapshot->>'network_family' AS network_family,
              snapshot->>'option_label' AS option_label,
              snapshot->>'plan_line_excel' AS plan_line_excel
         FROM bongsim_order_line WHERE order_id = $1::uuid ORDER BY created_at ASC LIMIT 1`,
      [orderId],
    );
    const lineRow = line.rows[0];
    const allowanceLabel = lineRow?.allowance_label?.trim() ?? "";
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
        { error: "no_topup", allowance_label: allowanceLabel, unlimited: allowance.unlimited, cap_mb: allowance.capMb },
        "bongsim.mypage.usage.detail",
        { status: 404 },
      );
    }

    const norm = await fetchUsimsaTopupDailyUsage(topupId);
    if (!isUsimsaSuccess(norm.code)) {
      console.error("[bongsim/mypage/usage] USIMSA upstream error", {
        orderId,
        topupId,
        code: norm.code,
        message: norm.message,
      });
      const userMsg = "사용량 조회에 실패했습니다. 잠시 후 다시 시도해주세요.";
      return jsonWithLeakGuard(
        {
          error: "usage_unavailable",
          user_message: userMsg,
          topup_id: topupId,
          allowance_label: allowanceLabel,
          unlimited: allowance.unlimited,
          cap_mb: allowance.capMb,
        },
        "bongsim.mypage.usage.detail",
        { status: 502 },
      );
    }

    // Daily plans: allowance_label is the per-DAY cap → compare today's usage, not the trip sum
    // (same fix as the Simplyur app, PR #147).
    const scope = resolveSimplyurUsageScope({
      line: {
        allowance_label: allowanceLabel,
        plan_type: lineRow?.plan_type ?? null,
        network_family: lineRow?.network_family ?? null,
        option_label: lineRow?.option_label ?? null,
        plan_line_excel: lineRow?.plan_line_excel ?? null,
      },
      history: norm.history,
      supplierTodayUsageMb: norm.todayUsageMb,
    });

    return jsonWithLeakGuard({
      order_id: orderId,
      topup_id: topupId,
      iccid: norm.iccid,
      allowance_label: allowanceLabel,
      unlimited: scope.unlimited,
      cap_scope: scope.cap_scope,
      cap_mb: scope.cap_mb,
      // Usage measured against cap_mb (today for daily plans, cumulative for fixed plans).
      total_used_mb: scope.used_mb,
      today_used_mb: scope.today_used_mb,
      cumulative_used_mb: scope.cumulative_used_mb,
      history: norm.history,
    }, "bongsim.mypage.usage.detail");
  } catch (e) {
    if (e instanceof UsimsaRequestError) {
      console.error("[bongsim/mypage/usage] UsimsaRequestError", {
        message: e.message,
        status: e.status,
        path: e.pathAndQuery,
        body: e.responseBody,
      });
      const userMsg = "사용량 조회에 실패했습니다. 잠시 후 다시 시도해주세요.";
      return jsonWithLeakGuard(
        { error: "usage_unavailable", user_message: userMsg },
        "bongsim.mypage.usage.detail",
        { status: 502 },
      );
    }
    console.error("[bongsim/mypage/usage]", e);
    return jsonWithLeakGuard({ error: "server_error" }, "bongsim.mypage.usage.detail", { status: 500 });
  }
}
