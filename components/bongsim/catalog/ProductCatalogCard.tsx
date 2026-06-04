import Link from "next/link";
import type { CatalogProductListRow } from "@/lib/bongsim/data/list-catalog-products";
import { bongsimPath } from "@/lib/bongsim/constants";
import { TravelerVerificationProductBadge } from "@/components/bongsim/esim/TravelerVerificationProductBadge";
import { formatPlanOptionLabel } from "@/lib/bongsim/recommend/plan-option-label";
import {
  shouldShowBadge,
  type KycLabelDistribution,
} from "@/lib/bongsim/esim/kyc-required";
import { computeRecommendedPrice, type ProductOption } from "@/lib/bongsim/recommend/product-option";

type Props = {
  row: CatalogProductListRow;
  kycDistribution: KycLabelDistribution;
};

export function ProductCatalogCard({ row, kycDistribution }: Props) {
  const price = computeRecommendedPrice(row.price_block as ProductOption["price_block"]);
  const href = bongsimPath(`/product/${encodeURIComponent(row.option_api_id)}`);
  const optionLabel = formatPlanOptionLabel({
    plan_type: row.plan_type,
    allowance_label: row.allowance_label,
    qos_raw: row.qos_raw,
  });
  const kycBadge = shouldShowBadge(row, kycDistribution);

  return (
    <Link
      href={href}
      className="block rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm shadow-slate-200/40 transition hover:border-teal-200 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold leading-snug text-slate-900">
            <span>{row.plan_name}</span>
            <TravelerVerificationProductBadge state={kycBadge} size="sm" showHelpIcon />
          </p>
          <p className="mt-1 text-xs font-medium text-slate-700">{optionLabel}</p>
          <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-slate-600">{row.option_label}</p>
          <p className="mt-2 text-[11px] text-slate-400">
            {row.allowance_label} · {row.days_raw}
          </p>
        </div>
        <div className="ml-auto shrink-0 text-right">
          {price != null ? (
            <p className="text-[14px] font-semibold tabular-nums text-teal-900">{price.toLocaleString("ko-KR")}원</p>
          ) : (
            <p className="text-[12px] text-slate-400">가격 문의</p>
          )}
          <p className="mt-1 font-mono text-[10px] text-slate-400">{row.option_api_id}</p>
        </div>
      </div>
    </Link>
  );
}
