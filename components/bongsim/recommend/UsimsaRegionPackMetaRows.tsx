"use client";

import Link from "next/link";
import { useState } from "react";
import { PlanCoverageCountriesPanel } from "@/components/bongsim/recommend/PlanCoverageCountriesPanel";
import { bongsimPath } from "@/lib/bongsim/constants";
import { planNameForRegionPackCode } from "@/lib/bongsim/recommend/region-pack-plan";

type Props = {
  regionCode: string;
};

/** usimsa 다국가 상품 헤더 — 사용기종 · 지원국가 */
export function UsimsaRegionPackMetaRows({ regionCode }: Props) {
  const [coverageOpen, setCoverageOpen] = useState(false);
  const planName = planNameForRegionPackCode(regionCode);

  return (
    <div className="mt-4 space-y-3 border-t border-[#f0f0f6] pt-4">
      <MetaRow
        label="사용기종"
        href={bongsimPath("/devices")}
        linkText="eSIM 사용 가능 기종 보기"
      />
      <div className="flex items-start justify-between gap-3">
        <span className="shrink-0 text-[14px] font-normal tracking-[-0.7px] text-[#767676]">
          지원국가
        </span>
        <button
          type="button"
          onClick={() => setCoverageOpen((v) => !v)}
          className="inline-flex items-center gap-0.5 text-[14px] tracking-[-0.7px] text-[#767676]"
        >
          사용 가능 국가 보기
          <Chevron />
        </button>
      </div>
      {coverageOpen ? (
        <PlanCoverageCountriesPanel
          destinationCode={regionCode}
          planName={planName}
          className="border-[#f0f0f6] bg-[#f9f9f9]"
        />
      ) : null}
    </div>
  );
}

function MetaRow({
  label,
  href,
  linkText,
}: {
  label: string;
  href: string;
  linkText: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="shrink-0 text-[14px] font-normal tracking-[-0.7px] text-[#767676]">
        {label}
      </span>
      <Link
        href={href}
        className="inline-flex items-center gap-0.5 text-[14px] tracking-[-0.7px] text-[#767676]"
      >
        {linkText}
        <Chevron />
      </Link>
    </div>
  );
}

function Chevron() {
  return (
    <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}
