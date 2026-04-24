import type { BongsimProductDetailSummaryV1 } from "@/lib/bongsim/contracts/product-detail.v1";
import { formatKrw } from "@/components/bongsim/detail-v1/format-krw";

function badge(text: string, tone: "slate" | "teal" | "amber") {
  const tones = {
    slate: "bg-slate-100 text-slate-800 ring-slate-200",
    teal: "bg-teal-50 text-teal-900 ring-teal-100",
    amber: "bg-amber-50 text-amber-950 ring-amber-100",
  } as const;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${tones[tone]}`}>
      {text}
    </span>
  );
}

function planTypeLabel(planType: BongsimProductDetailSummaryV1["plan_type"]): string {
  if (planType === "unlimited") return "무제한";
  if (planType === "fixed") return "종량제";
  if (planType === "daily") return "데일리";
  return "로컬";
}

export function ProductDetailSummaryV1({ summary }: { summary: BongsimProductDetailSummaryV1 }) {
  return (
    <header className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        {badge(summary.network_family === "local" ? "로컬 망" : "로밍", summary.network_family === "local" ? "teal" : "slate")}
        {badge(planTypeLabel(summary.plan_type), "amber")}
        {badge(summary.plan_line_excel, "slate")}
      </div>
      <h1 className="mt-3 text-[20px] font-semibold leading-snug text-slate-900 sm:text-[22px]">{summary.plan_name}</h1>
      <p className="mt-1 text-[13px] leading-relaxed text-slate-600 sm:text-[14px]">{summary.option_label}</p>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-[12px] text-slate-600 sm:text-[13px]">
        <div className="rounded-xl bg-slate-50 p-3">
          <dt className="text-slate-500">일수</dt>
          <dd className="mt-0.5 font-medium text-slate-900">{summary.days_raw}</dd>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <dt className="text-slate-500">용량</dt>
          <dd className="mt-0.5 font-medium text-slate-900">{summary.allowance_label}</dd>
        </div>
        <div className="col-span-2 rounded-xl bg-slate-50 p-3">
          <dt className="text-slate-500">통신사</dt>
          <dd className="mt-0.5 font-medium text-slate-900">{summary.carrier_raw}</dd>
        </div>
      </dl>
      <div className="mt-4 flex items-end justify-between gap-4 border-t border-slate-100 pt-4">
        <div>
          <p className="text-[11px] text-slate-500">표시 가격 기준</p>
          <p className="text-[11px] font-mono text-slate-600">{summary.pricing.display_basis}</p>
        </div>
        <p className="text-[22px] font-semibold tracking-tight text-slate-900">{formatKrw(summary.pricing.display_amount_krw)}</p>
      </div>
    </header>
  );
}
