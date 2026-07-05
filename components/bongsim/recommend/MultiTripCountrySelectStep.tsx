"use client";

import { BongsimRecommendAppShell } from "@/components/bongsim/recommend/BongsimRecommendAppShell";
import {
  MultiTripCountryPickerPanel,
  type MultiTripCountryPickerPanelProps,
} from "@/components/bongsim/recommend/MultiTripCountryPickerPanel";

export type MultiTripCountrySelectStepProps = MultiTripCountryPickerPanelProps & {
  onBack: () => void;
};

/** 여러 단일국가 조합 — 1단계 하단 링크로 진입 */
export function MultiTripCountrySelectStep({
  onBack,
  ...panelProps
}: MultiTripCountrySelectStepProps) {
  const canProceed = panelProps.selectedCodes.length >= 2;

  return (
    <BongsimRecommendAppShell singleCountry className={canProceed ? "max-lg:pb-24" : "pb-8"}>
      <div className="px-4 pt-5">
        <button
          type="button"
          onClick={onBack}
          className="mb-3 inline-flex items-center gap-1 text-[13px] font-medium text-[#767676]"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          국가 선택으로
        </button>
        <h1 className="text-[20px] font-bold leading-[30px] tracking-[-1px] text-[#111]">
          방문 국가를 선택하세요
        </h1>
      </div>
      <MultiTripCountryPickerPanel {...panelProps} />
    </BongsimRecommendAppShell>
  );
}
