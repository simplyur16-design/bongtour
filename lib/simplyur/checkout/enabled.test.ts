import { describe, expect, it } from "vitest";
import { isSimplyurCheckoutEnabled, isSimplyurCheckoutEnabledClient } from "@/lib/simplyur/checkout/enabled";

describe("simplyur checkout enabled", () => {
  it("defaults off without env", () => {
    expect(isSimplyurCheckoutEnabledClient()).toBe(false);
    expect(isSimplyurCheckoutEnabled()).toBe(false);
  });
});
