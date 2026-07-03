import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  COMPLIMENTARY_ESIM_BULK_MAX_RECIPIENTS,
  COMPLIMENTARY_ESIM_CHECKOUT_CHANNEL,
  COMPLIMENTARY_ESIM_PAYMENT_PROVIDER,
  COMPLIMENTARY_ESIM_REASON_CATEGORIES,
  COMPLIMENTARY_ESIM_REASON_LABELS,
  isComplimentaryEsimOrder,
  parseComplimentaryEsimBulkPhones,
  parseComplimentaryEsimConsents,
  parseComplimentaryEsimReasonCategory,
} from "@/lib/bongsim/admin/complimentary-esim-order";

describe("complimentary-esim-order", () => {
  it("reason categories have Korean labels", () => {
    for (const cat of COMPLIMENTARY_ESIM_REASON_CATEGORIES) {
      expect(COMPLIMENTARY_ESIM_REASON_LABELS[cat].length).toBeGreaterThan(0);
    }
  });

  it("parseComplimentaryEsimReasonCategory accepts known values", () => {
    expect(parseComplimentaryEsimReasonCategory("group_benefit")).toBe("group_benefit");
    expect(parseComplimentaryEsimReasonCategory(" cs_compensation ")).toBe("cs_compensation");
    expect(parseComplimentaryEsimReasonCategory("invalid")).toBeNull();
  });

  it("parseComplimentaryEsimConsents requires memo and grant fields", () => {
    expect(parseComplimentaryEsimConsents(null)).toBeNull();
    expect(
      parseComplimentaryEsimConsents({
        complimentary_esim: {
          fulfillment: "complimentary_esim",
          created_by_admin_id: "a1",
          created_at: "2026-01-01T00:00:00.000Z",
          granted_by_admin_id: "a1",
          granted_at: "2026-01-01T00:00:00.000Z",
          reason_category: "customer_thanks",
          reason_memo: "VIP 감사",
        },
      }),
    ).toMatchObject({
      reason_category: "customer_thanks",
      reason_memo: "VIP 감사",
    });
    expect(
      parseComplimentaryEsimConsents({
        complimentary_esim: {
          fulfillment: "complimentary_esim",
          created_by_admin_id: "a1",
          created_at: "2026-01-01T00:00:00.000Z",
          granted_by_admin_id: "a1",
          granted_at: "2026-01-01T00:00:00.000Z",
          reason_category: "other",
          reason_memo: "",
        },
      }),
    ).toBeNull();
  });

  it("isComplimentaryEsimOrder detects consents block", () => {
    const consents = {
      complimentary_esim: {
        fulfillment: "complimentary_esim",
        created_by_admin_id: "admin",
        created_at: "2026-01-01T00:00:00.000Z",
        granted_by_admin_id: "admin",
        granted_at: "2026-01-01T00:00:00.000Z",
        reason_category: "promo_event",
        reason_memo: "이벤트 당첨",
      },
    };
    expect(isComplimentaryEsimOrder(consents)).toBe(true);
    expect(isComplimentaryEsimOrder({})).toBe(false);
  });

  it("checkout channel and payment provider constants", () => {
    expect(COMPLIMENTARY_ESIM_CHECKOUT_CHANNEL).toBe("admin_complimentary_esim");
    expect(COMPLIMENTARY_ESIM_PAYMENT_PROVIDER).toBe("complimentary");
  });

  it("parseComplimentaryEsimBulkPhones splits lines and dedupes", () => {
    const text = "010-1111-2222\n01033334444, 010-1111-2222\n01055556666\nbad\n";
    expect(parseComplimentaryEsimBulkPhones(text)).toEqual({
      phones: ["010-1111-2222", "01033334444", "01055556666"],
      invalid: ["bad"],
    });
  });

  it("parseComplimentaryEsimBulkPhones accepts string array", () => {
    expect(parseComplimentaryEsimBulkPhones(["01012345678", "01087654321"])).toEqual({
      phones: ["01012345678", "01087654321"],
      invalid: [],
    });
  });

  it("bulk max recipients cap is fixed", () => {
    expect(COMPLIMENTARY_ESIM_BULK_MAX_RECIPIENTS).toBe(100);
  });
});
