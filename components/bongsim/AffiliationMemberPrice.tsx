"use client";

import { formatKrw, formatKrwPerDay } from "@/lib/bongsim/recommend/product-option";
import { PRESS_MEMBER_DISCOUNT_RATE_PCT } from "@/lib/bongsim/press/press-member-discount-rate";
import { storefrontDisplayUnitKrw } from "@/lib/bongsim/press/affiliation-member-display-price";

type Props = {
  consumerKrw: number;
  affiliationVerified: boolean;
  /** 일당 표시용 — consumer 기준 일수(할인 전 총액÷일수와 동일 비율) */
  billableDays?: number | null;
  align?: "end" | "start";
  size?: "sm" | "md" | "lg";
};

/**
 * 명함 승인 시 소비자가 취소선 + 할인가, 아니면 소비자가만.
 * REGRESSION-FREEZE[bongsim-charge-consumer-affiliation-25pct]: 소비자가 기준 + 명함 25% — manifest
 */
export function AffiliationMemberPrice({
  consumerKrw,
  affiliationVerified,
  billableDays,
  align = "end",
  size = "md",
}: Props) {
  const list = Math.trunc(consumerKrw);
  if (!Number.isFinite(list) || list < 0) return null;

  const net = storefrontDisplayUnitKrw(list, affiliationVerified);
  const daily =
    billableDays != null && billableDays > 0 && Number.isFinite(billableDays)
      ? net / billableDays
      : null;

  const priceClass =
    size === "lg"
      ? "text-[22px] font-semibold tracking-tight"
      : size === "sm"
        ? "text-sm font-medium"
        : "text-base font-medium";
  const alignClass = align === "start" ? "items-start text-left" : "items-end text-right";

  if (!affiliationVerified || net >= list) {
    return (
      <div className={`flex flex-col gap-0.5 ${alignClass}`}>
        <span className={`whitespace-nowrap tabular-nums text-slate-900 ${priceClass}`}>
          {formatKrw(list)}
        </span>
        {daily != null && Number.isFinite(daily) ? (
          <span className="whitespace-nowrap text-[10px] text-slate-500">{formatKrwPerDay(daily)}</span>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-0.5 ${alignClass}`}>
      <span className="whitespace-nowrap text-[10px] font-semibold text-teal-700">
        소속 {PRESS_MEMBER_DISCOUNT_RATE_PCT}%
      </span>
      <span className="whitespace-nowrap text-[11px] text-slate-400 line-through tabular-nums">
        {formatKrw(list)}
      </span>
      <span className={`whitespace-nowrap tabular-nums text-teal-700 ${priceClass}`}>
        {formatKrw(net)}
      </span>
      {daily != null && Number.isFinite(daily) ? (
        <span className="whitespace-nowrap text-[10px] text-slate-500">{formatKrwPerDay(daily)}</span>
      ) : null}
    </div>
  );
}
