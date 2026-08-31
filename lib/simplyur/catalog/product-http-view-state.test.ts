import { describe, expect, it } from "vitest";
import { simplyurProductHttpViewState } from "@/lib/simplyur/catalog/product-http-view-state";

// REGRESSION-FREEZE[esim-fulfill-keep-catalog-pipe]: 5xx ≠ Plan not found — manifest

describe("simplyurProductHttpViewState", () => {
  it("keeps 200 as ok and 404 as not_found", () => {
    expect(simplyurProductHttpViewState(200)).toBe("ok");
    expect(simplyurProductHttpViewState(404)).toBe("not_found");
  });

  it("does not call DB errors Plan not found", () => {
    expect(simplyurProductHttpViewState(500)).toBe("unavailable");
    expect(simplyurProductHttpViewState(503)).toBe("unavailable");
    expect(simplyurProductHttpViewState(429)).toBe("unavailable");
  });
});
