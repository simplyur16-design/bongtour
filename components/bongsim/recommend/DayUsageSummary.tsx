"use client";

import type { ProductOption } from "@/lib/bongsim/recommend/product-option";
import { isTrueUnlimited } from "@/lib/bongsim/recommend/product-option";
import { formatKrw } from "@/lib/bongsim/recommend/product-option";

function parseMbpsFromQos(qos_raw: string | null | undefined): string | null {
  const low = (qos_raw || "").trim().toLowerCase();
  if (!low) return null;
  const kb = low.match(/(\d+(?:\.\d+)?)\s*kbps/);
  if (kb) {
    const n = parseFloat(kb[1]!);
    if (Number.isFinite(n)) {
      const m = n / 1000;
      const rounded = m >= 1 ? String(Math.round(m)) : m.toFixed(2).replace(/\.?0+$/, "");
      return `${rounded}Mbps`;
    }
  }
  const mb = low.match(/(\d+(?:\.\d+)?)\s*mbps/);
  if (mb) return `${mb[1]}Mbps`;
  return null;
}

function dataLine(product: ProductOption | null): string | null {
  if (!product) return null;
  const pt = (product.plan_type || "").trim().toLowerCase();
  const allowance = (product.allowance_label || "").trim();
  if (isTrueUnlimited(product) || pt === "unlimited") {
    const mbps = parseMbpsFromQos(product.qos_raw);
    return mbps ? `완전 무제한 · 최대 ${mbps}` : "완전 무제한";
  }
  if (pt === "daily" && allowance) {
    const qos = parseMbpsFromQos(product.qos_raw);
    return qos ? `매일 ${allowance} · 소진 후 ${qos} 저속 무제한` : `매일 ${allowance}`;
  }
  if (pt === "fixed" && allowance) return `총 ${allowance}`;
  if (allowance) return allowance;
  return null;
}

type Props = {
  tripDays: number;
  product: ProductOption | null;
  priceKrw?: number | null;
  className?: string;
};

/** usimsa day-usage 한 줄 요약 */
export function DayUsageSummary({ tripDays, product, priceKrw, className }: Props) {
  const data = dataLine(product);
  const price =
    priceKrw != null && Number.isFinite(priceKrw)
      ? formatKrw(priceKrw)
      : product?.recommended_price != null && Number.isFinite(product.recommended_price)
        ? formatKrw(product.recommended_price)
        : null;

  return (
    <div
      className={`rounded-lg border border-[#e5e5ec] bg-[#f9f9f9] px-4 py-3 text-[14px] leading-[26px] tracking-[-0.02em] text-[#222] ${className ?? ""}`}
      aria-live="polite"
    >
      <span className="font-bold">{tripDays}일</span>
      {data ? (
        <>
          <span className="mx-1.5 text-[#ccc]">·</span>
          <span className="font-medium">{data}</span>
        </>
      ) : null}
      {price ? (
        <>
          <span className="mx-1.5 text-[#ccc]">·</span>
          <span className="font-bold text-[#0176f9]">{price}</span>
        </>
      ) : null}
    </div>
  );
}
