import { describe, expect, it } from "vitest";
import { buildSimplyurKoreaPack } from "@/lib/simplyur/catalog/load-korea-catalog";
import type { ProductOption } from "@/lib/bongsim/recommend/product-option";

// min_display must follow the cheapest plan (min_price_krw), not the first (best-capacity) plan.

function row(id: string, planType: "daily" | "unlimited", label: string, krw: number): ProductOption {
  return {
    option_api_id: id,
    plan_name: "대한민국",
    network_family: "roaming",
    plan_type: planType,
    days_raw: "1일",
    allowance_label: label,
    option_label: "",
    qos_raw: null,
    price_block: { after: { consumer_krw: krw } },
    flags: {},
  };
}

describe("buildSimplyurKoreaPack min_display", () => {
  it("shows the cheapest plan price, not the first plan in display order", () => {
    const pack = buildSimplyurKoreaPack(
      [row("full", "unlimited", "완전 무제한", 4000), row("500", "daily", "500MB", 1300)],
      "en",
      { USD: 1350, JPY: 9.2, CNY: 185, TWD: 42, VND: 0.055 },
    );
    const cheapest = pack.roaming.products.find((p) => p.option_api_id === "500");
    expect(pack.roaming.min_price_krw).toBe(1365);
    expect(pack.roaming.min_display).toEqual(cheapest?.simplyur_display);
    expect(pack.roaming.min_display?.formatted).toBe("$1.01");
  });
});
