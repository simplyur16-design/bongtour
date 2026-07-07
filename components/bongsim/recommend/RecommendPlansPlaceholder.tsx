"use client";

import { formatKrw } from "@/lib/bongsim/recommend/product-option";

export type RecommendPlansPriceHint = {
  roamingFromKrw?: number | null;
  localFromKrw?: number | null;
};

type Props = {
  message?: string;
  priceHint?: RecommendPlansPriceHint | null;
  showSkeleton?: boolean;
  className?: string;
};

/** 일수 선택 전·플랜 로딩 전 빈 영역 — simplyur PlansPlaceholder와 동일 역할 */
export function RecommendPlansPlaceholder({
  message = "이용 일수를 선택하면 아래에 요금제가 표시됩니다.",
  priceHint = null,
  showSkeleton = true,
  className,
}: Props) {
  const priceLines: string[] = [];
  if (priceHint?.roamingFromKrw != null && priceHint.roamingFromKrw > 0) {
    priceLines.push(`로밍 ${formatKrw(priceHint.roamingFromKrw)}부터`);
  }
  if (priceHint?.localFromKrw != null && priceHint.localFromKrw > 0) {
    priceLines.push(`로컬 ${formatKrw(priceHint.localFromKrw)}부터`);
  }

  return (
    <div className={className ?? "mx-4 mt-4"}>
      <div className="rounded-2xl border border-dashed border-[#e0e0e8] bg-[#fafafa] px-5 py-[22px] text-center">
        <p className="text-[13px] leading-relaxed text-[#767676]">{message}</p>
        {priceLines.length > 0 ? (
          <p className="mt-2 text-[12px] font-semibold text-[#424242]">{priceLines.join(" · ")}</p>
        ) : null}
        {showSkeleton ? (
          <div className="mx-auto mt-5 flex max-w-[320px] flex-col gap-3" aria-hidden>
            {[1, 2].map((i) => (
              <div
                key={i}
                className="rounded-xl border border-[#ececf2] bg-white p-4 text-left opacity-70"
                style={{ opacity: i === 2 ? 0.45 : 0.7 }}
              >
                <div className="h-4 w-24 animate-pulse rounded bg-[#ececf2]" />
                <div className="mt-3 h-3 w-full animate-pulse rounded bg-[#f3f3f8]" />
                <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-[#f3f3f8]" />
                <div className="mt-4 h-9 w-full animate-pulse rounded-lg bg-[#eef6ff]" />
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
