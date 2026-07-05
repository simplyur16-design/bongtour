import { jsonWithLeakGuard } from "@/lib/public-response-guard";
import { auth } from "@/auth";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { isActiveBongsimTopupStatus } from "@/lib/bongsim/fulfillment/active-topup-status";
import { isSimplyurLocale, type SimplyurLocale } from "@/lib/simplyur/constants";
import { formatSimplyurPlanDisplay } from "@/lib/simplyur/plan-display";
import { simplyurOrderStatusKey } from "@/lib/simplyur/mypage-order-status";

export const dynamic = "force-dynamic";

type TopupRow = {
  topup_id: string;
  status: string;
  qr_code_img_url: string | null;
  smdp: string | null;
  activate_code: string | null;
};

/**
 * GET /api/simplyur/mypage/orders?locale=en
 * Foreign-traveler My eSIM — simplyur channel only, localized plan labels (no Korean DB copy).
 */
export async function GET(req: Request) {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase() ?? "";
  const userId = ((session?.user as { id?: string } | undefined)?.id ?? "").trim();
  if (!email && !userId) {
    return jsonWithLeakGuard({ error: "unauthorized", orders: [] }, "simplyur.mypage.orders", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const localeParam = searchParams.get("locale") ?? "en";
  const locale: SimplyurLocale = isSimplyurLocale(localeParam) ? localeParam : "en";

  const pool = getPgPool();
  if (!pool) {
    return jsonWithLeakGuard({ error: "db_unconfigured", orders: [] }, "simplyur.mypage.orders", { status: 503 });
  }

  try {
    const r = await pool.query<{
      order_id: string;
      order_number: string;
      status: string;
      grand_total_krw: string;
      created_at: Date;
      days_raw: string | null;
      allowance_label: string | null;
      option_label: string | null;
      plan_type: string | null;
      network_family: string | null;
      topups: TopupRow[] | null;
    }>(
      `SELECT
         o.order_id::text AS order_id,
         o.order_number,
         o.status,
         o.grand_total_krw::text AS grand_total_krw,
         o.created_at,
         (SELECT l.snapshot->>'days_raw' FROM bongsim_order_line l WHERE l.order_id = o.order_id ORDER BY l.created_at ASC LIMIT 1) AS days_raw,
         (SELECT l.snapshot->>'allowance_label' FROM bongsim_order_line l WHERE l.order_id = o.order_id ORDER BY l.created_at ASC LIMIT 1) AS allowance_label,
         (SELECT l.snapshot->>'option_label' FROM bongsim_order_line l WHERE l.order_id = o.order_id ORDER BY l.created_at ASC LIMIT 1) AS option_label,
         (SELECT l.snapshot->>'plan_type' FROM bongsim_order_line l WHERE l.order_id = o.order_id ORDER BY l.created_at ASC LIMIT 1) AS plan_type,
         (SELECT l.snapshot->>'network_family' FROM bongsim_order_line l WHERE l.order_id = o.order_id ORDER BY l.created_at ASC LIMIT 1) AS network_family,
         COALESCE(
           (SELECT json_agg(json_build_object(
               'topup_id', t.topup_id,
               'status', t.status,
               'qr_code_img_url', t.qr_code_img_url,
               'smdp', t.smdp,
               'activate_code', t.activate_code
             ) ORDER BY t.created_at)
             FROM bongsim_fulfillment_topup t
            WHERE t.order_id = o.order_id AND t.supplier_id = 'usimsa'
              AND t.status NOT IN ('canceled', 'failed')),
           '[]'::json
         ) AS topups
       FROM bongsim_order o
       WHERE o.checkout_channel LIKE 'simplyur_%'
         AND (
           ($1::text <> '' AND lower(trim(o.buyer_email)) = lower(trim($1)))
           OR ($2::text <> '' AND (o.consents->>'bongtour_user_id') = $2)
         )
       ORDER BY o.created_at DESC
       LIMIT 50`,
      [email, userId],
    );

    const orders = r.rows.map((row) => {
      const topups = (Array.isArray(row.topups) ? row.topups : []).filter((t) =>
        isActiveBongsimTopupStatus(String(t.status ?? "")),
      );
      const primaryQr = topups.find((t) => (t.qr_code_img_url ?? "").trim().length > 0)?.qr_code_img_url ?? null;
      const primarySmdp = topups.find((t) => (t.smdp ?? "").trim().length > 0)?.smdp?.trim() ?? null;
      const primaryActivateCode =
        topups.find((t) => (t.activate_code ?? "").trim().length > 0)?.activate_code?.trim() ?? null;
      const canEsimActions =
        row.status === "delivered" && Boolean(primaryQr || primarySmdp || primaryActivateCode);

      const plan = formatSimplyurPlanDisplay(
        {
          option_api_id: "",
          plan_name: "",
          network_family: row.network_family ?? "",
          plan_type: row.plan_type,
          days_raw: row.days_raw ?? "",
          allowance_label: row.allowance_label ?? "",
          option_label: row.option_label ?? "",
          price_block: {},
          flags: {},
        },
        locale,
      );

      return {
        order_id: row.order_id,
        order_number: row.order_number,
        status_key: simplyurOrderStatusKey(row.status, topups),
        plan_summary: plan.summary,
        grand_total_krw: row.grand_total_krw,
        created_at: row.created_at.toISOString(),
        qr_code_img_url: primaryQr,
        sm_dp_plus_address: primarySmdp,
        activation_code: primaryActivateCode,
        can_show_qr: canEsimActions,
        can_check_usage: canEsimActions,
      };
    });

    return jsonWithLeakGuard({ orders, locale }, "simplyur.mypage.orders");
  } catch (e) {
    console.error("[api/simplyur/mypage/orders]", e);
    return jsonWithLeakGuard({ error: "db_error", orders: [] }, "simplyur.mypage.orders", { status: 500 });
  }
}
