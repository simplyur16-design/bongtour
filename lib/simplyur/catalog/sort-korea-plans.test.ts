import { describe, expect, it } from "vitest";
import { sortKoreaPlansBestFirst } from "@/lib/simplyur/catalog/sort-korea-plans";
import type { ProductOption } from "@/lib/bongsim/recommend/product-option";

// REGRESSION-FREEZE[simplyur-plans-best-capacity-first]: 같은 일수 — 좋은 플랜 위 — manifest

function row(
  partial: Partial<ProductOption> & Pick<ProductOption, "option_api_id" | "plan_type" | "allowance_label">,
): ProductOption {
  return {
    option_api_id: partial.option_api_id,
    plan_name: "대한민국",
    network_family: "roaming",
    plan_type: partial.plan_type,
    days_raw: partial.days_raw ?? "5일",
    allowance_label: partial.allowance_label,
    option_label: "",
    qos_raw: partial.qos_raw ?? null,
    price_block: partial.price_block ?? { after: { consumer_krw: 10000 } },
    flags: {},
  };
}

describe("sortKoreaPlansBestFirst", () => {
  it("same day: full unlimited, then unlimited, then high daily GB, then low MB", () => {
    const sorted = sortKoreaPlansBestFirst([
      row({ option_api_id: "500", plan_type: "daily", allowance_label: "500MB" }),
      row({ option_api_id: "1g", plan_type: "daily", allowance_label: "1GB" }),
      row({
        option_api_id: "unl",
        plan_type: "unlimited",
        allowance_label: "무제한",
        qos_raw: "1Mbps",
      }),
      row({
        option_api_id: "full",
        plan_type: "unlimited",
        allowance_label: "완전 무제한",
        qos_raw: "5Mbps",
      }),
      row({ option_api_id: "5g", plan_type: "daily", allowance_label: "5GB" }),
    ]);
    expect(sorted.map((p) => p.option_api_id)).toEqual(["full", "unl", "5g", "1g", "500"]);
  });

  it("keeps shorter trip days above longer days", () => {
    const sorted = sortKoreaPlansBestFirst([
      row({ option_api_id: "d7", plan_type: "daily", allowance_label: "5GB", days_raw: "7일" }),
      row({ option_api_id: "d3", plan_type: "daily", allowance_label: "500MB", days_raw: "3일" }),
    ]);
    expect(sorted.map((p) => p.option_api_id)).toEqual(["d3", "d7"]);
  });
});
