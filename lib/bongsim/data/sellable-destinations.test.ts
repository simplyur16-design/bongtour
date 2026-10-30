import { describe, expect, it } from "vitest";
import {
  allEsimDestinationCandidateCodes,
  computeSellableDestinationCodes,
} from "@/lib/bongsim/data/sellable-destinations";
import type { ProductOption } from "@/lib/bongsim/recommend/product-option";

function row(partial: Partial<ProductOption> & Pick<ProductOption, "plan_name">): ProductOption {
  return {
    option_api_id: partial.option_api_id ?? "id",
    plan_name: partial.plan_name,
    network_family: partial.network_family ?? "roaming",
    plan_type: partial.plan_type ?? "data",
    days_raw: partial.days_raw ?? "3일",
    allowance_label: partial.allowance_label ?? "",
    option_label: partial.option_label ?? "",
    price_block: partial.price_block ?? {},
    flags: partial.flags ?? {},
  };
}

describe("computeSellableDestinationCodes (REGRESSION-FREEZE[bongsim-esim-hide-unavailable])", () => {
  it("활성 플랜이 있는 국가·권역만 남김 — 0건 국가는 제외", () => {
    const active = [
      row({ option_api_id: "jp1", plan_name: "일본" }),
      row({ option_api_id: "c1", plan_name: "코카서스 3국(경유팩)" }),
    ];
    const codes = computeSellableDestinationCodes(active, ["jp", "th", "rg-caucasus-3", "rg-eu-42", "bad!"]);
    expect(codes).toEqual(["jp", "rg-caucasus-3"]);
  });

  it("다국가 플랜만 있는 국가는 단독 국가 타일로 만들지 않음", () => {
    const active = [row({ option_api_id: "sea", plan_name: "동남아 3개국" })];
    expect(computeSellableDestinationCodes(active, ["my", "sg"])).toEqual([]);
  });

  it("후보 = 국가 옵션 + 권역 pack (중복 없음)", () => {
    const all = allEsimDestinationCandidateCodes();
    expect(all).toContain("jp");
    expect(all).toContain("rg-eu-42");
    expect(new Set(all).size).toBe(all.length);
  });
});
