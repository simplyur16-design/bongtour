import { describe, expect, it } from "vitest";
import {
  simplyurCatalogLoadToViewState,
  simplyurProductHttpViewState,
} from "@/lib/simplyur/catalog/product-http-view-state";

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

describe("simplyurCatalogLoadToViewState", () => {
  it("keeps missing option and catalog miss as not_found", () => {
    expect(simplyurCatalogLoadToViewState("", null)).toBe("not_found");
    expect(simplyurCatalogLoadToViewState("KR-1", { ok: false, reason: "not_found" })).toBe("not_found");
    expect(simplyurCatalogLoadToViewState("KR-1", { ok: false, reason: "not_korea" })).toBe("not_found");
  });

  it("does not call DB failures Plan not found", () => {
    expect(simplyurCatalogLoadToViewState("KR-1", { ok: false, reason: "db_error" })).toBe("unavailable");
    expect(simplyurCatalogLoadToViewState("KR-1", { ok: false, reason: "connection_timeout" })).toBe(
      "unavailable",
    );
    expect(simplyurCatalogLoadToViewState("KR-1", { ok: false, reason: "db_unconfigured" })).toBe(
      "unavailable",
    );
  });

  it("marks a successful load as loaded", () => {
    expect(simplyurCatalogLoadToViewState("KR-1", { ok: true })).toBe("loaded");
  });
});
