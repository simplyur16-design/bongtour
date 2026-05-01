import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { parseAllowanceLabel } from "@/lib/bongsim/mypage-esim-display";
import { fetchUsimsaTopupDailyUsage } from "@/lib/bongsim/supplier/usimsa/usage-api";
import { isUsimsaSuccess } from "@/lib/bongsim/supplier/usimsa/types";
import { UsimsaRequestError } from "@/lib/usimsa/client";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase() ?? "";
  const userId = ((session?.user as { id?: string } | undefined)?.id ?? "").trim();
  if (!email && !userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const orderId = (searchParams.get("orderId") ?? "").trim();
  if (!orderId || !/^[0-9a-f-]{36}$/i.test(orderId)) {
    return NextResponse.json({ error: "invalid_order_id" }, { status: 400 });
  }

  const pool = getPgPool();
  if (!pool) {
    return NextResponse.json({ error: "db_unconfigured" }, { status: 503 });
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
      return NextResponse.json({ error: "not_found" }, { status: 404 });
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
        ORDER BY created_at ASC
        LIMIT 1`,
      [orderId],
    );
    const topupId = top.rows[0]?.topup_id?.trim();
    if (!topupId) {
      return NextResponse.json(
        { error: "no_topup", allowance_label: allowanceLabel, unlimited: allowance.unlimited, cap_mb: allowance.capMb },
        { status: 404 },
      );
    }

    const norm = await fetchUsimsaTopupDailyUsage(topupId);
    if (!isUsimsaSuccess(norm.code)) {
      return NextResponse.json(
        {
          error: "usimsa_error",
          code: norm.code,
          message: norm.message,
          topup_id: topupId,
          allowance_label: allowanceLabel,
          unlimited: allowance.unlimited,
          cap_mb: allowance.capMb,
        },
        { status: 502 },
      );
    }

    const totalUsedMb = norm.history.reduce((s, h) => s + (Number.isFinite(h.usageMb) ? h.usageMb : 0), 0);

    return NextResponse.json({
      order_id: orderId,
      topup_id: topupId,
      iccid: norm.iccid,
      allowance_label: allowanceLabel,
      unlimited: allowance.unlimited,
      cap_mb: allowance.capMb,
      total_used_mb: totalUsedMb,
      history: norm.history,
    });
  } catch (e) {
    if (e instanceof UsimsaRequestError) {
      return NextResponse.json(
        { error: "usimsa_http", status: e.status, message: e.message },
        { status: 502 },
      );
    }
    console.error("[bongsim/mypage/usage]", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
