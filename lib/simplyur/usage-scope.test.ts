import { describe, expect, it } from "vitest";
import {
  isDailyCapPlan,
  resolveSimplyurUsageScope,
  todayUsageDateKeys,
  usageDateKey,
} from "./usage-scope";

// 2026-11-21 10:00 KST
const NOW = new Date("2026-11-21T01:00:00Z");

describe("simplyur usage scope (data ring 1.0.3)", () => {
  it("daily 2GB plan: compares TODAY with the per-day cap, not the trip sum (2.9 GB / 2.0 GB bug)", () => {
    const history = [
      { date: "2026-11-19", usageMb: 1100 },
      { date: "2026-11-20", usageMb: 1050 },
      { date: "2026-11-21", usageMb: 820 },
    ];
    const s = resolveSimplyurUsageScope({
      line: { allowance_label: "2GB", plan_type: "daily", network_family: "roaming" },
      history,
      now: NOW,
    });
    expect(s.cap_scope).toBe("daily");
    expect(s.cap_mb).toBe(2048);
    expect(s.used_mb).toBe(820);
    expect(s.today_used_mb).toBe(820);
    expect(s.cumulative_used_mb).toBe(2970); // the old route showed this ≈ "2.9 GB" against 2.0 GB
    expect(s.used_mb).toBeLessThanOrEqual(s.cap_mb!);
  });

  it("daily plan with no row for today yet uses supplier todayUsageMb, else 0", () => {
    const history = [{ date: "20261120", usageMb: 1500 }];
    const withSupplier = resolveSimplyurUsageScope({
      line: { allowance_label: "1GB", plan_type: "daily" },
      history,
      supplierTodayUsageMb: 300,
      now: NOW,
    });
    expect(withSupplier.used_mb).toBe(300);
    expect(withSupplier.cumulative_used_mb).toBe(1800);
    const none = resolveSimplyurUsageScope({
      line: { allowance_label: "1GB", plan_type: "daily" },
      history,
      now: NOW,
    });
    expect(none.used_mb).toBe(0);
    expect(none.cumulative_used_mb).toBe(1500);
  });

  it("does not double count today when history already has today's row", () => {
    const s = resolveSimplyurUsageScope({
      line: { allowance_label: "10GB", plan_type: "fixed" },
      history: [
        { date: "2026-11-20", usageMb: 1000 },
        { date: "2026-11-21T00:00:00+09:00", usageMb: 400 },
      ],
      supplierTodayUsageMb: 450,
      now: NOW,
    });
    expect(s.cap_scope).toBe("total");
    expect(s.cap_mb).toBe(10240);
    expect(s.today_used_mb).toBe(450);
    expect(s.used_mb).toBe(1450);
  });

  it("total (fixed) plan: cumulative usage against the whole-plan cap; MB labels parsed as MB", () => {
    const s = resolveSimplyurUsageScope({
      line: { allowance_label: "500MB", plan_type: "fixed" },
      history: [
        { date: "2026-11-20", usageMb: 200 },
        { date: "2026-11-21", usageMb: 100 },
      ],
      now: NOW,
    });
    expect(s).toMatchObject({ cap_scope: "total", cap_mb: 500, used_mb: 300 });
  });

  it("unlimited plan has no cap and reports today's usage", () => {
    const s = resolveSimplyurUsageScope({
      line: { allowance_label: "완전 무제한", plan_type: "unlimited" },
      history: [{ date: "2026-11-21", usageMb: 3000 }],
      now: NOW,
    });
    expect(s).toMatchObject({ unlimited: true, cap_scope: "none", cap_mb: null, used_mb: 3000 });
  });

  it("plan type rule matches the storefront (capped = daily unless fixed / 종량제)", () => {
    expect(isDailyCapPlan({ plan_type: "daily" })).toBe(true);
    expect(isDailyCapPlan({ plan_type: "unlimited", allowance_label: "2GB" })).toBe(true);
    expect(isDailyCapPlan({ plan_type: null, network_family: "local", allowance_label: "1GB" })).toBe(true);
    expect(isDailyCapPlan({ plan_type: "fixed" })).toBe(false);
    expect(isDailyCapPlan({ plan_type: null, plan_line_excel: "종량제" })).toBe(false);
  });

  it("date keys: KST and UTC today, tolerant supplier date formats", () => {
    expect(todayUsageDateKeys(new Date("2026-11-20T16:00:00Z"))).toEqual(["20261121", "20261120"]);
    expect(todayUsageDateKeys(NOW)).toEqual(["20261121"]);
    expect(usageDateKey("2026-11-21")).toBe("20261121");
    expect(usageDateKey("2026.11.21 09:00")).toBe("20261121");
    expect(usageDateKey("")).toBe("");
  });
});
