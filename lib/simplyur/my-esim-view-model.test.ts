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
    "myEsim.usedAmount": "{amount} used",
    "myEsim.leftWord": "left",
    "myEsim.leftToday": "left today",
    "myEsim.usedOfCapToday": "{used} of {cap} used today",
    "myEsim.usedOfSuffixToday": "of {cap} today",
    "myEsim.dailyPlanResets": "Daily allowance · resets every day",
    "myEsim.capReached": "All {cap} used",
    "myEsim.dailyCapReached": "Today's {cap} used up · resets every day",
  })[key] ?? key;

const activeOrder = {
  order_id: "1",
  order_number: "A",
  status_key: "active",
  plan_summary: "Test",
  grand_total_krw: "0",
  created_at: "2026-11-19T00:00:00Z",
  qr_code_img_url: null,
  sm_dp_plus_address: null,
  activation_code: null,
  can_show_qr: true,
  can_check_usage: true,
};

describe("my-esim-view-model", () => {
  it("maps status to badge tier", () => {
    expect(myEsimBadgeTier("active")).toBe("active");
    expect(myEsimBadgeTier("cancelled")).toBe("expired");
    expect(myEsimBadgeTier("paid")).toBe("preparing");
    expect(myEsimBadgeTier("paid", { can_show_qr: true })).toBe("ready");
    expect(myEsimBadgeTier("delivered", { can_show_qr: true })).toBe("ready");
    expect(myEsimBadgeTier("refundPending")).toBe("refundPending");
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

  it("never renders usage above the cap: old API daily payload (2.9 GB vs 2.0 GB) is clamped", () => {
    const view = buildUsageSummaryView(
      activeOrder,
      { total_used_mb: 2970, unlimited: false, cap_mb: 2048, history: [{ date: "2026-11-21", usageMb: 820 }] },
      tr,
    );
    expect(view.usedPct).toBe(100);
    expect(view.capReached).toBe(true);
    expect(view.usageLabel).toBe("All 2.0 GB used");
    expect(view.usedDisplay).toBe("2.0 GB");
    expect(view.remainingDisplay).toBe("0 GB");
    expect(view.usageLabel).not.toContain("2.9");
  });

  it("daily plan (1.0.3 API): today's usage against the per-day cap", () => {
    const view = buildUsageSummaryView(
      activeOrder,
      {
        total_used_mb: 820,
        used_mb: 820,
        today_used_mb: 820,
        cumulative_used_mb: 2970,
        cap_scope: "daily",
        unlimited: false,
        cap_mb: 2048,
        history: [],
      },
      tr,
    );
    expect(view.usageLabel).toBe("820 MB of 2.0 GB used today");
    expect(view.sublabel).toBe("Daily allowance · resets every day");
    expect(view.usedOfLabel).toBe("of 2.0 GB today");
    expect(view.leftLabel).toBe("left today");
    expect(view.remainingDisplay).toBe("1.2 GB");
    expect(view.usedPct).toBe(40);
    expect(view.capReached).toBe(false);
  });

  it("daily plan at its cap says today's allowance is used up", () => {
    const view = buildUsageSummaryView(
      activeOrder,
      { total_used_mb: 2100, cap_scope: "daily", unlimited: false, cap_mb: 2048, history: [] },
      tr,
    );
    expect(view.usageLabel).toBe("Today's 2.0 GB used up · resets every day");
    expect(view.usedPct).toBe(100);
  });

  it("total plan under the cap keeps the normal label; percent is 0..100", () => {
    const view = buildUsageSummaryView(
      activeOrder,
      { total_used_mb: 512, cap_scope: "total", unlimited: false, cap_mb: 1024, history: [] },
      tr,
    );
    expect(view.usageLabel).toBe("512 MB of 1.0 GB used");
    expect(view.leftLabel).toBe("left");
    expect(view.usedPct).toBe(50);
    expect(usageUsedPercent(-5, 100)).toBe(0);
    expect(usageUsedPercent(Number.NaN, 100)).toBe(0);
    expect(usageUsedPercent(500, 100)).toBe(100);
  });

  it("unknown cap shows plain used amount without a fake 0 GB cap", () => {
    const view = buildUsageSummaryView(
      activeOrder,
      { total_used_mb: 300, unlimited: false, cap_mb: null, history: [] },
      tr,
    );
    expect(view.hasCap).toBe(false);
    expect(view.usageLabel).toBe("300 MB used");
  });
});
