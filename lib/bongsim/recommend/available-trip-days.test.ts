import { describe, expect, it } from "vitest";
import { collectAvailableTripDays } from "@/lib/bongsim/recommend/available-trip-days";
import type { ProductOption } from "@/lib/bongsim/recommend/product-option";

function p(days_raw: string): ProductOption {
  return {
    option_api_id: days_raw,
    plan_name: "test",
    network_family: "roaming",
    plan_type: "daily",
    days_raw,
    allowance_label: "1GB",
    option_label: "",
    price_block: {},
    flags: {},
  };
}

describe("collectAvailableTripDays", () => {
  it("returns sorted unique catalog days only", () => {
    expect(collectAvailableTripDays([p("7일"), p("3일"), p("7일"), p("15일")])).toEqual([3, 7, 15]);
  });

  it("ignores invalid days_raw", () => {
    expect(collectAvailableTripDays([p(""), p("무제한")])).toEqual([]);
  });
});
