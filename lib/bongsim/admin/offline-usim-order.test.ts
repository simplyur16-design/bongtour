import { describe, expect, it } from "vitest";
import {
  isOfflineUsimOnlyOrder,
  parseOfflineUsimConsents,
} from "@/lib/bongsim/admin/offline-usim-order";

describe("offline-usim-order", () => {
  it("parseOfflineUsimConsents accepts physical_usim_only", () => {
    const c = parseOfflineUsimConsents({
      offline_usim: {
        fulfillment: "physical_usim_only",
        created_by_admin_id: "admin1",
        created_at: "2026-06-19T00:00:00.000Z",
      },
    });
    expect(c?.fulfillment).toBe("physical_usim_only");
    expect(isOfflineUsimOnlyOrder({ offline_usim: c })).toBe(true);
  });

  it("rejects non-offline consents", () => {
    expect(isOfflineUsimOnlyOrder({ terms_accepted: true })).toBe(false);
    expect(
      parseOfflineUsimConsents({
        offline_usim: { fulfillment: "esim", created_by_admin_id: "a", created_at: "t" },
      }),
    ).toBeNull();
  });

  it("parses payment block", () => {
    const c = parseOfflineUsimConsents({
      offline_usim: {
        fulfillment: "physical_usim_only",
        created_by_admin_id: "admin1",
        created_at: "2026-06-19T00:00:00.000Z",
        payment: {
          channel: "cash",
          confirmed_by_admin_id: "admin2",
          confirmed_at: "2026-06-19T01:00:00.000Z",
          note: "매장 현금",
        },
      },
    });
    expect(c?.payment?.channel).toBe("cash");
    expect(c?.payment?.note).toBe("매장 현금");
  });
});
