import { redirect } from "next/navigation";
import { fetchCouponKpi } from "@/lib/admin/bongsim-coupon-kpi";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { requireAdmin } from "@/lib/require-admin";
import CouponsAdminClient from "./CouponsAdminClient";

export const revalidate = 300;

async function CouponKpiCards() {
  const pool = getPgPool();
  if (!pool) {
    return (
      <div className="mb-8 rounded-lg border border-amber-700/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
        KPI를 불러오려면 DATABASE_URL(Postgres)이 필요합니다.
      </div>
    );
  }
  let kpi;
  try {
    kpi = await fetchCouponKpi(pool);
  } catch {
    return (
      <div className="mb-8 rounded-lg border border-red-400/50 bg-red-950/40 px-4 py-3 text-sm text-red-200">
        KPI 조회에 실패했습니다.
      </div>
    );
  }

  const cardCls =
    "rounded-xl border border-slate-700 bg-slate-900/60 p-4 shadow-sm";

  return (
    <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className={cardCls}>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">보유 활성 쿠폰</p>
        <p className="mt-2 text-3xl font-bold text-teal-300">{kpi.activeUserCoupons.toLocaleString()}</p>
      </div>
      <div className={cardCls}>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">이번 달 발급</p>
        <p className="mt-2 text-3xl font-bold text-slate-100">{kpi.thisMonthIssued.toLocaleString()}</p>
        <p className="mt-1 text-xs text-slate-500">한국시간 기준</p>
      </div>
      <div className={cardCls}>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">이번 달 사용</p>
        <p className="mt-2 text-3xl font-bold text-slate-100">{kpi.thisMonthUsed.toLocaleString()}</p>
      </div>
      <div className={cardCls}>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">이번 달 만료 처리</p>
        <p className="mt-2 text-3xl font-bold text-slate-100">{kpi.thisMonthExpired.toLocaleString()}</p>
      </div>
      <div className={`sm:col-span-2 lg:col-span-4 ${cardCls}`}>
        <p className="text-sm font-semibold text-slate-200">템플릿 사용률 상위 5</p>
        {kpi.top5Templates.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">데이터 없음</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-800 text-sm">
            {kpi.top5Templates.map((t) => (
              <li key={t.template_label} className="flex flex-wrap items-center justify-between gap-2 py-2 text-slate-300">
                <span className="font-medium text-slate-100">{t.template_label}</span>
                <span className="text-slate-400">
                  사용 {t.used} / 발급 {t.issued}
                  <span className="ml-2 text-teal-400">({t.ratio}%)</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export default async function AdminBongsimCouponsPage() {
  const session = await requireAdmin();
  if (!session) redirect("/auth/signin?callbackUrl=/admin/bongsim/coupons");

  return (
    <div className="mx-auto max-w-6xl pb-16 text-slate-100">
      <CouponKpiCards />
      <CouponsAdminClient />
    </div>
  );
}
