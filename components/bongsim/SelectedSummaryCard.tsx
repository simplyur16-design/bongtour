"use client";

import { getCountryById, getPlanById } from "@/lib/bongsim/mock-data";
import type { FunnelState, NetworkType } from "@/lib/bongsim/types";

function netLabel(n: NetworkType | null) {
  if (n === "roaming") return "로밍형";
  if (n === "local") return "현지망형";
  return "선택 전";
}

type Props = {
  funnel: FunnelState;
};

export function SelectedSummaryCard({ funnel }: Props) {
  if (funnel.countryIds.length === 0) return null;

  const plan = funnel.planId ? getPlanById(funnel.planId) : undefined;
  const labels = funnel.countryIds
    .map((id) => getCountryById(id))
    .filter(Boolean)
    .map((c) => `${c!.flag} ${c!.nameKr}`)
    .join(", ");

  return (
    <section
      className="rounded-2xl border border-slate-100 bg-white px-5 py-5 shadow-sm ring-1 ring-slate-100/80"
      aria-label="지금까지 고른 조건"
    >
      <h2 className="text-sm font-semibold text-slate-800">선택 요약</h2>
      <dl className="mt-4 space-y-3.5 text-[15px]">
        <div className="flex justify-between gap-4 border-b border-slate-50 pb-3">
          <dt className="shrink-0 text-slate-500">국가</dt>
          <dd className="text-right font-medium leading-snug text-slate-900">{labels}</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-slate-50 pb-3">
          <dt className="shrink-0 text-slate-500">네트워크</dt>
          <dd className="text-right font-medium text-slate-900">{netLabel(funnel.network)}</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-slate-50 pb-3">
          <dt className="shrink-0 text-slate-500">이용 기간</dt>
          <dd className="text-right font-medium text-slate-900">
            {plan ? `${plan.validityDays}일` : "상품 상세에서 선택"}
          </dd>
        </div>
        <div className="flex justify-between gap-4 pt-0.5">
          <dt className="shrink-0 text-slate-500">플랜</dt>
          <dd className="max-w-[58%] text-right font-medium leading-snug text-slate-900">
            {plan ? plan.nameKo : "선택 전"}
          </dd>
        </div>
      </dl>
    </section>
  );
}
