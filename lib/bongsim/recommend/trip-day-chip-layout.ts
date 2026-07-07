import type { DayChipVisualState } from "@/lib/bongsim/recommend/day-chip-visual-state";

// REGRESSION-FREEZE[bongsim-trip-day-chip-ui]: 일수 칩 그룹·스타일 SSOT — manifest

/** bongsim·simplyur 일수 칩 공통 accent (usimsa blue) */
export const TRIP_DAY_CHIP_BLUE = "#0176f9";
export const TRIP_DAY_CHIP_BLUE_DARK = "#0158c4";

export const TRIP_DAY_GROUP_DIVIDER_MIN_OPTIONS = 15;

export type TripDayChipGroup = { id: "week1" | "week2" | "long"; min: number; max: number };

export const TRIP_DAY_CHIP_GROUPS: TripDayChipGroup[] = [
  { id: "week1", min: 1, max: 7 },
  { id: "week2", min: 8, max: 14 },
  { id: "long", min: 15, max: Number.POSITIVE_INFINITY },
];

export type TripDayChipGroupSlice = { group: TripDayChipGroup; days: number[] };

/** 칩 15개 이상일 때 1–7 / 8–14 / 15+ 구간으로 나눔 */
export function groupTripDayOptions(days: number[]): TripDayChipGroupSlice[] {
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.length < TRIP_DAY_GROUP_DIVIDER_MIN_OPTIONS) {
    return [{ group: { id: "week1", min: 1, max: Number.POSITIVE_INFINITY }, days: sorted }];
  }
  return TRIP_DAY_CHIP_GROUPS.map((group) => ({
    group,
    days: sorted.filter((d) => d >= group.min && d <= group.max),
  })).filter((slice) => slice.days.length > 0);
}

export const TRIP_DAY_CHIP_BASE =
  "relative flex h-[54px] min-w-[4.75rem] shrink-0 flex-col items-center justify-center rounded-xl px-3 text-[18px] font-semibold tracking-[-0.03em] transition-[background-color,border-color,color,box-shadow] duration-150";

export function tripDayChipClassName(state: DayChipVisualState, compact = false): string {
  const size = compact
    ? "relative flex h-12 min-w-[4.75rem] shrink-0 flex-col items-center justify-center rounded-[14px] px-[18px] text-[15px] font-semibold transition-[background-color,border-color,color,box-shadow] duration-150"
    : TRIP_DAY_CHIP_BASE;
  switch (state) {
    case "selected":
      return `${size} border-2 border-[#0176f9] bg-[#0176f9] text-white shadow-[0_2px_8px_rgba(1,118,249,0.28)]`;
    case "recommended":
      return `${size} border-2 border-[#0176f9]/55 bg-[#eef6ff] text-[#0158c4]`;
    default:
      return `${size} border border-[#d8dce6] bg-white text-[#6b7280] hover:border-[#b8c0d0] hover:bg-[#fafbfc]`;
  }
}
