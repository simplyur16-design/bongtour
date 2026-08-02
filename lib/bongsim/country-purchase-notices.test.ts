import { describe, expect, it } from "vitest";
import {
  getCountryPurchaseNotices,
  getMergedPurchaseNotices,
} from "@/lib/bongsim/country-purchase-notices";

// REGRESSION-FREEZE[bongsim-cn-purchase-notices-user-facing]: 중국 안내 SSOT — manifest

describe("country-purchase-notices (cn)", () => {
  it("exposes VPN / daily / mainland activation without supplier jargon", () => {
    const notices = getCountryPurchaseNotices("cn");
    const blob = notices.map((n) => `${n.title}\n${n.body}`).join("\n");
    expect(notices.length).toBeGreaterThanOrEqual(3);
    expect(blob).toMatch(/VPN/i);
    expect(blob).toMatch(/일일 데이터|저속/);
    expect(blob).toMatch(/본토/);
    expect(blob).not.toMatch(/05\s*코드/);
    expect(blob).toMatch(/여행자 인증은 필요 없습니다/);
  });

  it("dedupes when cn and rg-cn-hk-mo are merged", () => {
    const merged = getMergedPurchaseNotices(["cn", "rg-cn-hk-mo"]);
    const titles = merged.map((n) => n.title);
    expect(new Set(titles).size).toBe(titles.length);
  });
});
