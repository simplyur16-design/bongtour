import { fetchCouponKpi } from "@/lib/admin/bongsim-coupon-kpi";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { jsonWithLeakGuard } from "@/lib/public-response-guard";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return jsonWithLeakGuard({ error: "unauthorized" }, "admin.bongsim.coupon-kpi", { status: 401 });

  const pool = getPgPool();
  if (!pool) return jsonWithLeakGuard({ error: "db_unconfigured" }, "admin.bongsim.coupon-kpi", { status: 503 });

  try {
    const kpi = await fetchCouponKpi(pool);
    return jsonWithLeakGuard({ ok: true, ...kpi }, "admin.bongsim.coupon-kpi.response");
  } catch (e) {
    console.error("[admin/bongsim/coupon-kpi]", e);
    return jsonWithLeakGuard({ error: "query_failed" }, "admin.bongsim.coupon-kpi", { status: 500 });
  }
}
