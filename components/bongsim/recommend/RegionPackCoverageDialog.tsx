"use client";

import { PlanCoverageCountriesPanel } from "@/components/bongsim/recommend/PlanCoverageCountriesPanel";

type Props = {
  title: string;
  regionCode: string;
  planName?: string;
  onClose: () => void;
  onConfirm: () => void;
};

/** 다국가 타일 클릭 — 지원국가 확인 후 선택 */
export function RegionPackCoverageDialog({
  title,
  regionCode,
  planName,
  onClose,
  onConfirm,
}: Props) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45"
      role="dialog"
      aria-modal="true"
      aria-labelledby="region-coverage-title"
      onClick={onClose}
    >
      <div
        className="max-h-[min(75vh,560px)] w-full max-w-[500px] overflow-y-auto rounded-t-2xl bg-white px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 id="region-coverage-title" className="text-[16px] font-bold tracking-[-0.4px] text-[#111]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg px-2 py-1 text-[13px] font-medium text-[#767676]"
          >
            닫기
          </button>
        </div>
        <PlanCoverageCountriesPanel
          destinationCode={regionCode}
          planName={planName}
          defaultOpen
          stopPropagation
          className="border-[#f0f0f6] bg-[#f9f9f9]"
        />
        <button
          type="button"
          onClick={onConfirm}
          className="mt-4 h-12 w-full rounded-lg bg-[#0176f9] text-[15px] font-medium text-white"
        >
          선택하기
        </button>
      </div>
    </div>
  );
}
