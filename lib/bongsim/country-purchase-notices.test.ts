import { describe, expect, it } from "vitest";
import {
  getCountryPurchaseNotices,
  getMergedPurchaseNotices,
} from "@/lib/bongsim/country-purchase-notices";

// REGRESSION-FREEZE[bongsim-cn-purchase-notices-user-facing]: 중국·HK/MO/TW 안내 SSOT — manifest

describe("country-purchase-notices", () => {
  it("cn keeps VPN/daily and never claims unverified mainland activation policy", () => {
    const notices = getCountryPurchaseNotices("cn");
    const blob = notices.map((n) => `${n.title}\n${n.body}`).join("\n");
    expect(blob).toMatch(/VPN/i);
    expect(blob).toMatch(/일일 데이터|저속/);
    expect(blob).not.toMatch(/05\s*코드/);
    expect(blob).not.toMatch(/처음 개통/);
    expect(blob).not.toMatch(/최초 개통|최초 활성화/);
  });

  it("hk / mo / tw require install in Korea before entry", () => {
    for (const code of ["hk", "mo", "tw", "rg-hk-mo"] as const) {
      const blob = getCountryPurchaseNotices(code)
        .map((n) => `${n.title}\n${n.body}`)
        .join("\n");
      expect(blob).toMatch(/입국 전 한국에서 설치/);
      expect(blob).toMatch(/출국 전 한국에서/);
    }
  });

  it("dedupes when cn and rg-cn-hk-mo are merged", () => {
    const merged = getMergedPurchaseNotices(["cn", "rg-cn-hk-mo"]);
    const titles = merged.map((n) => n.title);
    expect(new Set(titles).size).toBe(titles.length);
    expect(titles.some((t) => t.includes("입국 전 한국에서 설치"))).toBe(true);
  });
});
