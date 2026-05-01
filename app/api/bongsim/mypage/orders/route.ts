import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { countryDisplayFromPlanNameKr } from "@/lib/bongsim/mypage-esim-display";

export const dynamic = "force-dynamic";

type TopupRow = { topup_id: string; status: string; qr_code_img_url: string | null };

export async function GET() {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase() ?? "";
  const userId = ((session?.user as { id?: string } | undefined)?.id ?? "").trim();
  if (!email && !userId) {
    return NextResponse.json({ error: "unauthorized", orders: [] }, { status: 401 });
  }

  const pool = getPgPool();
  if (!pool) {
    return NextResponse.json({ error: "db_unconfigured", orders: [] }, { status: 503 });
  }

  try {
    const r = await pool.query<{
      order_id: string;
      order_number: string;
      status: string;
      grand_total_krw: string;
      created_at: Date;
      plan_name: string | null;
      option_label: string | null;
      allowance_label: string | null;
      topups: TopupRow[] | null;
    }>(
      `SELECT
         o.order_id::text AS order_id,
         o.order_number,
         o.status,
         o.grand_total_krw::text AS grand_total_krw,
         o.created_at,
         (SELECT l.snapshot->>'plan_name' FROM bongsim_order_line l WHERE l.order_id = o.order_id ORDER BY l.created_at ASC LIMIT 1) AS plan_name,
         (SELECT l.snapshot->>'option_label' FROM bongsim_order_line l WHERE l.order_id = o.order_id ORDER BY l.created_at ASC LIMIT 1) AS option_label,
         (SELECT l.snapshot->>'allowance_label' FROM bongsim_order_line l WHERE l.order_id = o.order_id ORDER BY l.created_at ASC LIMIT 1) AS allowance_label,
         COALESCE(
           (SELECT json_agg(json_build_object(
               'topup_id', t.topup_id,
               'status', t.status,
               'qr_code_img_url', t.qr_code_img_url
             ) ORDER BY t.created_at)
             FROM bongsim_fulfillment_topup t
            WHERE t.order_id = o.order_id AND t.supplier_id = 'usimsa'),
           '[]'::json
         ) AS topups
       FROM bongsim_order o
       WHERE ($1::text <> '' AND lower(trim(o.buyer_email)) = lower(trim($1)))
          OR ($2::text <> '' AND (o.consents->>'bongtour_user_id') = $2)
       ORDER BY o.created_at DESC
       LIMIT 50`,
      [email, userId],
    );

    const orders = r.rows.map((row) => {
      const planName = row.plan_name?.trim() || "—";
      const { flag, countryLabel } = countryDisplayFromPlanNameKr(planName);
      const topups = Array.isArray(row.topups) ? row.topups : [];
      const primaryQr = topups.find((t) => (t.qr_code_img_url ?? "").trim().length > 0)?.qr_code_img_url ?? null;
      const canEsimActions = row.status === "delivered" && Boolean(primaryQr);

      return {
        order_id: row.order_id,
        order_number: row.order_number,
        status: row.status,
        display_status: mapDisplayStatus(row.status, topups),
        grand_total_krw: row.grand_total_krw,
        created_at: row.created_at.toISOString(),
        plan_name: planName,
        option_label: row.option_label?.trim() || "",
        allowance_label: row.allowance_label?.trim() || "",
        country_flag: flag,
        country_label: countryLabel,
        topups,
        qr_code_img_url: primaryQr,
        can_show_qr: canEsimActions,
        can_check_usage: canEsimActions,
      };
    });

    return NextResponse.json({ orders });
  } catch (e) {
    console.error("[bongsim/mypage/orders]", e);
    return NextResponse.json({ error: "db_error", orders: [] }, { status: 500 });
  }
}

function mapDisplayStatus(orderStatus: string, topups: TopupRow[]): string {
  if (orderStatus === "awaiting_payment") return "주문완료";
  if (orderStatus === "paid") return "결제완료";
  if (orderStatus === "delivered") {
    const hasIccidLike = topups.some((t) => t.status === "iccid_ready" || t.status === "delivered");
    if (hasIccidLike) return "사용중";
    return "발송완료";
  }
  if (orderStatus === "failed") return "실패";
  if (orderStatus === "cancelled") return "취소";
  return orderStatus;
}
