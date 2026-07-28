import { describe, expect, it } from "vitest";
import {
  combineUsimsaUsedMb,
  formatUsimsaUsageAdminLabel,
  parseUsimsaDailyUsagePayload,
  parseUsimsaTopupPayload,
} from "@/lib/bongsim/supplier/usimsa/usage-normalize";

// REGRESSION-FREEZE[bongsim-admin-esim-usage-check]: daily·topup 파싱·라벨 — manifest

describe("parseUsimsaDailyUsagePayload", () => {
  it("reads todayUsageMb when history is empty", () => {
    const p = parseUsimsaDailyUsagePayload({
      code: "0000",
      message: "",
      usage: { iccid: "8985", todayUsageMb: 12.5, history: [] },
    });
    expect(p.todayUsageMb).toBe(12.5);
    expect(p.history).toEqual([]);
  });
});

describe("parseUsimsaTopupPayload", () => {
  it("detects activation via activeTime even when usage is 0", () => {
    const p = parseUsimsaTopupPayload({
      code: "0000",
      message: "",
      topup: {
        iccid: "8985",
        topupId: "t1",
        activeTime: "2026-07-25 14:48:18",
        usage: "0",
      },
    });
    expect(p.activeTime).toBe("2026-07-25 14:48:18");
    expect(p.topupUsageMb).toBe(0);
  });
});

describe("formatUsimsaUsageAdminLabel", () => {
  it("labels activated zero-MB as 활성화됨 not 미사용", () => {
    expect(
      formatUsimsaUsageAdminLabel({
        unused: false,
        activated: true,
        totalUsedMb: 0,
        topupCount: 1,
      }),
    ).toBe("활성화됨");
  });

  it("labels true unused as 미사용", () => {
    expect(
      formatUsimsaUsageAdminLabel({
        unused: true,
        activated: false,
        totalUsedMb: 0,
        topupCount: 1,
      }),
    ).toBe("미사용");
  });
});

describe("combineUsimsaUsedMb", () => {
  it("takes max of daily sum and topup cumulative", () => {
    expect(
      combineUsimsaUsedMb({
        history: [{ date: "2026-07-25", usageMb: 1 }],
        todayUsageMb: 2,
        topupUsageMb: 10,
      }),
    ).toBe(10);
  });
});
