import { startOfDay } from "@/lib/bongsim/recommend/country-date-ranges";

/** usimsa: 1일=24시 — 달력 없이 일수만 고를 때 오늘 기준 synthetic range. */
export function dateRangeFromTripDays(
  tripDays: number,
  anchor: Date = new Date(),
): { start: Date; end: Date; tripDays: number } {
  const days = Math.max(1, Math.min(30, Math.floor(tripDays)));
  const start = startOfDay(anchor);
  const end = new Date(start);
  end.setDate(end.getDate() + days - 1);
  return { start, end, tripDays: days };
}

export const TRIP_DAY_MIN = 1;
export const TRIP_DAY_MAX = 30;

export const TRIP_DAY_CHIP_VALUES: number[] = Array.from(
  { length: TRIP_DAY_MAX },
  (_, i) => i + TRIP_DAY_MIN,
);

/** usimsa primary accent */
export const USIMSA_BLUE = "#0176f9";
