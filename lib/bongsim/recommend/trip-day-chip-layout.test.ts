import { describe, expect, it } from "vitest";
import {
  groupTripDayOptions,
  TRIP_DAY_GROUP_DIVIDER_MIN_OPTIONS,
  tripDayChipClassName,
} from "@/lib/bongsim/recommend/trip-day-chip-layout";

describe("groupTripDayOptions", () => {
  it("15개 미만이면 구분선 없이 한 그룹", () => {
    const days = [1, 2, 3, 4, 5];
    expect(days.length).toBeLessThan(TRIP_DAY_GROUP_DIVIDER_MIN_OPTIONS);
    const groups = groupTripDayOptions(days);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.days).toEqual(days);
  });

  it("15개 이상이면 1–7 / 8–14 / 15+ 구간 분리", () => {
    const days = Array.from({ length: 20 }, (_, i) => i + 1);
    const groups = groupTripDayOptions(days);
    expect(groups.map((g) => g.group.id)).toEqual(["week1", "week2", "long"]);
    expect(groups[0]!.days).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(groups[1]!.days).toEqual([8, 9, 10, 11, 12, 13, 14]);
    expect(groups[2]!.days).toEqual([15, 16, 17, 18, 19, 20]);
  });

  it("희소 일수도 구간에 맞게 배치", () => {
    const days = Array.from({ length: 16 }, (_, i) => i + 1);
    const groups = groupTripDayOptions(days);
    expect(groups[2]!.days).toEqual([15, 16]);
  });
});

describe("tripDayChipClassName", () => {
  it("selected는 파란 채움", () => {
    expect(tripDayChipClassName("selected")).toContain("bg-[#0176f9]");
  });
});
