"use client";

import { TripDayChipScrollRow } from "@/components/bongsim/recommend/TripDayChipScrollRow";
import { SIMPLYUR_PLANS_DESIGN as D } from "@/lib/simplyur/plans-design";
import { formatPlanMessage } from "@/lib/simplyur/plans-catalog";
import { useSimplyurT } from "@/components/simplyur/SimplyurIntlProvider";

type Props = {
  options: number[];
  value: number | null;
  onChange: (days: number) => void;
  /** 한국 기본 5일 등 — 미선택 시 연한 파란 틴트 */
  recommendedDay?: number | null;
};

/** design_handoff_plans — bongsim blue 일수 칩 (스크롤 fade·구간 구분선 공유) */
export function SimplyurPlansDurationPicker({
  options,
  value,
  onChange,
  recommendedDay = null,
}: Props) {
  const tr = useSimplyurT();

  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-[15px] font-semibold" style={{ color: D.navy }}>
        {tr("recommend.durationLabel")}
      </p>
      <p className="text-xs" style={{ color: D.muted }}>
        {tr("recommend.durationHint")}
      </p>
      <TripDayChipScrollRow
        options={options}
        value={value}
        onChange={onChange}
        recommendedDay={recommendedDay}
        formatLabel={(d) => formatPlanMessage(tr("recommend.durationChip"), d)}
        fadeBg={D.bg}
        compact
        ariaLabel={tr("recommend.durationLabel")}
      />
      <p className="text-[11px]" style={{ color: D.faint }}>
        {tr("recommend.durationCaption")}
      </p>
    </div>
  );
}
