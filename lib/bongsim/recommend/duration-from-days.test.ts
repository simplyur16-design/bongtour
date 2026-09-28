import { describe, expect, it } from "vitest";
import {
  dateRangeFromTripDays,
  formatEsimTripDaysDurationLabel,
  formatEsimTripDaysPlanPickTitle,
} from "@/lib/bongsim/recommend/duration-from-days";

describe("formatEsimTripDaysDurationLabel", () => {
  it("2일 = 개통 후 48시간 — 달력 날짜 없음", () => {
    const label = formatEsimTripDaysDurationLabel(2);
    expect(label).toBe("2일 · 개통 후 48시간");
    expect(label).not.toMatch(/\d+\/\d+/);
    expect(label).not.toMatch(/~/);
  });

  it("1일 = 24시간", () => {
    expect(formatEsimTripDaysDurationLabel(1)).toBe("1일 · 개통 후 24시간");
  });
});

describe("formatEsimTripDaysPlanPickTitle", () => {
  it("개통 후 시간으로 고르도록 안내", () => {
    expect(formatEsimTripDaysPlanPickTitle(2)).toBe("2일(개통 후 48시간) 플랜을 골라주세요");
  });
});

describe("dateRangeFromTripDays", () => {
  it("내부 synthetic range는 duration_days — UI 달력 표기 금지 신호", () => {
    const anchor = new Date(2026, 8, 28);
    const r = dateRangeFromTripDays(2, anchor);
    expect(r.scheduleKind).toBe("duration_days");
    expect(r.tripDays).toBe(2);
    expect(r.start.getFullYear()).toBe(2026);
    expect(r.start.getMonth()).toBe(8);
    expect(r.start.getDate()).toBe(28);
    expect(r.end.getDate()).toBe(29);
  });
});
