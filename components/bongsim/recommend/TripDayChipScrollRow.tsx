"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  resolveDayChipVisualState,
  type DayChipVisualState,
} from "@/lib/bongsim/recommend/day-chip-visual-state";
import {
  groupTripDayOptions,
  TRIP_DAY_CHIP_BLUE,
  TRIP_DAY_GROUP_DIVIDER_MIN_OPTIONS,
  tripDayChipClassName,
} from "@/lib/bongsim/recommend/trip-day-chip-layout";

type Props = {
  options: number[];
  value: number | null;
  onChange: (days: number) => void;
  recommendedDay?: number | null;
  /** simplyur 등 — 기본 `${d}일` */
  formatLabel?: (days: number) => string;
  /** 스크롤 fade 배경 (simplyur: #FFF4EF) */
  fadeBg?: string;
  compact?: boolean;
  ariaLabel?: string;
};

function TripDayChipButton({
  day,
  state,
  onChange,
  formatLabel,
  compact,
}: {
  day: number;
  state: DayChipVisualState;
  onChange: (days: number) => void;
  formatLabel: (days: number) => string;
  compact: boolean;
}) {
  const isRecommended = state === "recommended";
  return (
    <button
      type="button"
      aria-pressed={state === "selected"}
      aria-label={
        isRecommended
          ? `${day}일, 이 여행지 추천 일수`
          : state === "selected"
            ? `${day}일, 선택됨`
            : `${day}일`
      }
      onClick={() => onChange(day)}
      className={tripDayChipClassName(state, compact)}
    >
      {isRecommended ? (
        <span
          className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-white"
          style={{ backgroundColor: TRIP_DAY_CHIP_BLUE }}
        >
          추천
        </span>
      ) : null}
      <span className="whitespace-nowrap">{formatLabel(day)}</span>
    </button>
  );
}

function GroupDivider() {
  return (
    <div
      className="mx-0.5 h-9 w-px shrink-0 self-center bg-[#d8dce6]"
      role="separator"
      aria-hidden
    />
  );
}

/** 가로 스크롤 일수 칩 — fade 힌트·15+ 구간 구분선 */
export function TripDayChipScrollRow({
  options,
  value,
  onChange,
  recommendedDay = null,
  formatLabel = (d) => `${d}일`,
  fadeBg = "#ffffff",
  compact = false,
  ariaLabel = "이용 일수 선택",
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [fade, setFade] = useState({ left: false, right: false });

  const updateFade = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const overflow = scrollWidth - clientWidth > 4;
    setFade({
      left: overflow && scrollLeft > 4,
      right: overflow && scrollLeft + clientWidth < scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    updateFade();
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(updateFade);
    ro.observe(el);
    return () => ro.disconnect();
  }, [options, updateFade]);

  const groups = groupTripDayOptions(options);
  const showGroupDividers = options.length >= TRIP_DAY_GROUP_DIVIDER_MIN_OPTIONS;

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        onScroll={updateFade}
        className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="group"
        aria-label={ariaLabel}
      >
        <div className="flex w-max min-w-full items-center gap-2.5 py-0.5">
          {groups.map((slice, groupIndex) => (
            <div key={slice.group.id} className="flex items-center gap-2.5">
              {groupIndex > 0 && showGroupDividers ? <GroupDivider /> : null}
              {slice.days.map((d) => (
                <TripDayChipButton
                  key={d}
                  day={d}
                  state={resolveDayChipVisualState(d, value, recommendedDay)}
                  onChange={onChange}
                  formatLabel={formatLabel}
                  compact={compact}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      {fade.left ? (
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-8"
          style={{ background: `linear-gradient(to right, ${fadeBg}, transparent)` }}
          aria-hidden
        />
      ) : null}
      {fade.right ? (
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-10"
          style={{ background: `linear-gradient(to left, ${fadeBg}, transparent)` }}
          aria-hidden
        />
      ) : null}
    </div>
  );
}
