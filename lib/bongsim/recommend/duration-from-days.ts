import {
  startOfDay,
  type TripScheduleKind,
} from "@/lib/bongsim/recommend/country-date-ranges";

// REGRESSION-FREEZE[bongsim-esim-duration-activation-copy]: 일수 칩=개통 후 N×24h, 오늘 달력 금지 — manifest

export type { TripScheduleKind };

/**
 * usimsa: 1일=24시 — 달력 없이 일수만 고를 때 내부 조회용 synthetic range.
 * UI에는 날짜 구간을 노출하지 말고 {@link formatEsimTripDaysDurationLabel}을 쓴다.
 */
export function dateRangeFromTripDays(
  tripDays: number,
  anchor: Date = new Date(),
): { start: Date; end: Date; tripDays: number; scheduleKind: "duration_days" } {
  const days = Math.max(1, Math.min(30, Math.floor(tripDays)));
  const start = startOfDay(anchor);
  const end = new Date(start);
  end.setDate(end.getDate() + days - 1);
  return { start, end, tripDays: days, scheduleKind: "duration_days" };
}

/** 결제·요약 노출용 — "2일 · 개통 후 48시간" (오늘 시작 달력 금지) */
export function formatEsimTripDaysDurationLabel(tripDays: number): string {
  const days = Math.max(1, Math.min(30, Math.floor(tripDays)));
  return `${days}일 · 개통 후 ${days * 24}시간`;
}

/** 플랜 선택 헤더 — "2일(개통 후 48시간) 플랜을 골라주세요" */
export function formatEsimTripDaysPlanPickTitle(tripDays: number): string {
  const days = Math.max(1, Math.min(30, Math.floor(tripDays)));
  return `${days}일(개통 후 ${days * 24}시간) 플랜을 골라주세요`;
}

export const TRIP_DAY_MIN = 1;
export const TRIP_DAY_MAX = 30;

export const TRIP_DAY_CHIP_VALUES: number[] = Array.from(
  { length: TRIP_DAY_MAX },
  (_, i) => i + TRIP_DAY_MIN,
);

/** usimsa primary accent */
export const USIMSA_BLUE = "#0176f9";
