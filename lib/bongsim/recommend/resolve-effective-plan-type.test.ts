import { describe, expect, it } from "vitest";
import { resolveEffectivePlanType } from "@/lib/bongsim/recommend/resolve-effective-plan-type";

describe("resolveEffectivePlanType", () => {
  it("명시적 plan_type 은 그대로", () => {
    expect(resolveEffectivePlanType({ plan_type: "daily" })).toBe("daily");
  });

  it("로컬 null + 매일 옵션 → daily", () => {
    expect(
      resolveEffectivePlanType({
        plan_type: null,
        network_family: "local",
        allowance_label: "500MB",
        option_label: "7일 / 매일 500MB 이후 저속 무제한",
      }),
    ).toBe("daily");
  });

  it("로컬 null + 완전 무제한 → unlimited", () => {
    expect(
      resolveEffectivePlanType({
        plan_type: null,
        network_family: "local",
        allowance_label: "완전 무제한",
        option_label: "7일 / 완전 무제한",
      }),
    ).toBe("unlimited");
  });

  it("로밍 null plan_type → null", () => {
    expect(
      resolveEffectivePlanType({
        plan_type: null,
        network_family: "roaming",
        allowance_label: "1GB",
      }),
    ).toBeNull();
  });
});
