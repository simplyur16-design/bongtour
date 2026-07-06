"use client";

import { SIMPLYUR_PLANS_DESIGN as D } from "@/lib/simplyur/plans-design";
import { formatPlanMessage } from "@/lib/simplyur/plans-catalog";
import { useSimplyurT } from "@/components/simplyur/SimplyurIntlProvider";

type Props = {
  options: number[];
  value: number | null;
  onChange: (days: number) => void;
};

/** design_handoff_plans — horizontal day-count chip picker */
export function SimplyurPlansDurationPicker({ options, value, onChange }: Props) {
  const tr = useSimplyurT();

  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-[15px] font-semibold" style={{ color: D.navy }}>
        {tr("recommend.durationLabel")}
      </p>
      <p className="text-xs" style={{ color: D.muted }}>
        {tr("recommend.durationHint")}
      </p>
      <div className="overflow-x-auto pb-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex w-max min-w-full gap-2.5 py-0.5">
          {options.map((d) => {
            const selected = value === d;
            return (
              <button
                key={d}
                type="button"
                aria-pressed={selected}
                onClick={() => onChange(d)}
                className="shrink-0 whitespace-nowrap px-[18px] text-sm font-semibold transition"
                style={{
                  height: D.chipHeight,
                  minWidth: D.chipMinWidth,
                  borderRadius: D.chipRadius,
                  border: `1.5px solid ${selected ? D.coral : D.border}`,
                  backgroundColor: selected ? D.coral : "transparent",
                  color: selected ? "#fff" : D.faint,
                }}
              >
                {formatPlanMessage(tr("recommend.durationChip"), d)}
              </button>
            );
          })}
        </div>
      </div>
      <p className="text-[11px]" style={{ color: D.faint }}>
        {tr("recommend.durationCaption")}
      </p>
    </div>
  );
}
