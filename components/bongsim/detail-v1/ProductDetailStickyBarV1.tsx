import Link from "next/link";
import type { BongsimProductDetailStickyV1 } from "@/lib/bongsim/contracts/product-detail.v1";
import { bongsimPath } from "@/lib/bongsim/constants";
import { formatKrw } from "@/components/bongsim/detail-v1/format-krw";

export function ProductDetailStickyBarV1({ sticky }: { sticky: BongsimProductDetailStickyV1 }) {
  const { summary, cta } = sticky;
  const href = bongsimPath(`/checkout?optionApiId=${encodeURIComponent(cta.payload.option_api_id)}`);

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:px-6">
      <div className="mx-auto flex max-w-lg items-center justify-between gap-3 sm:max-w-2xl lg:max-w-3xl">
        <div className="min-w-0">
          <p className="truncate text-[12px] font-semibold text-slate-900">{summary.plan_name}</p>
          <p className="truncate text-[11px] text-slate-500">{summary.option_label}</p>
          <p className="mt-0.5 text-[14px] font-semibold text-slate-900">{formatKrw(summary.pricing.display_amount_krw)}</p>
        </div>
        <Link
          href={href}
          prefetch={false}
          className="inline-flex shrink-0 items-center justify-center rounded-xl bg-teal-700 px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm ring-1 ring-teal-800/10 hover:bg-teal-800"
        >
          구매하기
        </Link>
      </div>
    </div>
  );
}
