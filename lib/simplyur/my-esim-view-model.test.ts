import { describe, expect, it } from "vitest";
import {
  buildUsageSummaryView,
  formatDataAmount,
  myEsimBadgeTier,
  usageUsedPercent,
} from "./my-esim-view-model";

const tr = (key: string) =>
  ({
    "myEsim.notStarted": "Not started",
    "myEsim.activatesOnConnect": "Activates on first connection",
    "myEsim.loadingUsage": "Loading usage…",
    "myEsim.usedToday": "{amount} used today",
    "myEsim.usedTodaySuffix": "used today",
    "myEsim.unlimitedResetsDaily": "Unlimited plan · resets daily",
    "myEsim.usedOfCap": "{used} of {cap} used",
    "myEsim.usedOfSuffix": "of {cap}",
    "myEsim.usedSuffix": "used",
  })[key] ?? key;

describe("my-esim-view-model", () => {
  it("maps status to badge tier", () => {
    expect(myEsimBadgeTier("active")).toBe("active");
    expect(myEsimBadgeTier("cancelled")).toBe("expired");
    expect(myEsimBadgeTier("paid")).toBe("upcoming");
  });

  it("formats capped usage summary", () => {
    const order = {
      order_id: "1",
      order_number: "A",
      status_key: "active",
      plan_summary: "Test",
      grand_total_krw: "0",
      created_at: new Date().toISOString(),
      qr_code_img_url: null,
      sm_dp_plus_address: null,
      activation_code: null,
      can_show_qr: true,
      can_check_usage: true,
    };
    const view = buildUsageSummaryView(
      order,
      { total_used_mb: 12288, unlimited: false, cap_mb: 15360, history: [] },
      tr,
    );
    expect(view.hasCap).toBe(true);
    expect(usageUsedPercent(12288, 15360)).toBe(80);
    expect(formatDataAmount(12288)).toBe("12.0 GB");
  });
});
