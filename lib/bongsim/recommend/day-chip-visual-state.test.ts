import { describe, expect, it } from "vitest";
import { resolveDayChipVisualState } from "@/lib/bongsim/recommend/day-chip-visual-state";

describe("resolveDayChipVisualState", () => {
  it("선택된 일수가 최우선", () => {
    expect(resolveDayChipVisualState(5, 5, 3)).toBe("selected");
  });

  it("미선택 시 추천 일수는 recommended", () => {
    expect(resolveDayChipVisualState(3, null, 3)).toBe("recommended");
    expect(resolveDayChipVisualState(3, 7, 3)).toBe("recommended");
  });

  it("그 외는 default", () => {
    expect(resolveDayChipVisualState(7, null, 3)).toBe("default");
  });
});
