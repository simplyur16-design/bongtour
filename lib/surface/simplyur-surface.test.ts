import { describe, expect, it } from "vitest";
import {
  isSimplyurSurfacePath,
  SIMPLYUR_SURFACE_HEADER,
  SIMPLYUR_SURFACE_VALUE,
} from "@/lib/surface/simplyur-surface";

describe("simplyur surface header", () => {
  it("simplyur 경로 식별", () => {
    expect(isSimplyurSurfacePath("/simplyur")).toBe(true);
    expect(isSimplyurSurfacePath("/simplyur/en/recommend")).toBe(true);
    expect(isSimplyurSurfacePath("/travel/esim")).toBe(false);
  });

  it("헤더 상수", () => {
    expect(SIMPLYUR_SURFACE_HEADER).toBe("x-bt-surface");
    expect(SIMPLYUR_SURFACE_VALUE).toBe("simplyur");
  });
});
