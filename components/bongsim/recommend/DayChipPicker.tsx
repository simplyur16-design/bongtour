"use client";

import { TripDayChipScrollRow } from "@/components/bongsim/recommend/TripDayChipScrollRow";
import {
  resolveDayChipVisualState,
  type DayChipVisualState,
} from "@/lib/bongsim/recommend/day-chip-visual-state";

export type { DayChipVisualState };
export { resolveDayChipVisualState };

type Props = {
  value: number | null;
  onChange: (days: number) => void;
  /** 카탈로그에 존재하는 일수만 — 빈 배열이면 안내 문구 */
  options: number[];
  /** 목적지별 기본 추천 일수 — 선택 전에도 색·배지로 표시 */
  recommendedDay?: number | null;
  label?: string;
  hint?: string;
  className?: string;
};

/** usimsa·simplyur 혼합 — 개별 테두리 칩 + 선택 시 채움 + 추천일 틴트 + 스크롤 fade */
export function DayChipPicker({
  value,
  onChange,
  options,
  recommendedDay = null,
  label,
  hint,
  className,
}: Props) {
  if (options.length === 0) {
    return (
      <div className={className}>
        {label ? (
          <p className="text-[15px] font-semibold tracking-[-0.02em] text-[#111]">{label}</p>
        ) : null}
        <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] text-slate-600">
          선택 가능한 이용 일수를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
        </p>
      </div>
    );
  }

  const showRecommendedLegend =
    recommendedDay != null && options.includes(recommendedDay) && value !== recommendedDay;

  return (
    <div className={className}>
      {label ? (
        <p className="text-[15px] font-semibold tracking-[-0.02em] text-[#111]">{label}</p>
      ) : null}
      {hint ? (
        <p className="mt-1 text-[12px] leading-relaxed text-[#767676]">{hint}</p>
      ) : null}
      <div className="mt-3">
        <TripDayChipScrollRow
          options={options}
          value={value}
          onChange={onChange}
          recommendedDay={recommendedDay}
        />
      </div>
      {showRecommendedLegend ? (
        <p className="mt-2 text-[11px] font-medium text-[#0176f9]">
          파란 테두리·「추천」은 이 여행지에서 많이 쓰는 기본 일수입니다. 탭하면 바로 요금제를 볼 수 있어요.
        </p>
      ) : null}
      <p className="mt-2 text-[11px] text-[#999]">
        판매 중인 요금제 일수만 표시됩니다 · 1일=24시 (활성화 시점부터, 상품별 상이)
      </p>
    </div>
  );
}
